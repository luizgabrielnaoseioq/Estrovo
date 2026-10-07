import { getDatabase } from '../../services/databaseService';

export type PendingSyncItem = {
  id: string;
  activityId: string;
  attempts: number;
  lastAttemptAt: number | null;
};

type PendingSyncRow = {
  id: string;
  activity_id: string;
  attempts: number;
  last_attempt_at: number | null;
};

export async function listPendingSyncItems(): Promise<PendingSyncItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PendingSyncRow>(`
    SELECT id, activity_id, attempts, last_attempt_at
    FROM sync_queue
    WHERE status = 'pending'
    ORDER BY created_at, id
  `);

  return rows.map((row) => ({
    id: row.id,
    activityId: row.activity_id,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
  }));
}

export async function markSyncAttempt(activityId: string): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE sync_queue
     SET attempts = attempts + 1, last_attempt_at = ?
     WHERE activity_id = ? AND status = 'pending'`,
    Date.now(),
    activityId
  );
  if (result.changes !== 1) throw new Error('No pending sync item for this activity.');
}

export async function markActivitySynced(activityId: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const queueResult = await transaction.runAsync(
      `UPDATE sync_queue SET status = 'synced'
       WHERE activity_id = ? AND status = 'pending'`,
      activityId
    );
    if (queueResult.changes !== 1) throw new Error('No pending sync item for this activity.');

    const activityResult = await transaction.runAsync(
      `UPDATE activities SET status = 'synced'
       WHERE id = ? AND status = 'pending_sync'`,
      activityId
    );
    if (activityResult.changes !== 1) throw new Error('The activity is not pending sync.');
  });
}
