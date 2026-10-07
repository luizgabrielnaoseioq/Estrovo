export const oneRecordingActivitySql = `
  CREATE UNIQUE INDEX IF NOT EXISTS one_recording_activity_idx
    ON activities (status)
    WHERE status = 'recording';
`;
