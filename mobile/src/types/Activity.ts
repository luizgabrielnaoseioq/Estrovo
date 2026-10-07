export type ActivityStatus = 'recording' | 'finished' | 'pending_sync' | 'synced';

export interface ActivityPhoto {
  uri: string;
  capturedAt: number;
}

export interface Activity {
  id: string;
  startedAt: number;
  finishedAt?: number;
  durationSeconds: number;
  distanceMeters: number;
  hasValidGpsPoint: boolean;
  startPhotoUri?: string;
  startPhotoTakenAt?: number;
  finishPhotoUri?: string;
  finishPhotoTakenAt?: number;
  status: ActivityStatus;
  createdAt: number;
}
