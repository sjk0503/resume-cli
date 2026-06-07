#!/bin/bash
# PoC: open a NEW TAB in Ghostty at a given cwd and run a command inside it — using
# Ghostty's AppleScript dictionary (Ghostty 1.3+). NO keystroke simulation, so nothing
# can leak into another frontmost app.
#
# Success marker: writes POC_OK + cwd + timestamp to /tmp/resume-cli-poc.out from INSIDE
# the new tab. Proves the command ran in the correct working directory.
set -euo pipefail

MARKER="/tmp/resume-cli-poc.out"
rm -f "$MARKER"

CWD="$HOME/dev/resume-cli"
# The command the new tab should run, then keep the shell alive:
INNER_CMD="echo POC_OK \$(pwd) \$(date +%s) > $MARKER && echo done; exec \$SHELL"

osascript <<APPLESCRIPT
tell application "Ghostty"
  activate
  set cfg to new surface configuration
  set command of cfg to "$INNER_CMD"
  set initial working directory of cfg to "$CWD"
  if (count of windows) > 0 then
    new tab in front window with configuration cfg
  else
    new window with configuration cfg
  end if
end tell
APPLESCRIPT

echo "osascript dispatched. Waiting for marker..."
for i in $(seq 1 20); do
  if [ -f "$MARKER" ]; then
    echo "MARKER FOUND after ~${i}x0.25s:"
    cat "$MARKER"
    exit 0
  fi
  sleep 0.25
done
echo "MARKER NOT FOUND — PoC FAILED (Ghostty AppleScript likely blocked)."
exit 1
