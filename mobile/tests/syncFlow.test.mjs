import assert from 'node:assert/strict';
import test from 'node:test';
import { runPendingSync, SyncHttpError } from '../src/services/runPendingSync.ts';
import { assertSyncAcknowledgement, createSyncPayload } from '../src/services/syncProtocol.ts';

function activity(id) {
  return {
    id,
    startedAt: 1000,
    finishedAt: 2000,
    durationSeconds: 1,
    distanceMeters: 10,
    hasValidGpsPoint: true,
    startPhotoTakenAt: 1000,
    finishPhotoTakenAt: 2000,
    status: 'pending_sync',
    createdAt: 1000,
  };
}

function ports(ids, calls, upload = async () => {}) {
  return {
    isOnline: async () => { calls.push('online'); return true; },
    listPendingActivityIds: async () => { calls.push('list'); return ids; },
    loadActivity: async (id) => { calls.push(`load:${id}`); return activity(id); },
    loadPoints: async (id) => { calls.push(`points:${id}`); return []; },
    markAttempt: async (id) => { calls.push(`attempt:${id}`); },
    upload: async (_endpoint, item) => { calls.push(`upload:${item.id}`); await upload(item.id); },
    markSynced: async (id) => { calls.push(`synced:${id}`); },
  };
}

test('no URL or no connection leaves the queue untouched', async () => {
  const calls = [];
  assert.deepEqual(await runPendingSync(null, ports(['a'], calls)), {
    synced: 0, failed: 0, skipped: 'not_configured',
  });
  assert.deepEqual(calls, []);

  const offlinePorts = ports(['a'], calls);
  offlinePorts.isOnline = async () => false;
  assert.deepEqual(await runPendingSync('https://example.com/activities', offlinePorts), {
    synced: 0, failed: 0, skipped: 'offline',
  });
  assert.deepEqual(calls, []);
});

test('an activity is marked synced only after upload succeeds', async () => {
  const calls = [];
  assert.deepEqual(await runPendingSync('https://example.com/activities', ports(['a'], calls)), {
    synced: 1, failed: 0, skipped: null,
  });
  assert.deepEqual(calls, ['online', 'list', 'load:a', 'points:a', 'attempt:a', 'upload:a', 'synced:a']);
});

test('a failed upload stays pending and stops the current pass', async () => {
  const calls = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await runPendingSync('https://example.com/activities', ports(['a', 'b'], calls, async () => {
        throw new Error('connection lost');
      })),
      { synced: 0, failed: 1, skipped: null }
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(calls, ['online', 'list', 'load:a', 'points:a', 'attempt:a', 'upload:a']);
});

test('a rejected activity does not block later valid activities', async () => {
  const calls = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(
      await runPendingSync('https://example.com/activities', ports(['a', 'b'], calls, async (id) => {
        if (id === 'a') throw new SyncHttpError(400);
      })),
      { synced: 1, failed: 1, skipped: null }
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(calls.includes('synced:a'), false);
  assert.equal(calls.includes('synced:b'), true);
});

test('payload keeps raw points and acknowledgement must match the activity', () => {
  const point = {
    id: 'point-1', activityId: 'a', latitude: 1, longitude: 2,
    altitude: null, accuracy: 5, speed: null, timestamp: 1500, isValid: false,
  };
  const payload = createSyncPayload(activity('a'), [point]);
  assert.equal(payload.id, 'a');
  assert.deepEqual(payload.points, [point]);
  assert.doesNotThrow(() => assertSyncAcknowledgement({ activityId: 'a' }, 'a'));
  assert.throws(() => assertSyncAcknowledgement({ activityId: 'b' }, 'a'));
  assert.throws(() => assertSyncAcknowledgement({}, 'a'));
});
