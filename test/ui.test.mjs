import assert from 'node:assert/strict';
import test from 'node:test';

import { renderBrandHeader, renderUpdateNotice } from '../dist/ui.js';

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

test('renderBrandHeader returns a compact branded title and subtitle', () => {
  const output = stripAnsi(renderBrandHeader());

  assert.match(output, /ReelSum/);
  assert.doesNotMatch(output, /Clean transcripts from Instagram reels/);
});

test('renderUpdateNotice shows versions and action hints in a box', () => {
  const output = stripAnsi(renderUpdateNotice('1.0.7', '1.0.8'));

  assert.match(output, /Update Available/);
  assert.match(output, /You have\s+1.0.7/);
  assert.match(output, /Available\s+1.0.8/);
  assert.match(output, /Y update now/);
  assert.match(output, /N keep working/);
});
