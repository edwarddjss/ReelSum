import assert from 'node:assert/strict';
import test from 'node:test';

import { assertInstagramUrl, isInstagramHostname } from '../dist/validation.js';

test('accepts instagram domains and subdomains', () => {
  assert.equal(isInstagramHostname('instagram.com'), true);
  assert.equal(isInstagramHostname('www.instagram.com'), true);
  assert.equal(assertInstagramUrl('https://www.instagram.com/reel/ABC123/'), 'https://www.instagram.com/reel/ABC123/');
});

test('rejects lookalike instagram domains', () => {
  assert.throws(
    () => assertInstagramUrl('https://instagram.com.evil-site.example/reel/ABC123/'),
    /valid Instagram URL/
  );
});

test('rejects unsupported protocols and invalid URLs', () => {
  assert.throws(
    () => assertInstagramUrl('ftp://www.instagram.com/reel/ABC123/'),
    /http\(s\) Instagram URL/
  );

  assert.throws(
    () => assertInstagramUrl('not-a-url'),
    /valid URL format/
  );
});
