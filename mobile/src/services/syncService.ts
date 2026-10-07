import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { getActivitySyncUrl } from '../config/syncConfig';
import { getPendingSyncActivity } from '../database/repositories/activityRepository';
import { listActivityPointsForSync } from '../database/repositories/locationPointRepository';
import {
  listPendingSyncItems,
  markActivitySynced,
  markSyncAttempt,
} from '../database/repositories/syncQueueRepository';
import { runPendingSync, SyncHttpError, type SyncResult } from './runPendingSync';
import { assertSyncAcknowledgement, createSyncPayload } from './syncProtocol';
import type { Activity } from '../types/Activity';
import type { SyncLocationPoint } from '../types/Sync';

function appendPhoto(form: FormData, field: string, uri: string | undefined): void {
  if (!uri) return;
  const file = new File(uri);
  if (!file.exists || file.size === 0) throw new Error(`The ${field} file is missing or empty.`);
  form.append(field, file, file.name);
}

async function uploadActivity(
  endpoint: string,
  activity: Activity,
  points: SyncLocationPoint[]
): Promise<void> {
  const form = new FormData();
  form.append('activity', JSON.stringify(createSyncPayload(activity, points)));
  appendPhoto(form, 'startPhoto', activity.startPhotoUri);
  appendPhoto(form, 'finishPhoto', activity.finishPhotoUri);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await expoFetch(endpoint, {
      method: 'POST',
      headers: { 'Idempotency-Key': activity.id },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) throw new SyncHttpError(response.status);

    assertSyncAcknowledgement(await response.json(), activity.id);
  } finally {
    clearTimeout(timeout);
  }
}

let inFlightSync: Promise<SyncResult> | null = null;

async function runSync(): Promise<SyncResult> {
  const endpoint = getActivitySyncUrl();
  return runPendingSync(endpoint, {
    isOnline: async () => {
      const network = await Network.getNetworkStateAsync();
      return network.isConnected !== false && network.isInternetReachable !== false;
    },
    listPendingActivityIds: async () =>
      (await listPendingSyncItems()).map((item) => item.activityId),
    loadActivity: getPendingSyncActivity,
    loadPoints: listActivityPointsForSync,
    markAttempt: markSyncAttempt,
    upload: uploadActivity,
    markSynced: markActivitySynced,
  });
}

export function syncPendingActivities(): Promise<SyncResult> {
  if (inFlightSync) return inFlightSync;
  const task = runSync();
  inFlightSync = task;
  void task.finally(() => {
    if (inFlightSync === task) inFlightSync = null;
  }).catch(() => {});
  return task;
}
