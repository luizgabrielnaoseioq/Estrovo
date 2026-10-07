import { Image, StyleSheet, Text, View } from 'react-native';
import type { Activity } from '../types/Activity';
import { SavePhotoButton } from './SavePhotoButton';

type Props = {
  activity: Activity;
};

function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`;
}

function formatPhotoTime(timestamp: number | undefined): string {
  return timestamp
    ? new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
}

export function ActivityListItem({ activity }: Props) {
  const duration =
    activity.status === 'recording' ? 'Em andamento' : formatDuration(activity.durationSeconds);
  const hasMeasuredDistance = activity.hasValidGpsPoint;

  return (
    <View style={styles.item}>
      <View style={styles.row}>
        <View>
          <Text style={[styles.distance, !hasMeasuredDistance && styles.distanceUnavailable]}>
            {hasMeasuredDistance ? formatDistance(activity.distanceMeters) : 'Distância não medida'}
          </Text>
          <Text style={styles.date}>
            {new Date(activity.startedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
            })}
          </Text>
        </View>
        <Text style={styles.duration}>{duration}</Text>
      </View>
      {activity.status === 'pending_sync' && (
        <Text style={styles.syncStatus}>Aguardando sincronização</Text>
      )}
      {activity.status === 'synced' && <Text style={styles.syncStatus}>Sincronizado</Text>}
      {(activity.startPhotoUri || activity.finishPhotoUri) && (
        <View style={styles.photosRow}>
          {activity.startPhotoUri && (
            <View style={styles.photoItem}>
              <Image
                accessibilityLabel="Foto inicial"
                source={{ uri: activity.startPhotoUri }}
                style={styles.photoImage}
              />
              <Text style={styles.photoLabel}>
                Início {formatPhotoTime(activity.startPhotoTakenAt)}
              </Text>
              <SavePhotoButton key={activity.startPhotoUri} uri={activity.startPhotoUri} label="inicial" />
            </View>
          )}
          {activity.finishPhotoUri && (
            <View style={styles.photoItem}>
              <Image
                accessibilityLabel="Foto final"
                source={{ uri: activity.finishPhotoUri }}
                style={styles.photoImage}
              />
              <Text style={styles.photoLabel}>
                Fim {formatPhotoTime(activity.finishPhotoTakenAt)}
              </Text>
              <SavePhotoButton key={activity.finishPhotoUri} uri={activity.finishPhotoUri} label="final" />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#fff',
    borderColor: '#e2e8e5',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  distance: { color: '#172721', fontSize: 20, fontWeight: '700' },
  distanceUnavailable: { fontSize: 16 },
  date: { color: '#6e7d74', fontSize: 13, marginTop: 4 },
  duration: { color: '#365448', fontSize: 15, fontWeight: '600' },
  syncStatus: { color: '#648575', fontSize: 12, fontWeight: '600', marginTop: 8 },
  photosRow: { borderTopColor: '#e2e8e5', borderTopWidth: 1, flexDirection: 'row', gap: 12, marginTop: 14, paddingTop: 14 },
  photoItem: { alignItems: 'center', width: 112 },
  photoImage: { borderRadius: 10, height: 74, width: 74 },
  photoLabel: { color: '#53695b', fontSize: 12, marginTop: 6 },
});
