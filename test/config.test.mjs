import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getAppPaths } from '../dist/app-paths.js';
import { loadConfig, resolveApiKey, saveConfig } from '../dist/config.js';
import { PRIVATE_DIR_MODE, PRIVATE_FILE_MODE } from '../dist/filesystem.js';
import { createTempHome, getMode } from './support/helpers.mjs';

test('saveConfig writes config inside the app directory with private permissions', (t) => {
  const tempHome = createTempHome(t);
  const paths = getAppPaths(tempHome);

  saveConfig({ OPENAI_API_KEY: 'stored-key' }, paths);

  assert.deepEqual(loadConfig(paths), { OPENAI_API_KEY: 'stored-key' });
  assert.equal(getMode(paths.appDir), PRIVATE_DIR_MODE);
  assert.equal(getMode(paths.configFile), PRIVATE_FILE_MODE);
});

test('loadConfig migrates the legacy config file into the app directory', (t) => {
  const tempHome = createTempHome(t);
  const paths = getAppPaths(tempHome);

  fs.writeFileSync(paths.legacyConfigFile, JSON.stringify({ OPENAI_API_KEY: 'legacy-key' }), 'utf-8');

  const config = loadConfig(paths);

  assert.deepEqual(config, { OPENAI_API_KEY: 'legacy-key' });
  assert.ok(fs.existsSync(paths.configFile));
  assert.equal(fs.existsSync(paths.legacyConfigFile), false);
});

test('resolveApiKey prefers the environment over the saved config', (t) => {
  const tempHome = createTempHome(t);
  const paths = getAppPaths(tempHome);

  saveConfig({ OPENAI_API_KEY: 'stored-key' }, paths);

  assert.equal(resolveApiKey(paths, { OPENAI_API_KEY: 'env-key' }), 'env-key');
  assert.equal(resolveApiKey(paths, {}), 'stored-key');
});
