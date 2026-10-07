import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import type { ActivityPhoto } from '../types/Activity';
import { writeWatermarkedPhoto } from './photoWatermark';

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
      allowsEditing: false,
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
      `${moment}-${capturedAt}-${Crypto.randomUUID()}.jpg`
    );
    try {
      await writeWatermarkedPhoto(
        asset.uri,
        asset.width,
        asset.height,
        capturedAt,
        moment,
        destination
      );
      if (!destination.exists || destination.size === 0) {
        throw new Error('The watermarked photo is empty.');
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

export class PhotoExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoExportError';
  }
}

export async function saveActivityPhotoToGallery(uri: string): Promise<void> {
  const file = new File(uri);
  if (!file.exists || file.size === 0) {
    throw new PhotoExportError('Esta foto não está mais disponível no aparelho.');
  }

  try {
    const currentPermission = await MediaLibrary.getPermissionsAsync(true, ['photo']);
    const permission = currentPermission.granted
      ? currentPermission
      : await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    if (!permission.granted) {
      throw new PhotoExportError('Permita salvar fotos na galeria nas configurações do aparelho.');
    }
    await MediaLibrary.Asset.create(file.uri);
  } catch (error) {
    if (error instanceof PhotoExportError) throw error;
    console.error('Failed to export an activity photo:', error);
    throw new PhotoExportError('Não foi possível salvar a foto na galeria. Tente novamente.');
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
