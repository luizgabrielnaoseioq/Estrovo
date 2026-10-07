export type Coordinates = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function calculateDistance(pointA: Coordinates, pointB: Coordinates): number {
  const latitudeA = toRadians(pointA.latitude);
  const latitudeB = toRadians(pointB.latitude);
  const latitudeChange = latitudeB - latitudeA;
  const longitudeChange = toRadians(pointB.longitude - pointA.longitude);

  const haversine =
    Math.sin(latitudeChange / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeChange / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function calculatePathDistance(points: readonly Coordinates[]): number {
  let totalMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalMeters += calculateDistance(points[index - 1], points[index]);
  }
  return totalMeters;
}
