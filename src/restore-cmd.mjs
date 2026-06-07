// restore-cmd.mjs — build the shell command string that resumes one session.
//
// plain claude: cd into cwd, then `claude --resume <id> [preserved flags]`.
// vibe:        `vibe resume <projectName> --resume <id>` — vibe locates the cwd from
//              ~/dev/<name>/.vibe/state.json and restores the persona itself, so no cd.

// Single-quote a string for POSIX shells.
function shq(s) {
  return "'" + String(s).replace(/'/g, `'\\''`) + "'";
}

export function buildRestoreCommand(entry) {
  if (entry.kind === 'vibe') {
    const name = entry.vibeProjectName;
    if (!name) {
      // Fallback: no project name — resume plain claude in the recorded cwd.
      return buildClaudeCommand(entry);
    }
    return `vibe resume ${shq(name)} --resume ${shq(entry.sessionId)}`;
  }
  return buildClaudeCommand(entry);
}

function buildClaudeCommand(entry) {
  const flags = (entry.claudeFlags || []).join(' ');
  const claude = `claude ${flags} --resume ${shq(entry.sessionId)}`.replace(/\s+/g, ' ').trim();
  return `cd ${shq(entry.cwd)} && ${claude}`;
}
