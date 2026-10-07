import * as Crypto from 'expo-crypto';
import { getDatabase } from '../../services/databaseService';
import type { Activity, ActivityPhoto, ActivityStatus } from '../../types/Activity';

type ActivityRow = {
  id: string;
  started_at: number;
  finished_at: number | null;
  duration_seconds: number;
  distance_meters: number;
  has_valid_gps_point: number;
  start_photo_uri: string | null;
  start_photo_taken_at: number | null;
  finish_photo_uri: string | null;
  finish_photo_taken_at: number | null;
  status: ActivityStatus;
  created_at: number;
};

const activityColumns = `
  id, started_at, finished_at, duration_seconds, distance_meters,
  start_photo_uri, start_photo_taken_at,
  finish_photo_uri, finish_photo_taken_at, status, created_at,
  EXISTS (
    SELECT 1 FROM raw_location_points p
    WHERE p.activity_id = activities.id AND p.is_valid = 1
  ) AS has_valid_gps_point
`;

function toActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    hasValidGpsPoint: row.has_valid_gps_point === 1,
    startPhotoUri: row.start_photo_uri ?? undefined,
    startPhotoTakenAt: row.start_photo_taken_at ?? undefined,
    finishPhotoUri: row.finish_photo_uri ?? undefined,
    finishPhotoTakenAt: row.finish_photo_taken_at ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listRecentActivities(): Promise<Activity[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ActivityRow>(`
    SELECT ${activityColumns}
    FROM activities
    ORDER BY started_at DESC
    LIMIT 5
  `);

  return rows.map(toActivity);
}

export async function getRecordingActivity(): Promise<Activity | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ActivityRow>(`
    SELECT ${activityColumns}
    FROM activities
    WHERE status = 'recording'
    LIMIT 1
  `);

  return row ? toActivity(row) : null;
}

export async function getPendingSyncActivity(activityId: string): Promise<Activity | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<ActivityRow>(`
    SELECT ${activityColumns}
    FROM activities
    WHERE id = ? AND status = 'pending_sync'
  `, activityId);

  return row ? toActivity(row) : null;
}

export async function startActivity(photo: ActivityPhoto): Promise<Activity> {
  const recording = await getRecordingActivity();
  if (recording) return recording;

  const database = await getDatabase();
  const startedAt = Date.now();
  const activity: Activity = {
    id: Crypto.randomUUID(),
    startedAt,
    durationSeconds: 0,
    distanceMeters: 0,
    hasValidGpsPoint: false,
    startPhotoUri: photo.uri,
    startPhotoTakenAt: photo.capturedAt,
    status: 'recording',
    createdAt: startedAt,
  };

  try {
    await database.runAsync(
      `INSERT INTO activities
        (id, started_at, duration_seconds, distance_meters,
         start_photo_uri, start_photo_taken_at, status, created_at)
       VALUES (?, ?, 0, 0, ?, ?, 'recording', ?)`,
      activity.id,
      activity.startedAt,
      photo.uri,
      photo.capturedAt,
      activity.createdAt
    );
  } catch (error) {
    const concurrentRecording = await getRecordingActivity();
    if (concurrentRecording) return concurrentRecording;
    throw error;
  }

  return activity;
}

export async function finishActivity(activityId: string, photo: ActivityPhoto): Promise<void> {
  const database = await getDatabase();
  const finishedAt = Date.now();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE activities
       SET finished_at = ?,
           duration_seconds = MAX(0, CAST((? - started_at) / 1000 AS INTEGER)),
           finish_photo_uri = ?,
           finish_photo_taken_at = ?,
           status = 'pending_sync'
       WHERE id = ? AND status = 'recording'`,
      finishedAt,
      finishedAt,
      photo.uri,
      photo.capturedAt,
      activityId
    );

    if (result.changes !== 1) {
      throw new Error('The activity is no longer recording.');
    }

    await transaction.runAsync(
      `INSERT INTO sync_queue
        (id, activity_id, status, attempts, last_attempt_at, created_at)
       VALUES (?, ?, 'pending', 0, NULL, ?)`,
      activityId,
      activityId,
      finishedAt
    );
  });
}
