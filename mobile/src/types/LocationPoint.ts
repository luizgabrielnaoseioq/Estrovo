export interface RawLocationPoint {
  id: string;
  activityId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

export type RawPointCoordinate = Pick<
  RawLocationPoint,
  'id' | 'latitude' | 'longitude' | 'timestamp'
>;
