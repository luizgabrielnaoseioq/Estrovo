import * as Crypto from 'expo-crypto';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getRecordingActivity } from '../database/repositories/activityRepository';
import {
  classifySavedRawPoint,
  saveBackgroundPointIfRecording,
} from '../database/repositories/locationPointRepository';
import { BACKGROUND_LOCATION_TASK, stopBackgroundTracking } from './backgroundLocationService';

type LocationTaskData = { locations: Location.LocationObject[] };

async function processLocations(data: LocationTaskData | undefined): Promise<void> {
  const activity = await getRecordingActivity();
  if (!activity) {
    await stopBackgroundTracking();
    return;
  }
  if (!data?.locations?.length) return;

  const locations = [...data.locations].sort((first, second) => first.timestamp - second.timestamp);
  for (const location of locations) {
    const fingerprint = `${activity.id}|${location.timestamp}|${location.coords.latitude}|${location.coords.longitude}`;
    const id = `bg-${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, fingerprint)}`;
    const saved = await saveBackgroundPointIfRecording({
      id,
      activityId: activity.id,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    });
    if (!saved) return;
    await classifySavedRawPoint(activity.id, id);
  }
}

TaskManager.defineTask<LocationTaskData>(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task failed:', error);
    return;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await processLocations(data);
      return;
    } catch (taskError) {
      if (attempt === 3 || !String(taskError).includes('database is locked')) throw taskError;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
});
