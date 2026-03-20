import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function createTempHome(t) {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'reelsum-test-'));
  t.after(() => {
    fs.rmSync(tempHome, { recursive: true, force: true });
  });
  return tempHome;
}

export function getMode(filePath) {
  return fs.statSync(filePath).mode & 0o777;
}
