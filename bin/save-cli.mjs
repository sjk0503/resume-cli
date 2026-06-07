#!/usr/bin/env node
// save-cli — snapshot all currently-running interactive claude/vibe sessions.
import { detectSessions } from '../src/sessions.mjs';
import { writeSnapshot } from '../src/snapshot.mjs';

function main() {
  const sessions = detectSessions();
  const path = writeSnapshot(sessions);

  console.log(`save-cli: ${sessions.length}개 세션 저장됨 -> ${path}`);
  for (const s of sessions) {
    const tag = s.kind === 'vibe' ? `vibe:${s.vibeProjectName}` : 'claude';
    const flags = s.claudeFlags?.length ? ` ${s.claudeFlags.join(' ')}` : '';
    console.log(`  [${tag}] ${s.cwd}  (${s.sessionId})${flags}`);
  }

  if (sessions.length === 0) {
    console.log(
      '  (실행 중인 인터랙티브 claude/vibe 세션을 찾지 못했습니다. ' +
        '터미널 탭에서 세션이 떠 있는지 확인하세요.)'
    );
  }
}

main();
