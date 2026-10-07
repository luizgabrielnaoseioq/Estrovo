import type { RawLocationPoint } from './LocationPoint';

export type SyncLocationPoint = RawLocationPoint & { isValid: boolean | null };

export type ActivitySyncPayload = {
  id: string;
  startedAt: number;
  finishedAt: number;
  durationSeconds: number;
  distanceMeters: number;
  startPhotoTakenAt: number | null;
  finishPhotoTakenAt: number | null;
  points: SyncLocationPoint[];
};
