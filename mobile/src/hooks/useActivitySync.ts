import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { getActivitySyncUrl } from '../config/syncConfig';
import { syncPendingActivities } from '../services/syncService';

export function useActivitySync(enabled: boolean, onSynced: () => void): void {
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!getActivitySyncUrl()) return;
    } catch (error) {
      console.error('Invalid sync API configuration:', error);
      return;
    }
    let mounted = true;

    function sync() {
      void syncPendingActivities()
        .then((result) => {
          if (mounted && result.synced > 0) onSyncedRef.current();
        })
        .catch((error: unknown) => console.error('Could not check pending activities:', error));
    }

    sync();
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected !== false && state.isInternetReachable !== false) sync();
    });
    const appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    return () => {
      mounted = false;
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [enabled]);
}
