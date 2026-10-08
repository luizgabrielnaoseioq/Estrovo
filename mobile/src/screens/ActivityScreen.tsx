import { useEffect, useRef, useState } from 'react';
import { AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMiniMap } from '../components/RouteMiniMap';
import { SavePhotoButton } from '../components/SavePhotoButton';
import type { GpsSummary } from '../database/repositories/locationPointRepository';
import {
  captureActivityPhoto,
  discardActivityPhoto,
  PhotoCaptureError,
} from '../services/activityPhotoService';
import { ActivityLocationRecorder } from '../services/activityLocationRecorder';
import type { Activity, ActivityPhoto } from '../types/Activity';

type Props = {
  activity: Activity;
  onFinishActivity: (photo: ActivityPhoto) => Promise<void>;
};

function getElapsedSeconds(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatElapsed(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export function ActivityScreen({ activity, onFinishActivity }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => getElapsedSeconds(activity.startedAt));
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'waiting' | 'receiving' | 'error'>('waiting');
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [gpsSummary, setGpsSummary] = useState<GpsSummary | null>(null);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const recorderRef = useRef<ActivityLocationRecorder | null>(null);

  useEffect(() => {
    const updateElapsed = () => setElapsedSeconds(getElapsedSeconds(activity.startedAt));
    const timer = setInterval(updateElapsed, 1000);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      updateElapsed();
      if (state === 'active') {
        void recorderRef.current?.refreshSummary().catch(() => setSaveError(true));
      }
    });

    return () => {
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [activity.startedAt]);

  useEffect(() => {
    const recorder = new ActivityLocationRecorder(activity.id, {
      onLocation: (accuracy) => {
        setAccuracyMeters(accuracy);
        setGpsStatus('receiving');
      },
      onGpsError: () => setGpsStatus('error'),
      onGpsSummary: setGpsSummary,
      onTrackingMode: setBackgroundActive,
      onSaveError: () => setSaveError(true),
      onSaveRecovered: () => setSaveError(false),
    });
    recorderRef.current = recorder;
    void recorder.start();

    return () => {
      if (recorderRef.current === recorder) recorderRef.current = null;
      recorder.dispose();
    };
  }, [activity.id]);

  const gpsMessage =
    gpsStatus === 'waiting'
      ? 'Aguardando sinal'
      : gpsStatus === 'error'
        ? 'Sinal indisponível'
        : accuracyMeters === null
          ? 'Sinal recebido'
          : `Precisão ~${Math.round(accuracyMeters)} m`;

  async function handleFinishActivity() {
    if (isFinishing) return;
    setIsFinishing(true);
    setFinishError(null);
    let photo: ActivityPhoto | null = null;
    let pauseRequested = false;

    try {
      photo = await captureActivityPhoto('finish');
      if (!photo) return;
      pauseRequested = true;
      await recorderRef.current?.pauseAndFlush();
      await onFinishActivity(photo);
    } catch (error) {
      if (photo) discardActivityPhoto(photo);
      if (!(error instanceof PhotoCaptureError)) console.error('Failed to finish activity:', error);
      setFinishError(
        error instanceof PhotoCaptureError ? error.message : 'Não foi possível finalizar. Tente novamente.'
      );
      if (pauseRequested) {
        try {
          await recorderRef.current?.resume();
        } catch (resumeError) {
          console.error('Failed to resume location recording:', resumeError);
          setGpsStatus('error');
        }
      }
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ATIVIDADE EM ANDAMENTO</Text>
        <Text style={styles.title}>Seu treino</Text>
        <Text style={styles.description}>
          {activity.startPhotoUri
            ? 'O início e a foto foram salvos no aparelho.'
            : 'O início foi salvo no aparelho.'}
        </Text>

        <View style={styles.timeCard}>
          <Text style={styles.label}>TEMPO</Text>
          <Text style={styles.timeValue}>{formatElapsed(elapsedSeconds)}</Text>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.label}>DISTÂNCIA</Text>
            <Text style={styles.metricValue}>
              {gpsSummary === null || gpsSummary.validCount === 0
                ? '—'
                : formatDistance(gpsSummary.distanceMeters)}
            </Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.label}>GPS</Text>
            <Text style={styles.metricNote}>{gpsMessage}</Text>
          </View>
        </View>

        {activity.startPhotoUri && (
          <View style={styles.photoCard}>
            <Image
              accessibilityLabel="Foto do início da atividade"
              source={{ uri: activity.startPhotoUri }}
              style={styles.photoImage}
            />
            <View style={styles.photoDetails}>
              <Text style={styles.photoTitle}>Foto inicial</Text>
              <Text style={styles.photoTime}>
                {activity.startPhotoTakenAt
                  ? `Capturada às ${new Date(activity.startPhotoTakenAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Salva no aparelho'}
              </Text>
              <SavePhotoButton key={activity.startPhotoUri} uri={activity.startPhotoUri} label="inicial" />
            </View>
          </View>
        )}

        <RouteMiniMap activityId={activity.id} refreshKey={gpsSummary?.validCount} recording />

        <View style={styles.localCard}>
          <Text style={styles.localTitle}>Registro local</Text>
          <Text style={styles.savedCount}>
            {gpsSummary === null
              ? 'Preparando armazenamento dos pontos...'
              : `${gpsSummary.savedCount} ${gpsSummary.savedCount === 1 ? 'ponto salvo' : 'pontos salvos'} · ${gpsSummary.validCount} ${gpsSummary.validCount === 1 ? 'válido' : 'válidos'} · ${gpsSummary.ignoredCount} ${gpsSummary.ignoredCount === 1 ? 'ignorado' : 'ignorados'}`}
          </Text>
          <Text style={styles.localDescription}>
            A distância filtrada é salva no aparelho a cada ponto válido. Leituras imprecisas,
            saltos de GPS e pequenas oscilações são ignorados.
            {backgroundActive
              ? ' O rastreamento continua com a tela bloqueada.'
              : ' Nesta atividade, o rastreamento funciona somente com o app aberto.'}
          </Text>
          {saveError && (
            <Text style={styles.error}>
              Falha ao salvar um ponto. O app tentará novamente na próxima leitura ou ao finalizar.
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          {finishError && <Text style={styles.error}>{finishError}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isFinishing }}
            disabled={isFinishing}
            onPress={() => void handleFinishActivity()}
            style={[styles.finishButton, isFinishing && styles.finishButtonDisabled]}
          >
            <Text style={styles.finishButtonText}>
              {isFinishing ? 'FINALIZANDO...' : 'TIRAR FOTO E FINALIZAR'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f6f8f5', flex: 1 },
  content: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 24, paddingTop: 32 },
  eyebrow: { color: '#648575', fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#172721', fontSize: 38, fontWeight: '700', marginTop: 10 },
  description: { color: '#5d7065', fontSize: 16, lineHeight: 23, marginTop: 8 },
  timeCard: {
    backgroundColor: '#e3eee6',
    borderRadius: 20,
    marginTop: 32,
    padding: 24,
  },
  label: { color: '#638272', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  timeValue: { color: '#173b2b', fontSize: 48, fontWeight: '700', marginTop: 12 },
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  metricCard: { backgroundColor: '#fff', borderRadius: 18, flex: 1, minHeight: 118, padding: 18 },
  metricValue: { color: '#243f31', fontSize: 28, fontWeight: '700', marginTop: 12 },
  metricNote: { color: '#53695b', fontSize: 15, fontWeight: '600', marginTop: 15 },
  photoCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    padding: 12,
  },
  photoImage: { width: 82, height: 82, borderRadius: 12 },
  photoDetails: { flex: 1 },
  photoTitle: { color: '#274c39', fontSize: 17, fontWeight: '700' },
  photoTime: { color: '#63766a', fontSize: 14, marginTop: 5 },
  localCard: {
    borderColor: '#d7e4da',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    padding: 18,
  },
  localTitle: { color: '#274c39', fontSize: 16, fontWeight: '700' },
  savedCount: { color: '#274c39', fontSize: 18, fontWeight: '700', marginTop: 10 },
  localDescription: { color: '#63766a', fontSize: 14, lineHeight: 21, marginTop: 6 },
  footer: { marginTop: 'auto', paddingTop: 32 },
  error: { color: '#8b443b', fontSize: 14, marginBottom: 12 },
  finishButton: {
    alignItems: 'center',
    backgroundColor: '#213c2e',
    borderRadius: 16,
    paddingVertical: 20,
  },
  finishButtonDisabled: { backgroundColor: '#8ca99a' },
  finishButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
});
