import assert from 'node:assert/strict';
import test from 'node:test';
import { getActivitySyncUrl } from '../src/config/syncConfig.ts';

test('an unset API URL leaves sync disabled', () => {
  assert.equal(getActivitySyncUrl(''), null);
  assert.equal(getActivitySyncUrl('  '), null);
});

test('the configured base path is preserved', () => {
  assert.equal(getActivitySyncUrl('https://example.com/api/v1/'), 'https://example.com/api/v1/activities');
  assert.equal(getActivitySyncUrl('http://10.0.2.2:3000'), 'http://10.0.2.2:3000/activities');
});

test('invalid API URLs are rejected before any request', () => {
  assert.throws(() => getActivitySyncUrl('ftp://example.com'));
  assert.throws(() => getActivitySyncUrl('https://example.com/api?token=secret'));
  assert.throws(() => getActivitySyncUrl('https://user:password@example.com'));
});
