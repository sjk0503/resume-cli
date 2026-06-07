#!/usr/bin/env node
// restore-cli — re-open one Ghostty tab per saved session and auto-resume each.
//
// Uses Ghostty's AppleScript dictionary to open tabs directly (NOT keystroke
// automation), so nothing can leak into another app. The first session opens as a new
// window (works even when no Ghostty window exists); the rest open as tabs in it.
import { readSnapshot, SNAPSHOT_PATH } from '../src/snapshot.mjs';
import {
  openTabInGhostty,
  ghosttyHasWindow,
  BETWEEN_TABS_DELAY_MS,
} from '../src/ghostty.mjs';
import { buildRestoreCommand } from '../src/restore-cmd.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-n');

async function main() {
  let snap;
  try {
    snap = readSnapshot();
  } catch (err) {
    console.error(`restore-cli: 스냅샷을 읽을 수 없습니다 (${SNAPSHOT_PATH}).`);
    console.error(`  ${err.message}`);
    console.error('  먼저 save-cli 를 실행해 스냅샷을 만드세요.');
    process.exit(1);
  }

  const sessions = snap.sessions || [];
  if (sessions.length === 0) {
    console.log('restore-cli: 스냅샷에 세션이 없습니다. 복원할 것이 없습니다.');
    return;
  }

  // Build the plan (cwd + resume command per session).
  const plan = sessions.map((s) => ({
    entry: s,
    cwd: s.kind === 'vibe' ? null : s.cwd, // vibe finds its own cwd; claude needs ours
    cmd: buildRestoreCommand(s),
  }));

  console.log(
    `restore-cli: ${sessions.length}개 세션을 Ghostty 새 탭으로 엽니다` +
      `${DRY_RUN ? ' (dry-run — 실제로는 열지 않음)' : ''} ` +
      `(저장 시각: ${snap.savedAt})`
  );

  for (const { entry, cwd, cmd } of plan) {
    const tag = entry.kind === 'vibe' ? `vibe:${entry.vibeProjectName}` : 'claude';
    const where = cwd ? cwd : entry.cwd; // for display, show recorded cwd either way
    console.log(`  [${tag}] (${where})`);
    console.log(`         ${cmd}`);
  }

  if (DRY_RUN) {
    console.log('\ndry-run: 실제 탭은 열지 않았습니다.');
    return;
  }

  // First surface opens as a window if Ghostty has none, so a cold start still works.
  let forceNewWindow = !ghosttyHasWindow();

  let opened = 0;
  for (const { entry, cwd, cmd } of plan) {
    const tag = entry.kind === 'vibe' ? `vibe:${entry.vibeProjectName}` : 'claude';
    try {
      // For vibe we pass the recorded cwd anyway as a harmless starting dir; `vibe
      // resume` will cd itself. For claude the command already `cd`s, but setting the
      // surface cwd too makes the tab land in the right place immediately.
      openTabInGhostty({ cwd: entry.cwd, command: cmd, forceNewWindow });
      forceNewWindow = false; // only the first one may need a window
      opened += 1;
      console.log(`  ✓ 탭 ${opened}/${plan.length} 열림 [${tag}]`);
    } catch (err) {
      console.error(`  ✗ 탭 열기 실패 [${tag}]: ${cmd}`);
      console.error(`    ${String(err.stderr || err.message || err).trim()}`);
    }
    if (opened < plan.length) await sleep(BETWEEN_TABS_DELAY_MS);
  }

  console.log(`\nrestore-cli: ${opened}/${plan.length}개 탭 복원 완료.`);
}

main();
