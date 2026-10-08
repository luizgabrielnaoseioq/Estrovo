export type MapBounds = [west: number, south: number, east: number, north: number];

const KM_PER_LATITUDE_DEGREE = 111.195;
const MAX_MAP_LATITUDE = 85.0511;

export function boundsAround(
  latitude: number,
  longitude: number,
  radiusKm: number
): MapBounds | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || radiusKm <= 0) return null;
  const latitudeRadius = radiusKm / KM_PER_LATITUDE_DEGREE;
  const longitudeRadius = latitudeRadius / Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
  const south = Math.max(-MAX_MAP_LATITUDE, latitude - latitudeRadius);
  const north = Math.min(MAX_MAP_LATITUDE, latitude + latitudeRadius);
  const west = longitude - longitudeRadius;
  const east = longitude + longitudeRadius;
  if (west < -180 || east > 180 || south >= north) return null;
  return [west, south, east, north];
}

export function estimateTileCount(bounds: MapBounds, minZoom: number, maxZoom: number): number {
  const [west, south, east, north] = bounds;
  let total = 0;
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) {
    const scale = 2 ** zoom;
    const xWest = Math.floor(((west + 180) / 360) * scale);
    const xEast = Math.floor(((east + 180) / 360) * scale);
    const tileY = (latitude: number) => {
      const radians = (latitude * Math.PI) / 180;
      return Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * scale);
    };
    total += (xEast - xWest + 1) * (tileY(south) - tileY(north) + 1);
  }
  return total;
}
