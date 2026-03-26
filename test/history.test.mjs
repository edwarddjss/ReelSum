import assert from 'node:assert/strict';
import test from 'node:test';

import { icons } from '../dist/icons.js';
import { renderHistoryList, renderHistoryView } from '../dist/history.js';

function escapeForRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function createEntry(body) {
  return {
    filePath: '/tmp/demo-output.txt',
    sourceUrl: 'https://www.instagram.com/reel/DEMO123/',
    savedAt: '2026-03-20T10:00:00.000Z',
    preview: body.slice(0, 40),
    body
  };
}

test('renderHistoryView shows saved output inside the shared bordered box', () => {
  const view = renderHistoryView([createEntry('Alpha beta gamma\nDelta epsilon')], 0, 0, '', {
    columns: 50,
    rows: 18
  });

  assert.match(view.output, new RegExp(`${escapeForRegExp(icons.brand)} Reel Content`));
  assert.match(view.output, /╰/);
  assert.match(view.output, /Alpha beta gamma/);
  assert.match(view.output, /Up\/Down/);
  assert.doesNotMatch(view.output, /J\/K/);
  assert.doesNotMatch(view.output, /instagram\.com/);
  assert.doesNotMatch(view.output, /demo-output\.txt/);
});

test('renderHistoryView clamps scrolling based on the boxed viewport height', () => {
  const body = Array.from({ length: 10 }, (_, index) => `Line ${index + 1}`).join('\n');

  const view = renderHistoryView([createEntry(body)], 0, 999, '', {
    columns: 50,
    rows: 14
  });

  assert.equal(view.scrollOffset, 7);
  assert.match(view.output, /Lines 8-10 of 10/);
});

test('renderHistoryList keeps minimal controls in the footer', () => {
  const output = renderHistoryList([createEntry('Preview body for the selected saved output.')], 0, '', {
    columns: 70,
    rows: 16
  });

  const lines = output.split('\n');
  const footerLine = stripAnsi(lines.at(-1) ?? '');

  assert.match(output, new RegExp(`${escapeForRegExp(icons.brand)} Reel History`));
  assert.match(output, /Up\/Down/);
  assert.match(footerLine, /Enter.*Q quit/);
  assert.doesNotMatch(output, /J\/K/);
  assert.doesNotMatch(output, /instagram\.com/);
  assert.doesNotMatch(output, /demo-output\.txt/);
});
