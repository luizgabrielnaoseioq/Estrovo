import { Camera, GeoJSONSource, Layer, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { RoutePoint } from '../database/repositories/locationPointRepository';

type Props = {
  points: RoutePoint[];
  mapStyle: string;
  onLoadError: () => void;
};

function marker(point: RoutePoint): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Point', coordinates: [point.longitude, point.latitude] },
  };
}

export function StreetRouteMap({ points, mapStyle, onLoadError }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const first = points[0];
  const last = points[points.length - 1];
  const route = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: points.map((point) => [point.longitude, point.latitude]),
      },
    }),
    [points]
  );
  const bounds = useMemo(() => {
    if (points.length === 1) return null;
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const point of points) {
      west = Math.min(west, point.longitude);
      east = Math.max(east, point.longitude);
      south = Math.min(south, point.latitude);
      north = Math.max(north, point.latitude);
    }
    const longitudePadding = Math.max(0.001, (east - west) * 0.12);
    const latitudePadding = Math.max(0.001, (north - south) * 0.12);
    return [west - longitudePadding, south - latitudePadding, east + longitudePadding, north + latitudePadding] as [number, number, number, number];
  }, [points]);
  const initialViewState = useMemo(() => {
    if (points.length === 1) {
      return { center: [first.longitude, first.latitude] as [number, number], zoom: 15 };
    }
    return { bounds: bounds! };
  }, [bounds, first.latitude, first.longitude, points.length]);

  useEffect(() => {
    if (mapReady && bounds) {
      cameraRef.current?.fitBounds(bounds, { duration: 350, padding: { top: 18, right: 18, bottom: 18, left: 18 } });
    }
  }, [bounds, mapReady]);

  return (
    <Map
      attribution
      compass={false}
      doubleTapHoldZoom={false}
      doubleTapZoom={false}
      dragPan={false}
      mapStyle={mapStyle}
      onDidFailLoadingMap={onLoadError}
      onDidFinishLoadingMap={() => setMapReady(true)}
      style={styles.map}
      touchPitch={false}
      touchRotate={false}
      touchZoom={false}
    >
      <Camera initialViewState={initialViewState} ref={cameraRef} />
      {points.length > 1 && (
        <GeoJSONSource id="activity-route" data={route}>
          <Layer id="activity-route-outline" type="line" paint={{ 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.95 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
          <Layer id="activity-route-line" type="line" paint={{ 'line-color': '#227c58', 'line-width': 5 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource>
      )}
      <GeoJSONSource id="activity-start" data={marker(first)}>
        <Layer id="activity-start-outline" type="circle" paint={{ 'circle-radius': 8, 'circle-color': '#ffffff' }} />
        <Layer id="activity-start-dot" type="circle" paint={{ 'circle-radius': 5, 'circle-color': '#227c58' }} />
      </GeoJSONSource>
      {points.length > 1 && (
        <GeoJSONSource id="activity-end" data={marker(last)}>
          <Layer id="activity-end-outline" type="circle" paint={{ 'circle-radius': 9, 'circle-color': '#ffffff' }} />
          <Layer id="activity-end-dot" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#e36b42' }} />
        </GeoJSONSource>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({ map: { flex: 1 } });
