import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { ActivityPhoto } from '../types/Activity';

export class PhotoCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoCaptureError';
  }
}

type PhotoMoment = 'start' | 'finish';

function photoDirectory(): Directory {
  return new Directory(Paths.document, 'activity-photos');
}

function fileExtension(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/webp':
      return 'webp';
    default:
      return 'jpg';
  }
}

export async function captureActivityPhoto(moment: PhotoMoment): Promise<ActivityPhoto | null> {
  try {
    const currentPermission = await ImagePicker.getCameraPermissionsAsync();
    const permission = currentPermission.granted
      ? currentPermission
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new PhotoCaptureError('Permita o acesso à câmera para registrar a foto do treino.');
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      exif: false,
    });
    if (result.canceled) return null;

    const asset = result.assets[0];
    if (!asset?.uri) throw new PhotoCaptureError('A câmera não retornou uma foto. Tente novamente.');

    const capturedAt = Date.now();
    const directory = photoDirectory();
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(
      directory,
      `${moment}-${capturedAt}-${Crypto.randomUUID()}.${fileExtension(asset.mimeType)}`
    );
    try {
      await new File(asset.uri).copy(destination);
      if (!destination.exists || destination.size === 0) {
        throw new Error('The copied photo is empty.');
      }
    } catch (error) {
      if (destination.exists) destination.delete();
      throw error;
    }

    return { uri: destination.uri, capturedAt };
  } catch (error) {
    if (error instanceof PhotoCaptureError) throw error;
    console.error('Failed to capture or save activity photo:', error);
    throw new PhotoCaptureError('Não foi possível tirar ou salvar a foto. Tente novamente.');
  }
}

export function discardActivityPhoto(photo: ActivityPhoto): void {
  try {
    const directoryUri = photoDirectory().uri;
    const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
    if (!photo.uri.startsWith(prefix)) return;
    const file = new File(photo.uri);
    if (file.exists) file.delete();
  } catch (error) {
    console.error('Failed to discard unused activity photo:', error);
  }
}
