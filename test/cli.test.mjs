import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTempHome } from './support/helpers.mjs';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const cliPath = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

function runCli(tempHome, args, extraEnv = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: tempHome,
      NO_COLOR: '1',
      ...extraEnv
    },
    encoding: 'utf-8'
  });
}

test('history prints a friendly message when there are no saved outputs', (t) => {
  const tempHome = createTempHome(t);

  const result = runCli(tempHome, ['history', '--limit', '5']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /No saved outputs found/);
});

test('history prints saved outputs in non-interactive environments', (t) => {
  const tempHome = createTempHome(t);
  const outputDir = path.join(tempHome, '.reelsum', 'outputs');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, '2026-03-20T10-00-00-000Z-demo1.txt'), [
    'Source: https://www.instagram.com/reel/DEMO123/',
    'Saved: 2026-03-20T10:00:00.000Z',
    '',
    'First saved output for CLI history testing.'
  ].join('\n'), 'utf-8');

  const result = runCli(tempHome, ['history', '--limit', '5']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Saved Reel Outputs \(1\)/);
  assert.match(result.stdout, /DEMO123/);
});

test('history rejects invalid limits', (t) => {
  const tempHome = createTempHome(t);

  const result = runCli(tempHome, ['history', '--limit', '0']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /positive number/);
});

test('summarize rejects invalid instagram URLs before doing any work', (t) => {
  const tempHome = createTempHome(t);

  const result = runCli(
    tempHome,
    ['summarize', 'https://instagram.com.evil-site.example/reel/ABC123/'],
    { OPENAI_API_KEY: 'env-key' }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /valid Instagram URL/);
});

test('summarize without a URL fails cleanly in non-interactive mode', (t) => {
  const tempHome = createTempHome(t);

  const result = runCli(tempHome, ['summarize'], { OPENAI_API_KEY: 'env-key' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pass an Instagram Reel URL as an argument/);
});
