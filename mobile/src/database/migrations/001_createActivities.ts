export const createActivitiesSql = `
  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    distance_meters REAL NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
    start_photo_uri TEXT,
    finish_photo_uri TEXT,
    status TEXT NOT NULL DEFAULT 'recording'
      CHECK (status IN ('recording', 'finished', 'pending_sync', 'synced')),
    created_at INTEGER NOT NULL,
    CHECK (finished_at IS NULL OR finished_at >= started_at)
  );

  CREATE INDEX IF NOT EXISTS activities_started_at_idx
    ON activities (started_at DESC);
`;
