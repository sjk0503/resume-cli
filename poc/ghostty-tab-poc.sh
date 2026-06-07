#!/bin/bash
# PoC: open a NEW TAB in Ghostty and run a command inside it.
# Success marker: writes POC_OK + timestamp to /tmp/resume-cli-poc.out from INSIDE the new tab.
set -euo pipefail

MARKER="/tmp/resume-cli-poc.out"
rm -f "$MARKER"

# The command we want the new tab to actually run:
INNER_CMD="cd ~/dev/resume-cli && echo POC_OK \$(date +%s) > $MARKER && echo done"

osascript <<APPLESCRIPT
tell application "Ghostty" to activate
delay 0.4
tell application "System Events"
  tell process "Ghostty"
    -- open a new tab
    keystroke "t" using {command down}
  end tell
end tell
delay 0.8
tell application "System Events"
  -- type the command into the freshly focused tab, then Enter
  keystroke "$INNER_CMD"
  delay 0.2
  key code 36
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
echo "MARKER NOT FOUND — PoC FAILED (tab/keystroke likely blocked)."
exit 1
