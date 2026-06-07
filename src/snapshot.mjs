// snapshot.mjs — read/write the single local snapshot file.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export const SNAPSHOT_DIR = join(homedir(), '.resume-cli');
export const SNAPSHOT_PATH = join(SNAPSHOT_DIR, 'snapshot.json');

export function writeSnapshot(sessions) {
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    sessions,
  };
  // Strip runtime-only fields (pid changes across reboots; tty is informational).
  payload.sessions = sessions.map(({ pid, ...keep }) => keep);
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return SNAPSHOT_PATH;
}

export function readSnapshot() {
  const raw = readFileSync(SNAPSHOT_PATH, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.sessions)) {
    throw new Error('snapshot.json is malformed (no sessions array)');
  }
  return data;
}
