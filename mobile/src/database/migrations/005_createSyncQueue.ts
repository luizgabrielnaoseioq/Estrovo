export const createSyncQueueSql = `
  CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL UNIQUE REFERENCES activities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_attempt_at INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sync_queue_status_created_at_idx
    ON sync_queue (status, created_at);

  INSERT INTO sync_queue (id, activity_id, status, attempts, last_attempt_at, created_at)
  SELECT id, id, 'pending', 0, NULL, COALESCE(finished_at, created_at)
  FROM activities
  WHERE status IN ('finished', 'pending_sync');

  UPDATE activities SET status = 'pending_sync' WHERE status = 'finished';
`;
