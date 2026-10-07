import type { Activity } from '../types/Activity';
import type { ActivitySyncPayload, SyncLocationPoint } from '../types/Sync';

export function createSyncPayload(
  activity: Activity,
  points: SyncLocationPoint[]
): ActivitySyncPayload {
  if (activity.finishedAt === undefined) throw new Error('An unfinished activity cannot be synced.');
  return {
    id: activity.id,
    startedAt: activity.startedAt,
    finishedAt: activity.finishedAt,
    durationSeconds: activity.durationSeconds,
    distanceMeters: activity.distanceMeters,
    startPhotoTakenAt: activity.startPhotoTakenAt ?? null,
    finishPhotoTakenAt: activity.finishPhotoTakenAt ?? null,
    points,
  };
}

export function assertSyncAcknowledgement(value: unknown, activityId: string): void {
  if (
    !value ||
    typeof value !== 'object' ||
    !('activityId' in value) ||
    value.activityId !== activityId
  ) {
    throw new Error('The API response did not confirm the activity ID.');
  }
}
