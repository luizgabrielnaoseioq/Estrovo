import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createActivitiesSql } from '../src/database/migrations/001_createActivities.ts';
import { createSyncQueueSql } from '../src/database/migrations/005_createSyncQueue.ts';

test('the sync migration queues completed activities once and leaves active ones alone', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`PRAGMA foreign_keys = ON; ${createActivitiesSql}`);
    const insert = database.prepare(`
      INSERT INTO activities (id, started_at, finished_at, status, created_at)
      VALUES (?, 1000, ?, ?, 1000)
    `);
    insert.run('recording', null, 'recording');
    insert.run('legacy-finished', 2000, 'finished');
    insert.run('already-pending', 2000, 'pending_sync');
    insert.run('synced', 2000, 'synced');

    database.exec(createSyncQueueSql);

    assert.deepEqual(
      database.prepare('SELECT id, status FROM activities ORDER BY id').all().map((row) => ({ ...row })),
      [
        { id: 'already-pending', status: 'pending_sync' },
        { id: 'legacy-finished', status: 'pending_sync' },
        { id: 'recording', status: 'recording' },
        { id: 'synced', status: 'synced' },
      ]
    );
    assert.deepEqual(
      database.prepare('SELECT activity_id, status, attempts, last_attempt_at FROM sync_queue ORDER BY activity_id').all().map((row) => ({ ...row })),
      [
        { activity_id: 'already-pending', status: 'pending', attempts: 0, last_attempt_at: null },
        { activity_id: 'legacy-finished', status: 'pending', attempts: 0, last_attempt_at: null },
      ]
    );
    assert.throws(() =>
      database.exec(`INSERT INTO sync_queue (id, activity_id, created_at)
        VALUES ('duplicate', 'legacy-finished', 2000)`)
    );
  } finally {
    database.close();
  }
});
