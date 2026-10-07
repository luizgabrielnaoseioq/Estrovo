import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { PhotoExportError, saveActivityPhotoToGallery } from '../services/activityPhotoService';

type Props = {
  uri: string;
  label: string;
};

export function SavePhotoButton({ uri, label }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (status !== 'idle') return;
    setStatus('saving');
    setError(null);
    try {
      await saveActivityPhotoToGallery(uri);
      setStatus('saved');
    } catch (saveError) {
      setError(
        saveError instanceof PhotoExportError
          ? saveError.message
          : 'Não foi possível salvar a foto.'
      );
      setStatus('idle');
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Salvar foto ${label} na galeria`}
        accessibilityState={{ disabled: status !== 'idle' }}
        disabled={status !== 'idle'}
        onPress={() => void handleSave()}
        style={[styles.button, status !== 'idle' && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {status === 'saving' ? 'SALVANDO...' : status === 'saved' ? 'SALVA NA GALERIA' : 'SALVAR FOTO'}
        </Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderColor: '#326e58',
    borderRadius: 9,
    borderWidth: 1,
    marginTop: 9,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#285c48', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  error: { color: '#8b443b', fontSize: 11, lineHeight: 15, marginTop: 5, textAlign: 'center' },
});
