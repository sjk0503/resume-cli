// ghostty.mjs — drive Ghostty via its AppleScript dictionary (Ghostty 1.3+) to open a
// new tab (or window) at a given cwd and run a command in it.
//
// WHY NOT KEYSTROKES: the old implementation used System Events `keystroke` (Cmd+T +
// typing the command). That intercepts the GLOBAL keyboard: if any other app is
// frontmost when a keystroke fires, the Cmd+T / typed command leaks INTO THAT APP.
// This actually happened (keystrokes leaked into the Claude desktop app). That approach
// is fundamentally unsafe and is fully removed.
//
// THIS IMPLEMENTATION targets Ghostty directly via its scripting dictionary, so there
// is no global keyboard interception and nothing can leak to another app.
//
// Verified facts about Ghostty 1.3.1's dictionary (constraints baked in below):
//   1. `new tab` MUST be targeted at a window (`new tab in front window`). A bare
//      `new tab` raises -1708.
//   2. A surface configuration MUST be built with `new surface configuration` and then
//      have its properties `set`. Inline records ({command:"..."}) raise -1708.
//   3. When Ghostty has NO windows open, `new tab in front window` fails — so we fall
//      back to `new window with configuration cfg`.
//
// First run may trigger a one-time macOS automation prompt ("Terminal wants to control
// Ghostty?") — this is the standard Apple Events permission, NOT Accessibility.

import { execFileSync } from 'node:child_process';

// Delay (ms) between opening successive tabs. Small is fine — we are not racing a
// focused-keystroke window, just giving Ghostty a beat to spawn each surface.
const BETWEEN_TABS_DELAY = Number(process.env.RESUME_CLI_BETWEEN_TABS_DELAY ?? 350);
export const BETWEEN_TABS_DELAY_MS = BETWEEN_TABS_DELAY;

function osascript(script) {
  // One `-e` per line keeps AppleScript quoting sane.
  const args = [];
  for (const line of script.split('\n')) args.push('-e', line);
  return execFileSync('osascript', args, { encoding: 'utf8' });
}

// Escape a JS string for embedding inside an AppleScript double-quoted literal.
function asString(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Does Ghostty currently have at least one window? Used to choose new tab vs new window.
// Returns true/false; on any AppleScript error, assume no window (safer: new window).
export function ghosttyHasWindow() {
  try {
    const out = osascript(
      ['tell application "Ghostty"', '  count of windows', 'end tell'].join('\n')
    );
    return parseInt(out.trim(), 10) > 0;
  } catch {
    return false;
  }
}

// Open one Ghostty surface (tab if a window exists, else a new window) at `cwd` and run
// `command`. We append `; exec $SHELL` so the tab stays alive (drops to an interactive
// shell) after the command exits or the session ends.
//
// `forceNewWindow` lets the caller open the very first session as a window (so a clean
// "no Ghostty windows" start still works) and subsequent ones as tabs.
export function openTabInGhostty({ cwd, command, forceNewWindow = false }) {
  const fullCommand = `${command}; exec $SHELL`;
  const useTab = !forceNewWindow && ghosttyHasWindow();

  const lines = [
    'tell application "Ghostty"',
    '  activate',
    '  set cfg to new surface configuration',
    `  set command of cfg to ${asString(fullCommand)}`,
    `  set initial working directory of cfg to ${asString(cwd)}`,
  ];

  if (useTab) {
    lines.push('  new tab in front window with configuration cfg');
  } else {
    lines.push('  new window with configuration cfg');
  }
  lines.push('end tell');

  osascript(lines.join('\n'));
}
