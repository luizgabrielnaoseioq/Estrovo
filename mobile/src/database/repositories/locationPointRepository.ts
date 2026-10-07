import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '../../services/databaseService';
import type { RawLocationPoint } from '../../types/LocationPoint';
import type { SyncLocationPoint } from '../../types/Sync';
import { validateGpsPoint, validateGpsTrack, type GpsPoint } from '../../utils/gpsValidation';

type SavedGpsPoint = GpsPoint & { is_valid: number | null };

export type GpsSummary = {
  savedCount: number;
  validCount: number;
  ignoredCount: number;
  distanceMeters: number;
  latestAccuracyMeters: number | null;
};

const pointColumns = 'id, latitude, longitude, accuracy, speed, timestamp, is_valid';

async function readGpsSummary(database: SQLite.SQLiteDatabase, activityId: string): Promise<GpsSummary> {
  const row = await database.getFirstAsync<{
    distance_meters: number;
    saved_count: number;
    valid_count: number;
    ignored_count: number;
    latest_accuracy: number | null;
  }>(
    `SELECT a.distance_meters,
            COUNT(p.id) AS saved_count,
            COALESCE(SUM(CASE WHEN p.is_valid = 1 THEN 1 ELSE 0 END), 0) AS valid_count,
            COALESCE(SUM(CASE WHEN p.is_valid = 0 THEN 1 ELSE 0 END), 0) AS ignored_count,
            (SELECT accuracy FROM raw_location_points
             WHERE activity_id = a.id ORDER BY timestamp DESC, id DESC LIMIT 1) AS latest_accuracy
     FROM activities a
     LEFT JOIN raw_location_points p ON p.activity_id = a.id
     WHERE a.id = ?
     GROUP BY a.id`,
    activityId
  );
  if (!row) throw new Error('Activity not found while reading GPS summary.');
  return {
    savedCount: row.saved_count,
    validCount: row.valid_count,
    ignoredCount: row.ignored_count,
    distanceMeters: row.distance_meters,
    latestAccuracyMeters: row.latest_accuracy,
  };
}

async function rebuildGpsTrack(database: SQLite.SQLiteDatabase, activityId: string): Promise<void> {
  const points = await database.getAllAsync<SavedGpsPoint>(
    `SELECT ${pointColumns}
     FROM raw_location_points WHERE activity_id = ? ORDER BY timestamp ASC, id ASC`,
    activityId
  );
  const result = validateGpsTrack(points);
  for (let index = 0; index < points.length; index += 1) {
    await database.runAsync(
      'UPDATE raw_location_points SET is_valid = ? WHERE id = ?',
      result.decisions[index].isValid ? 1 : 0,
      points[index].id
    );
  }
  await database.runAsync(
    'UPDATE activities SET distance_meters = ? WHERE id = ?',
    result.distanceMeters,
    activityId
  );
}

export async function saveRawLocationPoint(point: RawLocationPoint): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO raw_location_points
      (id, activity_id, latitude, longitude, altitude, accuracy, speed, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    point.id,
    point.activityId,
    point.latitude,
    point.longitude,
    point.altitude,
    point.accuracy,
    point.speed,
    point.timestamp
  );
}

export async function saveBackgroundPointIfRecording(point: RawLocationPoint): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `INSERT INTO raw_location_points
      (id, activity_id, latitude, longitude, altitude, accuracy, speed, timestamp)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM activities WHERE id = ? AND status = 'recording')
     ON CONFLICT(id) DO NOTHING`,
    point.id,
    point.activityId,
    point.latitude,
    point.longitude,
    point.altitude,
    point.accuracy,
    point.speed,
    point.timestamp,
    point.activityId
  );
  if (result.changes === 1) return true;

  const existing = await database.getFirstAsync<{ id: string }>(
    `SELECT p.id FROM raw_location_points p
     JOIN activities a ON a.id = p.activity_id
     WHERE p.id = ? AND p.activity_id = ? AND a.status = 'recording'`,
    point.id,
    point.activityId
  );
  return existing !== null;
}

export async function getActivityGpsSummary(activityId: string): Promise<GpsSummary> {
  return readGpsSummary(await getDatabase(), activityId);
}

export async function listActivityPointsForSync(activityId: string): Promise<SyncLocationPoint[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    activity_id: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
    timestamp: number;
    is_valid: number | null;
  }>(`
    SELECT id, activity_id, latitude, longitude, altitude, accuracy, speed, timestamp, is_valid
    FROM raw_location_points
    WHERE activity_id = ?
    ORDER BY timestamp, id
  `, activityId);

  return rows.map((row) => ({
    id: row.id,
    activityId: row.activity_id,
    latitude: row.latitude,
    longitude: row.longitude,
    altitude: row.altitude,
    accuracy: row.accuracy,
    speed: row.speed,
    timestamp: row.timestamp,
    isValid: row.is_valid === null ? null : row.is_valid === 1,
  }));
}

export async function classifySavedRawPoint(
  activityId: string,
  pointId: string
): Promise<GpsSummary> {
  const database = await getDatabase();
  let summary: GpsSummary | null = null;
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const point = await transaction.getFirstAsync<SavedGpsPoint>(
      `SELECT ${pointColumns} FROM raw_location_points WHERE activity_id = ? AND id = ?`,
      activityId,
      pointId
    );
    if (!point) throw new Error('Saved GPS point not found.');

    if (point.is_valid === null) {
      const needsRebuild = await transaction.getFirstAsync<{ id: string }>(
        `SELECT id FROM raw_location_points
         WHERE activity_id = ? AND id != ?
           AND (is_valid IS NULL OR timestamp > ? OR (timestamp = ? AND id > ?))
         LIMIT 1`,
        activityId,
        pointId,
        point.timestamp,
        point.timestamp,
        point.id
      );

      if (needsRebuild) {
        await rebuildGpsTrack(transaction, activityId);
      } else {
        const previousValid = await transaction.getFirstAsync<SavedGpsPoint>(
          `SELECT ${pointColumns} FROM raw_location_points
           WHERE activity_id = ? AND is_valid = 1
             AND (timestamp < ? OR (timestamp = ? AND id < ?))
           ORDER BY timestamp DESC, id DESC LIMIT 1`,
          activityId,
          point.timestamp,
          point.timestamp,
          point.id
        );
        const decision = validateGpsPoint(point, previousValid);
        await transaction.runAsync(
          'UPDATE raw_location_points SET is_valid = ? WHERE id = ?',
          decision.isValid ? 1 : 0,
          pointId
        );
        if (decision.distanceMeters > 0) {
          await transaction.runAsync(
            'UPDATE activities SET distance_meters = distance_meters + ? WHERE id = ?',
            decision.distanceMeters,
            activityId
          );
        }
      }
    }
    summary = await readGpsSummary(transaction, activityId);
  });
  if (!summary) throw new Error('Could not classify the saved GPS point.');
  return summary;
}

export async function revalidatePendingActivities(): Promise<void> {
  const database = await getDatabase();
  const activityIds = await database.getAllAsync<{ activity_id: string }>(
    'SELECT DISTINCT activity_id FROM raw_location_points WHERE is_valid IS NULL'
  );
  for (const { activity_id: activityId } of activityIds) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await rebuildGpsTrack(transaction, activityId);
    });
  }
}
