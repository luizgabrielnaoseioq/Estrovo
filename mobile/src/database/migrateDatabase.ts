import type { SQLiteDatabase } from 'expo-sqlite';
import { createActivitiesSql } from './migrations/001_createActivities';
import { oneRecordingActivitySql } from './migrations/002_oneRecordingActivity';
import { createRawLocationPointsSql } from './migrations/003_createRawLocationPoints';
import { addPhotoTimesSql } from './migrations/004_addPhotoTimes';
import { createSyncQueueSql } from './migrations/005_createSyncQueue';

const SCHEMA_VERSION = 5;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > SCHEMA_VERSION) {
    throw new Error('The database schema is newer than this app version.');
  }

  if (currentVersion < SCHEMA_VERSION) {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (currentVersion < 1) {
        await transaction.execAsync(createActivitiesSql);
      }
      if (currentVersion < 2) {
        await transaction.execAsync(oneRecordingActivitySql);
      }
      if (currentVersion < 3) {
        await transaction.execAsync(createRawLocationPointsSql);
      }
      if (currentVersion < 4) {
        await transaction.execAsync(addPhotoTimesSql);
      }
      if (currentVersion < 5) {
        await transaction.execAsync(createSyncQueueSql);
      }
      await transaction.execAsync('PRAGMA user_version = 5');
    });
  }
}
