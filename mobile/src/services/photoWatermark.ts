import { ImageFormat, matchFont, rect, Skia } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const MAX_PHOTO_EDGE = 2400;
console.log('watermark font families', Array.from({ length: Skia.FontMgr.System().countFamilies() }, (_, index) => Skia.FontMgr.System().getFamilyName(index)));
console.log('watermark font glyphs', matchFont({ fontFamily: 'sans-serif', fontSize: 48 }).getGlyphIDs('07/10/2026'));

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatPhotoTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function writeWatermarkedPhoto(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  capturedAt: number,
  moment: 'start' | 'finish',
  destination: File
): Promise<void> {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('The captured photo has invalid dimensions.');
  }
  const manipulator = ImageManipulator.ImageManipulator.manipulate(sourceUri);
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  if (longestEdge > MAX_PHOTO_EDGE) {
    manipulator.resize({
      width: Math.round((sourceWidth / longestEdge) * MAX_PHOTO_EDGE),
      height: Math.round((sourceHeight / longestEdge) * MAX_PHOTO_EDGE),
    });
  }
  const rendered = await manipulator.renderAsync();
  const jpeg = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 });
  const temporaryFile = new File(jpeg.uri);
  try {
    const sourceData = Skia.Data.fromBytes(await temporaryFile.bytes());
    try {
      const image = Skia.Image.MakeImageFromEncoded(sourceData);
      if (!image) throw new Error('The captured photo could not be decoded.');
      try {
        const width = image.width();
        const height = image.height();
        const surface = Skia.Surface.MakeOffscreen(width, height);
        if (!surface) throw new Error('Could not create a photo surface.');
        try {
          const canvas = surface.getCanvas();
          canvas.drawImage(image, 0, 0);

          const fontSize = Math.max(24, Math.round(Math.min(width, height) * 0.045));
          const fontFamily = Platform.OS === 'android' ? 'sans-serif' : 'Helvetica';
          const titleFont = matchFont({ fontFamily, fontSize, fontWeight: 'bold' });
          const detailFont = matchFont({ fontFamily, fontSize: Math.round(fontSize * 0.62) });
          const padding = Math.round(fontSize * 0.75);
          const bandHeight = Math.round(fontSize * 2.65);
          const bandTop = height - bandHeight;

          const background = Skia.Paint();
          background.setColor(Skia.Color('rgba(15, 36, 27, 0.78)'));
          canvas.drawRect(rect(0, bandTop, width, bandHeight), background);

          const text = Skia.Paint();
          text.setAntiAlias(true);
          text.setColor(Skia.Color('#ffffff'));
          canvas.drawText(
            formatPhotoTimestamp(capturedAt),
            padding,
            bandTop + fontSize * 1.24,
            text,
            titleFont
          );

          text.setColor(Skia.Color('#d7efdf'));
          canvas.drawText(
            `TREINOS OFFLINE  •  ${moment === 'start' ? 'INÍCIO' : 'FIM'}`,
            padding,
            bandTop + fontSize * 2.04,
            text,
            detailFont
          );

          surface.flush();
          const snapshot = surface.makeImageSnapshot();
          try {
            destination.write(snapshot.encodeToBytes(ImageFormat.JPEG, 90));
          } finally {
            snapshot.dispose();
          }
        } finally {
          surface.dispose();
        }
      } finally {
        image.dispose();
      }
    } finally {
      sourceData.dispose();
    }
  } finally {
    try {
      if (temporaryFile.exists) temporaryFile.delete();
    } catch (error) {
      console.error('Could not remove a temporary photo:', error);
    }
  }
}
