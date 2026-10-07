import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  finishActivity,
  getRecordingActivity,
  startActivity,
} from './database/repositories/activityRepository';
import { revalidatePendingActivities } from './database/repositories/locationPointRepository';
import { useActivitySync } from './hooks/useActivitySync';
import { ActivityScreen } from './screens/ActivityScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RecoveryScreen } from './screens/RecoveryScreen';
import { captureActivityPhoto, discardActivityPhoto } from './services/activityPhotoService';
import {
  reconcileBackgroundTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './services/backgroundLocationService';
import { getDatabase } from './services/databaseService';
import {
  requestActivityLocationPermission,
  requestBackgroundTrackingPermission,
} from './services/locationService';
import type { Activity, ActivityPhoto } from './types/Activity';

type DatabaseStatus = 'loading' | 'ready' | 'error';

export default function App() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>('loading');
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [recoveryActivity, setRecoveryActivity] = useState<Activity | null>(null);
  const [syncRevision, setSyncRevision] = useState(0);

  useActivitySync(
    databaseStatus === 'ready' && activeActivity === null && recoveryActivity === null,
    () => setSyncRevision((revision) => revision + 1)
  );

  useEffect(() => {
    let isMounted = true;

    getDatabase()
      .then(async (database) => {
        const table = await database.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'activities'"
        );
        if (table?.name !== 'activities') {
          throw new Error('Activities table is missing.');
        }
        await revalidatePendingActivities();
        const recording = await getRecordingActivity();
        try {
          await reconcileBackgroundTracking(recording !== null);
        } catch (error) {
          console.error('Failed to reconcile background tracking:', error);
        }
        return recording;
      })
      .then((recording) => {
        if (isMounted) {
          setRecoveryActivity(recording);
          setDatabaseStatus('ready');
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize the local database:', error);
        if (isMounted) {
          setDatabaseStatus('error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStartActivity() {
    const existing = await getRecordingActivity();
    if (existing) {
      setActiveActivity(existing);
      return;
    }
    await requestActivityLocationPermission();
    const backgroundPermissionGranted = await requestBackgroundTrackingPermission();
    const photo = await captureActivityPhoto('start');
    if (!photo) return;
    let activity: Activity;
    try {
      activity = await startActivity(photo);
    } catch (error) {
      discardActivityPhoto(photo);
      throw error;
    }
    if (activity.startPhotoUri !== photo.uri) discardActivityPhoto(photo);
    if (backgroundPermissionGranted) {
      try {
        await startBackgroundTracking();
      } catch (error) {
        console.error('Failed to start background tracking:', error);
      }
    }
    setActiveActivity(activity);
  }

  async function handleFinishActivity(photo: ActivityPhoto) {
    if (!activeActivity) throw new Error('No recording activity to finish.');
    await finishActivity(activeActivity.id, photo);
    setActiveActivity(null);
  }

  function handleContinueRecoveredActivity() {
    if (!recoveryActivity) return;
    setActiveActivity(recoveryActivity);
    setRecoveryActivity(null);
  }

  async function handleFinishRecoveredActivity() {
    if (!recoveryActivity) throw new Error('No recording activity to recover.');
    const photo = await captureActivityPhoto('finish');
    if (!photo) return;

    let trackingStopped = false;
    try {
      await stopBackgroundTracking();
      trackingStopped = true;
      await revalidatePendingActivities();
      await finishActivity(recoveryActivity.id, photo);
      setRecoveryActivity(null);
    } catch (error) {
      discardActivityPhoto(photo);
      if (trackingStopped) {
        try {
          await startBackgroundTracking();
        } catch (resumeError) {
          console.error('Failed to resume recovered activity tracking:', resumeError);
        }
      }
      throw error;
    }
  }

  return (
    <SafeAreaProvider>
      {databaseStatus === 'ready' ? (
        activeActivity ? (
          <ActivityScreen activity={activeActivity} onFinishActivity={handleFinishActivity} />
        ) : recoveryActivity ? (
          <RecoveryScreen
            activity={recoveryActivity}
            onContinue={handleContinueRecoveredActivity}
            onFinish={handleFinishRecoveredActivity}
          />
        ) : (
          <HomeScreen onStartActivity={handleStartActivity} refreshKey={syncRevision} />
        )
      ) : (
        <View style={styles.messageContainer}>
          <Text style={styles.message}>
            {databaseStatus === 'loading'
              ? 'Preparando banco local...'
              : 'Não foi possível abrir o banco local.'}
          </Text>
        </View>
      )}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  messageContainer: {
    flex: 1,
    backgroundColor: '#f6f8f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { color: '#365448', fontSize: 16 },
});
