import { OfflineManager, type OfflinePack, type OfflinePackStatus } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { boundsAround, estimateTileCount } from '../utils/offlineMapRegion';

type Props = { onComplete: () => void };

const RADIUS_KM = 90;
const MIN_ZOOM = 5;
const TILE_LIMIT = 10_000;
const mapStyle = process.env.EXPO_PUBLIC_OFFLINE_MAP_STYLE_URL?.trim();

function confirmDownload(tileCount: number, maxZoom: number): Promise<boolean> {
  return new Promise((resolve) => Alert.alert(
    'Baixar ruas para usar offline',
    `O download cobre 90 km ao redor da sua localização atual, até o nível ${maxZoom} (${tileCount.toLocaleString('pt-BR')} blocos de mapa). Pode consumir centenas de MB. Conecte-se ao Wi-Fi e deixe espaço livre no aparelho.`,
    [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Baixar', onPress: () => resolve(true) },
    ],
    { cancelable: true, onDismiss: () => resolve(false) }
  ));
}

export function OfflineMapDownload({ onComplete }: Props) {
  const [pack, setPack] = useState<OfflinePack | null>(null);
  const [packStatus, setPackStatus] = useState<OfflinePackStatus | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const subscribedPackId = useRef<string | null>(null);

  const onProgress = useCallback((updatedPack: OfflinePack, status: OfflinePackStatus) => {
    setPackStatus(status);
    if (status.state === 'complete') {
      setPack(null);
      setSavedCount((count) => count + 1);
      OfflineManager.removeListener(updatedPack.id);
      subscribedPackId.current = null;
      onComplete();
    }
  }, [onComplete]);

  const onDownloadError = useCallback((_pack: OfflinePack, reason: { message: string }) => {
    setError(reason.message || 'O download do mapa falhou. Tente novamente.');
  }, []);

  useEffect(() => {
    let active = true;
    OfflineManager.getPacks()
      .then(async (packs) => {
        const statuses = await Promise.all(packs.map(async (candidate) => ({
          candidate,
          status: await candidate.status(),
        })));
        if (!active) return;
        setSavedCount(statuses.filter(({ status }) => status.state === 'complete').length);
        const unfinished = statuses.find(({ candidate, status }) =>
          candidate.metadata.source === 'estrovo' && status.state !== 'complete'
        );
        if (unfinished) {
          setPack(unfinished.candidate);
          setPackStatus(unfinished.status);
          subscribedPackId.current = unfinished.candidate.id;
          void OfflineManager.addListener(unfinished.candidate.id, onProgress, onDownloadError)
            .catch((cause: unknown) => console.error('Failed to follow map download:', cause));
        }
      })
      .catch((cause: unknown) => console.error('Failed to load offline map packs:', cause));
    return () => {
      active = false;
      if (subscribedPackId.current) OfflineManager.removeListener(subscribedPackId.current);
      subscribedPackId.current = null;
    };
  }, [onDownloadError, onProgress]);

  if (!mapStyle) return null;

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (pack) {
        if (packStatus?.state === 'active') {
          await pack.pause();
          setPackStatus(await pack.status());
        } else {
          await pack.resume();
          setPackStatus(await pack.status());
        }
        return;
      }
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Permita a localização para escolher a área do mapa.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const bounds = boundsAround(position.coords.latitude, position.coords.longitude, RADIUS_KM);
      if (!bounds) {
        setError('Não foi possível definir uma área de 90 km nesta posição.');
        return;
      }
      const existingPacks = await OfflineManager.getPacks();
      for (const existing of existingPacks) {
        const [west, south, east, north] = existing.bounds;
        if (
          existing.metadata.mapStyle === mapStyle &&
          west <= bounds[0] && south <= bounds[1] && east >= bounds[2] && north >= bounds[3] &&
          (await existing.status()).state === 'complete'
        ) {
          setMessage('Esta área já está salva no aparelho.');
          return;
        }
      }
      let maxZoom = 14;
      while (maxZoom > 11 && estimateTileCount(bounds, MIN_ZOOM, maxZoom) > TILE_LIMIT) {
        maxZoom -= 1;
      }
      const tileCount = estimateTileCount(bounds, MIN_ZOOM, maxZoom);
      if (!(await confirmDownload(tileCount, maxZoom))) return;

      OfflineManager.setTileCountLimit(TILE_LIMIT);
      const createdPack = await OfflineManager.createPack(
        {
          mapStyle: mapStyle!,
          bounds,
          minZoom: MIN_ZOOM,
          maxZoom,
          metadata: {
            source: 'estrovo',
            mapStyle,
            radiusKm: RADIUS_KM,
            center: [position.coords.longitude, position.coords.latitude],
          },
        },
        onProgress,
        onDownloadError
      );
      subscribedPackId.current = createdPack.id;
      setPack(createdPack);
      setPackStatus(await createdPack.status());
    } catch (cause) {
      console.error('Failed to download offline map:', cause);
      setError('Não foi possível baixar o mapa. Confira a conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const actionLabel = busy
    ? 'PREPARANDO...'
    : packStatus?.state === 'active'
      ? 'PAUSAR DOWNLOAD'
      : pack
        ? 'CONTINUAR DOWNLOAD'
        : 'BAIXAR MAPA AO REDOR (90 KM)';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mapa offline</Text>
      <Text style={styles.description}>
        Baixe as ruas próximas da sua localização antes de sair. O percurso e a distância já são salvos mesmo sem mapa baixado.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void handleDownload()}
        style={[styles.button, busy && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>{actionLabel}</Text>
      </Pressable>
      {packStatus?.state === 'active' && (
        <Text style={styles.status}>
          Baixando: {packStatus.completedResourceCount.toLocaleString('pt-BR')}
          {packStatus.requiredResourceCount > 0
            ? ` de ${packStatus.requiredResourceCount.toLocaleString('pt-BR')}`
            : ''} recursos
        </Text>
      )}
      {savedCount > 0 && (
        <Text style={styles.status}>
          {savedCount} {savedCount === 1 ? 'área salva' : 'áreas salvas'} no aparelho
        </Text>
      )}
      {message && <Text style={styles.status}>{message}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#e3eee6', borderRadius: 18, marginTop: 28, padding: 18 },
  title: { color: '#274c39', fontSize: 18, fontWeight: '700' },
  description: { color: '#53695b', fontSize: 14, lineHeight: 20, marginTop: 7 },
  button: { alignItems: 'center', backgroundColor: '#326e58', borderRadius: 12, marginTop: 14, paddingVertical: 14 },
  buttonDisabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  status: { color: '#53695b', fontSize: 13, marginTop: 10 },
  error: { color: '#8b443b', fontSize: 13, marginTop: 10 },
});
