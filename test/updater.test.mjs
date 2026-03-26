import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTempHome, getMode } from './support/helpers.mjs';

const updaterModulePath = fileURLToPath(new URL('../dist/updater.js', import.meta.url));
const { compareVersions, maybeHandleCliUpdate } = await import(updaterModulePath);

test('compareVersions handles stable and prerelease versions correctly', () => {
  assert.equal(compareVersions('1.0.6', '1.0.5'), 1);
  assert.equal(compareVersions('1.0.5', '1.0.5'), 0);
  assert.equal(compareVersions('1.0.5-beta.1', '1.0.5'), -1);
  assert.equal(compareVersions('v1.2.0', '1.10.0'), -1);
});

test('maybeHandleCliUpdate skips checks outside interactive TTY sessions', async (t) => {
  const tempHome = createTempHome(t);
  const stateFile = path.join(tempHome, '.reelsum', 'state.json');
  let fetchCalled = false;

  const updated = await maybeHandleCliUpdate(
    {
      appDir: path.join(tempHome, '.reelsum'),
      configFile: path.join(tempHome, '.reelsum', 'config.json'),
      legacyConfigFile: path.join(tempHome, '.reelsumrc'),
      outputDir: path.join(tempHome, '.reelsum', 'outputs'),
      stateFile
    },
    {
      currentVersion: '1.0.5',
      packageName: 'reelsum',
      log: () => {},
      stdinIsTTY: false,
      stdoutIsTTY: false,
      fetchLatestVersion: async () => {
        fetchCalled = true;
        return '1.0.6';
      }
    }
  );

  assert.equal(updated, false);
  assert.equal(fetchCalled, false);
  assert.equal(fs.existsSync(stateFile), false);
});

test('maybeHandleCliUpdate prompts, updates state, and exits early after a successful update', async (t) => {
  const tempHome = createTempHome(t);
  const appDir = path.join(tempHome, '.reelsum');
  const stateFile = path.join(appDir, 'state.json');
  let installCalled = false;

  const updated = await maybeHandleCliUpdate(
    {
      appDir,
      configFile: path.join(appDir, 'config.json'),
      legacyConfigFile: path.join(tempHome, '.reelsumrc'),
      outputDir: path.join(appDir, 'outputs'),
      stateFile
    },
    {
      currentVersion: '1.0.5',
      packageName: 'reelsum',
      log: () => {},
      now: new Date('2026-03-20T10:00:00.000Z'),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      fetchLatestVersion: async () => '1.0.6',
      promptForUpdate: async () => 'update',
      installLatest: () => {
        installCalled = true;
        return { success: true };
      }
    }
  );

  assert.equal(updated, true);
  assert.equal(installCalled, true);
  assert.equal(getMode(stateFile), 0o600);

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert.equal(state.lastSeenVersion, '1.0.6');
  assert.equal(state.lastPromptedVersion, '1.0.6');
});

test('maybeHandleCliUpdate does not re-prompt for the same version inside the reminder window', async (t) => {
  const tempHome = createTempHome(t);
  const appDir = path.join(tempHome, '.reelsum');
  const stateFile = path.join(appDir, 'state.json');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({
    lastCheckedAt: '2026-03-20T10:00:00.000Z',
    latestVersion: '1.0.6',
    lastPromptedAt: '2026-03-20T10:00:00.000Z',
    lastPromptedVersion: '1.0.6'
  }, null, 2), { mode: 0o600 });

  let promptCalled = false;

  const updated = await maybeHandleCliUpdate(
    {
      appDir,
      configFile: path.join(appDir, 'config.json'),
      legacyConfigFile: path.join(tempHome, '.reelsumrc'),
      outputDir: path.join(appDir, 'outputs'),
      stateFile
    },
    {
      currentVersion: '1.0.5',
      packageName: 'reelsum',
      log: () => {},
      now: new Date('2026-03-20T18:00:00.000Z'),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      fetchLatestVersion: async () => '1.0.6',
      promptForUpdate: async () => {
        promptCalled = true;
        return 'skip';
      }
    }
  );

  assert.equal(updated, false);
  assert.equal(promptCalled, false);
});

test('maybeHandleCliUpdate refetches when a recent cached check said there was no update', async (t) => {
  const tempHome = createTempHome(t);
  const appDir = path.join(tempHome, '.reelsum');
  const stateFile = path.join(appDir, 'state.json');
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify({
    lastCheckedAt: '2026-03-20T19:07:57.623Z',
    latestVersion: '1.0.6'
  }, null, 2), { mode: 0o600 });

  let fetchCalled = false;
  let promptCalled = false;

  const updated = await maybeHandleCliUpdate(
    {
      appDir,
      configFile: path.join(appDir, 'config.json'),
      legacyConfigFile: path.join(tempHome, '.reelsumrc'),
      outputDir: path.join(appDir, 'outputs'),
      stateFile
    },
    {
      currentVersion: '1.0.6',
      packageName: 'reelsum',
      log: () => {},
      now: new Date('2026-03-20T19:55:00.000Z'),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      fetchLatestVersion: async () => {
        fetchCalled = true;
        return '1.0.7';
      },
      promptForUpdate: async () => {
        promptCalled = true;
        return 'skip';
      }
    }
  );

  assert.equal(updated, false);
  assert.equal(fetchCalled, true);
  assert.equal(promptCalled, true);

  const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert.equal(state.lastSeenVersion, '1.0.7');
  assert.equal(state.lastPromptedVersion, '1.0.7');
});
