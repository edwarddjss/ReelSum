import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getAppPaths } from '../dist/app-paths.js';
import { PRIVATE_DIR_MODE, PRIVATE_FILE_MODE } from '../dist/filesystem.js';
import { getSavedOutputs, saveOutput } from '../dist/storage.js';
import { createTempHome, getMode } from './support/helpers.mjs';

test('saveOutput stores results with private permissions and newest-first ordering', (t) => {
  const tempHome = createTempHome(t);
  const paths = getAppPaths(tempHome);

  saveOutput('https://www.instagram.com/reel/OLDER/', 'Older output body', paths, new Date('2026-03-20T10:00:00.000Z'));
  const latestFile = saveOutput('https://www.instagram.com/reel/NEWER/', 'Newer output body', paths, new Date('2026-03-20T11:00:00.000Z'));

  const entries = getSavedOutputs(10, paths);

  assert.equal(getMode(paths.appDir), PRIVATE_DIR_MODE);
  assert.equal(getMode(paths.outputDir), PRIVATE_DIR_MODE);
  assert.equal(getMode(latestFile), PRIVATE_FILE_MODE);
  assert.equal(entries[0].sourceUrl, 'https://www.instagram.com/reel/NEWER/');
  assert.equal(entries[1].sourceUrl, 'https://www.instagram.com/reel/OLDER/');
  assert.match(entries[0].preview, /Newer output body/);
});

test('getSavedOutputs ignores malformed files instead of crashing history', (t) => {
  const tempHome = createTempHome(t);
  const paths = getAppPaths(tempHome);

  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.writeFileSync(path.join(paths.outputDir, 'broken.txt'), Buffer.from([0xff, 0xfe, 0xfd]));

  assert.deepEqual(getSavedOutputs(10, paths), []);
});
