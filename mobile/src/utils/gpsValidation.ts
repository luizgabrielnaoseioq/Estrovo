import { calculateDistance } from './distance.ts';

export type GpsPoint = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
};

export type GpsDecision = {
  isValid: boolean;
  distanceMeters: number;
};

const MAX_ACCURACY_METERS = 50;
const MAX_SPEED_METERS_PER_SECOND = 10;
const MIN_MOVEMENT_METERS = 3;
const UNKNOWN_ACCURACY_MOVEMENT_METERS = 10;

export function validateGpsPoint(point: GpsPoint, previousValid: GpsPoint | null): GpsDecision {
  const invalid = { isValid: false, distanceMeters: 0 };

  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.latitude) > 90 ||
    Math.abs(point.longitude) > 180 ||
    !Number.isFinite(point.timestamp) ||
    (point.accuracy !== null &&
      (!Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > MAX_ACCURACY_METERS)) ||
    (point.speed !== null &&
      (!Number.isFinite(point.speed) || point.speed > MAX_SPEED_METERS_PER_SECOND))
  ) {
    return invalid;
  }

  if (!previousValid) return { isValid: true, distanceMeters: 0 };

  const elapsedSeconds = (point.timestamp - previousValid.timestamp) / 1000;
  if (elapsedSeconds <= 0) return invalid;

  const distanceMeters = calculateDistance(previousValid, point);
  const movementThreshold =
    point.accuracy === null || previousValid.accuracy === null
      ? UNKNOWN_ACCURACY_MOVEMENT_METERS
      : Math.max(MIN_MOVEMENT_METERS, (point.accuracy + previousValid.accuracy) / 2);

  if (
    distanceMeters < movementThreshold ||
    distanceMeters / elapsedSeconds > MAX_SPEED_METERS_PER_SECOND
  ) {
    return invalid;
  }

  return { isValid: true, distanceMeters };
}

export function validateGpsTrack(points: readonly GpsPoint[]): {
  decisions: GpsDecision[];
  distanceMeters: number;
} {
  let previousValid: GpsPoint | null = null;
  let distanceMeters = 0;
  const decisions = points.map((point) => {
    const decision = validateGpsPoint(point, previousValid);
    if (decision.isValid) {
      previousValid = point;
      distanceMeters += decision.distanceMeters;
    }
    return decision;
  });

  return { decisions, distanceMeters };
}
