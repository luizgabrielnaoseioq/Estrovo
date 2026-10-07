import * as Crypto from 'expo-crypto';
import type * as Location from 'expo-location';
import {
  classifySavedRawPoint,
  getActivityGpsSummary,
  saveRawLocationPoint,
  type GpsSummary,
} from '../database/repositories/locationPointRepository';
import type { RawLocationPoint } from '../types/LocationPoint';
import {
  isBackgroundTrackingActive,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './backgroundLocationService';
import { watchActivityLocation } from './locationService';

type RecorderCallbacks = {
  onLocation: (accuracyMeters: number | null) => void;
  onGpsError: () => void;
  onGpsSummary: (summary: GpsSummary) => void;
  onTrackingMode: (backgroundActive: boolean) => void;
  onSaveError: () => void;
  onSaveRecovered: () => void;
};

export class ActivityLocationRecorder {
  private readonly pendingPoints: RawLocationPoint[] = [];
  private subscription: Location.LocationSubscription | null = null;
  private watchPromise: Promise<void> | null = null;
  private flushPromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private mode: 'background' | 'foreground' = 'foreground';
  private paused = false;
  private disposed = false;

  constructor(
    private readonly activityId: string,
    private readonly callbacks: RecorderCallbacks
  ) {}

  async start(): Promise<void> {
    try {
      await this.refreshSummary();
    } catch (error) {
      console.error('Failed to load saved location points:', error);
      if (!this.disposed) this.callbacks.onSaveError();
      return;
    }
    if (this.disposed) return;
    let backgroundActive = false;
    try {
      backgroundActive = await isBackgroundTrackingActive();
    } catch (error) {
      console.error('Failed to check background tracking:', error);
    }
    if (this.disposed) return;
    if (backgroundActive) {
      this.mode = 'background';
      this.callbacks.onTrackingMode(true);
      this.startRefreshing();
    } else {
      this.callbacks.onTrackingMode(false);
      await this.ensureWatching();
    }
  }

  refreshSummary(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    const task = getActivityGpsSummary(this.activityId).then((summary) => {
      if (this.disposed) return;
      this.callbacks.onGpsSummary(summary);
      if (summary.latestAccuracyMeters !== null) {
        this.callbacks.onLocation(summary.latestAccuracyMeters);
      }
    });
    this.refreshPromise = task;
    void task.finally(() => {
      this.refreshPromise = null;
    }).catch(() => {});
    return task;
  }

  private startRefreshing(): void {
    if (this.refreshTimer || this.disposed || this.paused) return;
    this.refreshTimer = setInterval(() => {
      void this.refreshSummary().catch((error: unknown) => {
        console.error('Failed to refresh background GPS summary:', error);
        if (!this.disposed) this.callbacks.onSaveError();
      });
    }, 3000);
  }

  private stopRefreshing(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  private async ensureWatching(): Promise<void> {
    try {
      await this.startWatching();
    } catch {
      if (!this.disposed && !this.paused) this.callbacks.onGpsError();
    }
  }

  private startWatching(): Promise<void> {
    if (this.disposed || this.paused || this.subscription) return Promise.resolve();
    if (this.watchPromise) return this.watchPromise;

    const task = watchActivityLocation(
      (location) => this.handleLocation(location),
      () => {
        if (!this.disposed && !this.paused) this.callbacks.onGpsError();
      }
    ).then((subscription) => {
      if (this.disposed || this.paused) subscription.remove();
      else this.subscription = subscription;
    });

    this.watchPromise = task;
    void task.finally(() => {
      this.watchPromise = null;
    }).catch(() => {});
    return task;
  }

  private handleLocation(location: Location.LocationObject): void {
    if (this.disposed || this.paused) return;

    this.callbacks.onLocation(location.coords.accuracy);
    this.pendingPoints.push({
      id: Crypto.randomUUID(),
      activityId: this.activityId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      timestamp: location.timestamp,
    });
    void this.flush().catch(() => {});
  }

  private flush(): Promise<void> {
    if (this.flushPromise) return this.flushPromise;

    const task = (async () => {
      while (this.pendingPoints.length > 0) {
        const point = this.pendingPoints[0];
        await saveRawLocationPoint(point);
        const summary = await classifySavedRawPoint(this.activityId, point.id);
        this.pendingPoints.shift();
        if (!this.disposed) {
          this.callbacks.onGpsSummary(summary);
          this.callbacks.onSaveRecovered();
        }
      }
    })();

    this.flushPromise = task;
    void task.then(
      () => {
        this.flushPromise = null;
        if (this.pendingPoints.length > 0 && !this.paused) {
          void this.flush().catch(() => {});
        }
      },
      () => {
        this.flushPromise = null;
        if (!this.disposed) this.callbacks.onSaveError();
      }
    );
    return task;
  }

  async pauseAndFlush(): Promise<void> {
    this.paused = true;
    this.stopRefreshing();
    this.subscription?.remove();
    this.subscription = null;
    await this.watchPromise?.catch(() => {});
    if (this.mode === 'background') await stopBackgroundTracking();
    await this.flush();
    await this.refreshPromise;
  }

  async resume(): Promise<void> {
    if (this.disposed) return;
    this.paused = false;
    void this.flush().catch(() => {});
    if (this.mode === 'background') {
      try {
        if (await startBackgroundTracking()) {
          this.startRefreshing();
          return;
        }
      } catch (error) {
        console.error('Failed to resume background tracking:', error);
      }
      this.mode = 'foreground';
      this.callbacks.onTrackingMode(false);
    }
    await this.ensureWatching();
  }

  dispose(): void {
    this.disposed = true;
    this.paused = true;
    this.stopRefreshing();
    this.subscription?.remove();
    this.subscription = null;
    if (this.pendingPoints.length > 0) void this.flush().catch(() => {});
  }
}
