import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { OfflineManager } from '@maplibre/maplibre-react-native';
import { useNetworkState } from 'expo-network';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { listValidRoutePoints, type RoutePoint } from '../database/repositories/locationPointRepository';
import { projectRoute } from '../utils/routeProjection';
import { StreetRouteMap } from './StreetRouteMap';

type Props = {
  activityId: string;
  refreshKey?: number;
  mapRefreshKey?: number;
  compact?: boolean;
  recording?: boolean;
  preferStreetMap?: boolean;
};

const MAP_HEIGHT = 180;
const MAX_DRAWN_POINTS = 1200;
const ONLINE_STYLE = 'https://tiles.openfreemap.org/styles/bright';
type SavedMap = { bounds: [number, number, number, number]; mapStyle: string };

function pointsForPreview(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= MAX_DRAWN_POINTS) return points;
  const stride = Math.ceil((points.length - 1) / (MAX_DRAWN_POINTS - 1));
  const sampled = points.filter((_, index) => index % stride === 0);
  if (sampled[sampled.length - 1] !== points[points.length - 1]) {
    sampled.push(points[points.length - 1]);
  }
  return sampled;
}

export function RouteMiniMap({ activityId, refreshKey, mapRefreshKey, compact = false, recording = false, preferStreetMap = true }: Props) {
  const network = useNetworkState();
  const [points, setPoints] = useState<RoutePoint[]>([]);
  const [savedMaps, setSavedMaps] = useState<SavedMap[]>([]);
  const [mapFailed, setMapFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    listValidRoutePoints(activityId)
      .then((route) => {
        if (active) {
          setPoints(route);
          setError(false);
        }
      })
      .catch((cause: unknown) => {
        console.error('Failed to load activity route:', cause);
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activityId, refreshKey]);

  useEffect(() => {
    let active = true;
    OfflineManager.getPacks()
      .then(async (packs) => {
        const completed = await Promise.all(packs.map(async (pack) => ({ pack, status: await pack.status() })));
        if (active) {
          setSavedMaps(completed
            .filter(({ pack, status }) => status.state === 'complete' && typeof pack.metadata.mapStyle === 'string')
            .map(({ pack }) => ({
              bounds: pack.bounds,
              mapStyle: pack.metadata.mapStyle as string,
            })));
        }
      })
      .catch((cause: unknown) => console.error('Failed to inspect saved map areas:', cause));
    return () => { active = false; };
  }, [activityId, mapRefreshKey]);

  const savedMapStyle = savedMaps.find(({ bounds }) =>
    points.length > 0 && points.every(({ latitude, longitude }) =>
      longitude >= bounds[0] && latitude >= bounds[1] && longitude <= bounds[2] && latitude <= bounds[3]
    )
  )?.mapStyle;
  const mapStyle = savedMapStyle || (network.isInternetReachable === false
    ? undefined
    : process.env.EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL || ONLINE_STYLE);

  useEffect(() => setMapFailed(false), [mapStyle]);
  const showStreetMap = preferStreetMap && points.length > 0 && !!mapStyle && !mapFailed;

  const drawing = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const projected = projectRoute(pointsForPreview(points), width, MAP_HEIGHT);
    const route = Skia.Path.Make();
    projected.forEach((point, index) => {
      if (index === 0) route.moveTo(point.x, point.y);
      else route.lineTo(point.x, point.y);
    });
    const grid = Skia.Path.Make();
    for (let x = 0; x <= width; x += 40) {
      grid.moveTo(x, 0);
      grid.lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 40) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    return { route, grid, first: projected[0], last: projected[projected.length - 1] };
  }, [points, width]);

  const message = error
    ? 'Não foi possível carregar o trajeto.'
    : loading
      ? 'Carregando trajeto...'
      : points.length === 0
        ? recording
          ? 'Aguardando o primeiro ponto de GPS válido.'
          : 'Esta atividade não tem pontos de GPS válidos.'
        : points.length === 1
          ? 'Primeiro ponto salvo. O traçado aparece após o próximo ponto válido.'
          : null;

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mapa do percurso</Text>
        {recording && <Text style={styles.liveLabel}>AO VIVO</Text>}
      </View>
      <View
        accessibilityLabel={
          points.length > 1
            ? `Percurso com ${points.length} pontos de GPS válidos, do início ao ponto mais recente`
            : 'Área do mapa do percurso'
        }
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={styles.map}
      >
        {showStreetMap && (
          <StreetRouteMap
            mapStyle={mapStyle}
            onLoadError={() => setMapFailed(true)}
            points={pointsForPreview(points)}
          />
        )}
        {!showStreetMap && drawing && (
          <Canvas style={styles.canvas}>
            <Path path={drawing.grid} color="#dfe9df" style="stroke" strokeWidth={1} />
            {points.length > 1 && (
              <>
                <Path path={drawing.route} color="#ffffff" style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" />
                <Path path={drawing.route} color="#227c58" style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" />
              </>
            )}
            <Circle cx={drawing.first.x} cy={drawing.first.y} r={9} color="#ffffff" />
            <Circle cx={drawing.first.x} cy={drawing.first.y} r={6} color="#227c58" />
            {points.length > 1 && (
              <>
                <Circle cx={drawing.last.x} cy={drawing.last.y} r={10} color="#ffffff" />
                <Circle cx={drawing.last.x} cy={drawing.last.y} r={7} color="#e36b42" />
              </>
            )}
          </Canvas>
        )}
        {message && (!showStreetMap || points.length === 0) && <Text style={styles.message}>{message}</Text>}
      </View>
      <View style={styles.footer}>
        <Text style={styles.legend}>● Início     <Text style={styles.endDot}>●</Text> {recording ? 'Agora' : 'Fim'}</Text>
        <Text style={styles.offlineLabel}>
          {showStreetMap
            ? savedMapStyle ? 'Ruas salvas offline' : 'Ruas online'
            : 'Traçado offline, sem ruas'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 16,
    overflow: 'hidden',
    padding: 14,
  },
  compactCard: { borderColor: '#e2e8e5', borderTopWidth: 1, borderRadius: 0, marginTop: 14, paddingHorizontal: 0, paddingBottom: 0 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: '#274c39', fontSize: 17, fontWeight: '700' },
  liveLabel: { color: '#227c58', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  map: { backgroundColor: '#eef4ec', borderRadius: 12, height: MAP_HEIGHT, justifyContent: 'center', overflow: 'hidden' },
  canvas: { height: MAP_HEIGHT, width: '100%' },
  message: {
    alignSelf: 'center',
    color: '#63766a',
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 250,
    padding: 12,
    position: 'absolute',
    textAlign: 'center',
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legend: { color: '#227c58', fontSize: 12, fontWeight: '600' },
  endDot: { color: '#e36b42' },
  offlineLabel: { color: '#7b8b80', fontSize: 11 },
});
