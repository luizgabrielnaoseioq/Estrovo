export type Coordinate = { latitude: number; longitude: number };
export type ScreenPoint = { x: number; y: number };

const METERS_PER_DEGREE = 111_195;

export function projectRoute(
  coordinates: Coordinate[],
  width: number,
  height: number,
  padding = 22
): ScreenPoint[] {
  if (coordinates.length === 0 || width <= 0 || height <= 0) return [];

  const longitudeScale =
    METERS_PER_DEGREE * Math.max(0.01, Math.cos((coordinates[0].latitude * Math.PI) / 180));
  const originLatitude = coordinates[0].latitude;
  let previousLongitude = coordinates[0].longitude;
  let unwrappedLongitude = 0;

  const meters = coordinates.map(({ latitude, longitude }) => {
    const step = ((longitude - previousLongitude + 540) % 360) - 180;
    unwrappedLongitude += step;
    previousLongitude = longitude;
    return {
      x: unwrappedLongitude * longitudeScale,
      y: (originLatitude - latitude) * METERS_PER_DEGREE,
    };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of meters) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const scale = Math.min(
    spanX > 0 ? availableWidth / spanX : Infinity,
    spanY > 0 ? availableHeight / spanY : Infinity
  );
  const safeScale = Number.isFinite(scale) ? scale : 1;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return meters.map(({ x, y }) => ({
    x: width / 2 + (x - centerX) * safeScale,
    y: height / 2 + (y - centerY) * safeScale,
  }));
}
