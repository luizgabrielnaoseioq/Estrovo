import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteMiniMap } from '../components/RouteMiniMap';
import { SavePhotoButton } from '../components/SavePhotoButton';
import { PhotoCaptureError } from '../services/activityPhotoService';
import type { Activity } from '../types/Activity';

type Props = {
  activity: Activity;
  onContinue: () => void;
  onFinish: () => Promise<void>;
};

function formatElapsed(startedAt: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

export function RecoveryScreen({ activity, onContinue, onFinish }: Props) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(activity.startedAt));
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(formatElapsed(activity.startedAt)), 1000);
    return () => clearInterval(timer);
  }, [activity.startedAt]);

  async function handleFinish() {
    if (isFinishing) return;
    setIsFinishing(true);
    setFinishError(null);
    try {
      await onFinish();
    } catch (error) {
      if (!(error instanceof PhotoCaptureError)) {
        console.error('Failed to finish recovered activity:', error);
      }
      setFinishError(
        error instanceof PhotoCaptureError
          ? error.message
          : 'Não foi possível finalizar. O treino continua salvo. Tente novamente.'
      );
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>TREINO ENCONTRADO</Text>
        <Text style={styles.title}>Retomar treino</Text>
        <Text style={styles.description}>
          Sua atividade continua salva neste aparelho. Você pode retomar o acompanhamento ou
          tirar a foto final para encerrá-la.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.label}>TEMPO DECORRIDO</Text>
          <Text style={styles.timeValue}>{elapsed}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>DISTÂNCIA SALVA</Text>
          <Text style={styles.distanceValue}>
            {activity.hasValidGpsPoint ? formatDistance(activity.distanceMeters) : 'Ainda não medida'}
          </Text>
        </View>

        {activity.startPhotoUri && (
          <View style={styles.photoCard}>
            <Image
              accessibilityLabel="Foto do início da atividade recuperada"
              source={{ uri: activity.startPhotoUri }}
              style={styles.photo}
            />
            <View style={styles.photoDetails}>
              <Text style={styles.photoTitle}>Foto inicial salva</Text>
              <Text style={styles.photoTime}>
                {activity.startPhotoTakenAt
                  ? new Date(activity.startPhotoTakenAt).toLocaleString('pt-BR')
                  : 'No aparelho'}
              </Text>
              <SavePhotoButton key={activity.startPhotoUri} uri={activity.startPhotoUri} label="inicial" />
            </View>
          </View>
        )}

        <RouteMiniMap activityId={activity.id} />

        <View style={styles.actions}>
          {finishError && <Text style={styles.error}>{finishError}</Text>}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isFinishing }}
            disabled={isFinishing}
            onPress={onContinue}
            style={[styles.continueButton, isFinishing && styles.disabledButton]}
          >
            <Text style={styles.continueText}>CONTINUAR ATIVIDADE</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isFinishing }}
            disabled={isFinishing}
            onPress={() => void handleFinish()}
            style={[styles.finishButton, isFinishing && styles.disabledButton]}
          >
            <Text style={styles.finishText}>
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
  description: { color: '#5d7065', fontSize: 16, lineHeight: 23, marginTop: 10 },
  summaryCard: { backgroundColor: '#e3eee6', borderRadius: 20, marginTop: 32, padding: 24 },
  label: { color: '#638272', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  timeValue: { color: '#173b2b', fontSize: 46, fontWeight: '700', marginTop: 12 },
  divider: { backgroundColor: '#ccdfd2', height: 1, marginVertical: 20 },
  distanceValue: { color: '#173b2b', fontSize: 28, fontWeight: '700', marginTop: 10 },
  photoCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    padding: 12,
  },
  photo: { borderRadius: 12, height: 82, width: 82 },
  photoDetails: { flex: 1 },
  photoTitle: { color: '#274c39', fontSize: 17, fontWeight: '700' },
  photoTime: { color: '#63766a', fontSize: 14, marginTop: 5 },
  actions: { gap: 12, marginTop: 'auto', paddingTop: 32 },
  error: { color: '#8b443b', fontSize: 14 },
  continueButton: {
    alignItems: 'center',
    backgroundColor: '#326e58',
    borderRadius: 16,
    paddingVertical: 20,
  },
  continueText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  finishButton: {
    alignItems: 'center',
    borderColor: '#326e58',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 19,
  },
  finishText: { color: '#285c48', fontSize: 15, fontWeight: '700' },
  disabledButton: { opacity: 0.55 },
});
