import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityListItem } from '../components/ActivityListItem';
import { listRecentActivities } from '../database/repositories/activityRepository';
import { PhotoCaptureError } from '../services/activityPhotoService';
import { LocationSetupError } from '../services/locationService';
import type { Activity } from '../types/Activity';

type Props = {
  onStartActivity: () => Promise<void>;
  refreshKey: number;
};

export function HomeScreen({ onStartActivity, refreshKey }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

    listRecentActivities()
      .then((recentActivities) => {
        if (isMounted) setActivities(recentActivities);
      })
      .catch((error: unknown) => {
        console.error('Failed to load recent activities:', error);
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  async function handleStartActivity() {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);

    try {
      await onStartActivity();
    } catch (error) {
      if (!(error instanceof LocationSetupError) && !(error instanceof PhotoCaptureError)) {
        console.error('Failed to start activity:', error);
      }
      setStartError(
        error instanceof LocationSetupError || error instanceof PhotoCaptureError
          ? error.message
          : 'Não foi possível iniciar. Tente novamente.'
      );
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SUAS ATIVIDADES</Text>
        <Text style={styles.title}>Treinos</Text>
        <Text style={styles.description}>
          Registre suas caminhadas e corridas com fotos do início e do fim.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: isStarting }}
          disabled={isStarting}
          onPress={() => void handleStartActivity()}
          style={[styles.startButton, isStarting && styles.startButtonDisabled]}
        >
          <Text style={styles.startButtonText}>
            {isStarting ? 'INICIANDO...' : 'TIRAR FOTO E INICIAR'}
          </Text>
        </Pressable>
        {startError && (
          <Text style={styles.startError}>{startError}</Text>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Últimas atividades</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#326e58" style={styles.loading} />
        ) : hasError ? (
          <Text style={styles.message}>Não foi possível carregar as atividades.</Text>
        ) : activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma atividade registrada</Text>
            <Text style={styles.emptyDescription}>
              Seus treinos aparecerão aqui após o primeiro registro.
            </Text>
          </View>
        ) : (
          activities.map((activity) => (
            <ActivityListItem activity={activity} key={activity.id} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#f6f8f5', flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },
  eyebrow: { color: '#648575', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#172721', fontSize: 42, fontWeight: '700', marginTop: 10 },
  description: { color: '#5d7065', fontSize: 16, lineHeight: 23, marginTop: 8 },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#326e58',
    borderRadius: 16,
    marginTop: 32,
    paddingVertical: 20,
  },
  startButtonDisabled: { backgroundColor: '#8ca99a' },
  startButtonText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  startError: { color: '#8b443b', fontSize: 14, marginTop: 12 },
  sectionHeader: { marginBottom: 16, marginTop: 40 },
  sectionTitle: { color: '#172721', fontSize: 22, fontWeight: '700' },
  loading: { marginTop: 28 },
  message: { color: '#8b443b', fontSize: 15 },
  emptyCard: {
    backgroundColor: '#fff',
    borderColor: '#e2e8e5',
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
  emptyTitle: { color: '#2d4135', fontSize: 17, fontWeight: '700' },
  emptyDescription: { color: '#718177', fontSize: 14, lineHeight: 21, marginTop: 8 },
});
