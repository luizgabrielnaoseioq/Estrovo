import { isRunningInExpoGo } from 'expo';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'treinos-offline-background-location';

export async function canUseBackgroundTracking(): Promise<boolean> {
  return (
    !isRunningInExpoGo() &&
    (await TaskManager.isAvailableAsync()) &&
    (await Location.isBackgroundLocationAvailableAsync())
  );
}

export async function isBackgroundTrackingActive(): Promise<boolean> {
  if (isRunningInExpoGo()) return false;
  return Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}

export async function startBackgroundTracking(): Promise<boolean> {
  if (!(await canUseBackgroundTracking())) return false;
  if ((await Location.getBackgroundPermissionsAsync()).granted !== true) return false;
  if (await isBackgroundTrackingActive()) return true;
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    throw new Error('Background location task is not defined.');
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Treino em andamento',
      notificationBody: 'Registrando sua distância e seu trajeto.',
      notificationColor: '#326E58',
      killServiceOnDestroy: false,
    },
  });
  return true;
}

export async function stopBackgroundTracking(): Promise<void> {
  if (await isBackgroundTrackingActive()) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

export async function reconcileBackgroundTracking(hasRecordingActivity: boolean): Promise<void> {
  if (!hasRecordingActivity) {
    await stopBackgroundTracking();
  } else if (!(await isBackgroundTrackingActive())) {
    await startBackgroundTracking();
  }
}
