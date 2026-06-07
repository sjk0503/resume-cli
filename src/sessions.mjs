// sessions.mjs — detect interactive claude/vibe sessions on macOS.
//
// Strategy (all verified against the live machine, claude 2.1.x):
//   1. List processes with `ps`. claude command lines contain embedded newlines (the
//      vibe persona via --append-system-prompt), so we parse pid/ppid/tty/firstline
//      cheaply, then re-fetch the FULL command per candidate pid in isolation.
//   2. Keep only interactive, TTY-attached `claude` processes. Exclude daemons
//      (`daemon run`, `--bg-pty-host`, `--bg-spare`, `--bg-...`) and the desktop app.
//   3. cwd via `lsof -p <pid> -a -d cwd -Fn`.
//   4. sessionId:
//        - if `--resume <id>` is on the command line, parse it directly.
//        - else (fresh session) find the cwd-encoded projects dir and take the
//          most-recently-modified `<id>.jsonl` (the active session writes continuously).
//          NOTE: claude 2.1.x does NOT keep the jsonl open as an lsof-visible handle,
//          so the mtime approach replaces the BLUEPRINT's lsof-open-handle idea.
//   5. kind: `vibe` if the command line carries the vibe persona, OR the parent
//      process is a `vibe` node process. Otherwise `claude`.
//   6. vibeProjectName: parsed from the parent `vibe <sub> <name>` invocation, else
//      basename(cwd) (vibe cwd is ~/dev/<name>).
//   7. claudeFlags: passthrough flags preserved on restore for plain claude
//      (currently --dangerously-skip-permissions).

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';

const HOME = homedir();
const PROJECTS_DIR = join(HOME, '.claude', 'projects');

// Encode a cwd the way claude encodes its projects subdir name.
// Verified: every '/' AND '.' becomes '-'. e.g.
//   /Users/kimseongjae/dev/meetplace -> -Users-kimseongjae-dev-meetplace
//   .../com.apple.CloudDocs/... -> ...-com-apple-CloudDocs-...
export function encodeProjectDir(cwd) {
  return cwd.replace(/[/.]/g, '-');
}

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

// Pass 1: pid/ppid/tty + first line of command (enough to pre-filter cheaply).
// pid/ppid/tty never contain spaces, so each process row parses one-per-line.
// Continuation lines (from embedded newlines in a prior command) fail the regex and
// are skipped here — the full command is re-fetched later per candidate pid.
function listProcesses() {
  const out = run('ps', ['-axww', '-o', 'pid=,ppid=,tty=,command=']);
  if (!out) return [];
  const procs = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    procs.push({
      pid: parseInt(m[1], 10),
      ppid: parseInt(m[2], 10),
      tty: m[3],
      command: m[4], // first line only
    });
  }
  return procs;
}

// Fetch the complete command line (including embedded newlines) for one pid.
function fullCommandOf(pid) {
  return run('ps', ['-p', String(pid), '-o', 'command=']).replace(/\n+$/, '');
}

// Is this an interactive claude session we care about? Uses the first command line.
function isInteractiveClaude(proc) {
  const { tty, command } = proc;
  if (!tty || tty === '??' || tty === '?' || tty === '-') return false;
  if (/Claude\.app|ClaudeCode\.app/.test(command)) return false;
  const firstToken = command.split(/\s+/)[0] || '';
  const isClaudeExe = firstToken === 'claude' || /\/claude$/.test(firstToken);
  if (!isClaudeExe) return false;
  if (/--bg-pty-host|--bg-spare|--bg-[a-z]|daemon\s+run/.test(command)) return false;
  return true;
}

function parseResumeId(command) {
  const m = command.match(/--resume[=\s]+([0-9a-fA-F-]{8,})/);
  return m ? m[1] : null;
}

function cwdOfPid(pid) {
  const out = run('lsof', ['-p', String(pid), '-a', '-d', 'cwd', '-Fn']);
  for (const line of out.split('\n')) {
    if (line.startsWith('n/')) return line.slice(1);
  }
  return null;
}

// Active session id for a fresh session = newest <id>.jsonl in the encoded projects dir.
function freshSessionId(cwd) {
  const dir = join(PROJECTS_DIR, encodeProjectDir(cwd));
  let entries;
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
  } catch {
    return null;
  }
  let best = null;
  let bestMtime = -1;
  for (const f of entries) {
    try {
      const m = statSync(join(dir, f)).mtimeMs;
      if (m > bestMtime) {
        bestMtime = m;
        best = f;
      }
    } catch {
      /* ignore */
    }
  }
  return best ? best.replace(/\.jsonl$/, '') : null;
}

// Determine kind. fullCommand carries the persona (multi-line) when present.
function classify(fullCommand, ppid, procByPid) {
  const hasPersona =
    /--append-system-prompt/.test(fullCommand) &&
    /(CLAUDE\.md\s*[—-]\s*vibe|vibe project|\*\*CEO\*\*|SI 회사 모델)/.test(fullCommand);
  const parent = procByPid.get(ppid);
  const parentIsVibe = parent ? /\bvibe\b/.test(parent.command) : false;
  return hasPersona || parentIsVibe ? 'vibe' : 'claude';
}

// vibe projectName: prefer the parent `vibe <sub> <name>` arg; fall back to basename(cwd).
function vibeProjectName(ppid, procByPid, cwd) {
  const parent = procByPid.get(ppid);
  if (parent) {
    const full = parent.command; // vibe parent command is single-line
    const m = full.match(/\bvibe\s+(resume|new|adopt|continue)\s+([^\s-][^\s]*)/);
    if (m) return m[2];
  }
  return cwd ? basename(cwd) : null;
}

function extractClaudeFlags(fullCommand) {
  const flags = [];
  if (/--dangerously-skip-permissions/.test(fullCommand)) {
    flags.push('--dangerously-skip-permissions');
  }
  return flags;
}

// Public API: list interactive session entries.
export function detectSessions() {
  const procs = listProcesses();
  const procByPid = new Map(procs.map((p) => [p.pid, p]));
  const claudeProcs = procs.filter(isInteractiveClaude);

  const sessions = [];
  const seen = new Set();

  for (const proc of claudeProcs) {
    const cwd = cwdOfPid(proc.pid);
    if (!cwd) continue;

    const fullCommand = fullCommandOf(proc.pid) || proc.command;

    let sessionId = parseResumeId(fullCommand);
    if (!sessionId) sessionId = freshSessionId(cwd);
    if (!sessionId) continue;

    const kind = classify(fullCommand, proc.ppid, procByPid);
    const entry = { cwd, sessionId, kind, tty: proc.tty, pid: proc.pid };

    if (kind === 'vibe') {
      entry.vibeProjectName = vibeProjectName(proc.ppid, procByPid, cwd);
    } else {
      const flags = extractClaudeFlags(fullCommand);
      if (flags.length) entry.claudeFlags = flags;
    }

    const key = `${cwd}::${sessionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sessions.push(entry);
  }

  return sessions;
}
