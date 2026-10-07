export const createRawLocationPointsSql = `
  CREATE TABLE IF NOT EXISTS raw_location_points (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    speed REAL,
    timestamp INTEGER NOT NULL,
    is_valid INTEGER CHECK (is_valid IN (0, 1))
  );

  CREATE INDEX IF NOT EXISTS raw_location_points_activity_time_idx
    ON raw_location_points (activity_id, timestamp, id);
`;
