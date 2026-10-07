import type { Activity } from '../types/Activity';
import type { SyncLocationPoint } from '../types/Sync';

export type SyncResult = {
  synced: number;
  failed: number;
  skipped: 'not_configured' | 'offline' | null;
};

export class SyncHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`The API rejected an activity with HTTP ${status}.`);
    this.status = status;
  }
}

type SyncPorts = {
  isOnline: () => Promise<boolean>;
  listPendingActivityIds: () => Promise<string[]>;
  loadActivity: (id: string) => Promise<Activity | null>;
  loadPoints: (id: string) => Promise<SyncLocationPoint[]>;
  markAttempt: (id: string) => Promise<void>;
  upload: (endpoint: string, activity: Activity, points: SyncLocationPoint[]) => Promise<void>;
  markSynced: (id: string) => Promise<void>;
};

export async function runPendingSync(endpoint: string | null, ports: SyncPorts): Promise<SyncResult> {
  if (!endpoint) return { synced: 0, failed: 0, skipped: 'not_configured' };
  if (!(await ports.isOnline())) return { synced: 0, failed: 0, skipped: 'offline' };

  const result: SyncResult = { synced: 0, failed: 0, skipped: null };
  const activityIds = await ports.listPendingActivityIds();
  for (const activityId of activityIds) {
    try {
      const activity = await ports.loadActivity(activityId);
      if (!activity) throw new Error('A pending sync item has no matching pending activity.');
      const points = await ports.loadPoints(activityId);
      await ports.markAttempt(activityId);
      await ports.upload(endpoint, activity, points);
      await ports.markSynced(activityId);
      result.synced += 1;
    } catch (error) {
      result.failed += 1;
      console.error(`Failed to sync activity ${activityId}:`, error);
      if (!(error instanceof SyncHttpError) || error.status >= 500) break;
    }
  }
  return result;
}
