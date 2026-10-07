import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { canUseBackgroundTracking } from './backgroundLocationService';

export class LocationSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationSetupError';
  }
}

export async function requestActivityLocationPermission(): Promise<void> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new LocationSetupError('Ative a localização do aparelho para iniciar a atividade.');
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    throw new LocationSetupError('Permita o acesso à localização para iniciar a atividade.');
  }
}

export async function requestBackgroundTrackingPermission(): Promise<boolean> {
  if (!(await canUseBackgroundTracking())) return false;
  if ((await Location.getBackgroundPermissionsAsync()).granted) return true;

  const wantsBackgroundTracking = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Acompanhar com a tela bloqueada',
      'Para registrar o trajeto com a tela bloqueada ou em outro app, permita a localização o tempo todo na próxima tela. Você também pode usar o treino somente com este app aberto.',
      [
        { text: 'Somente com app aberto', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Configurar acesso', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
  if (!wantsBackgroundTracking) return false;

  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

export function watchActivityLocation(
  onLocation: (location: Location.LocationObject) => void,
  onError: (reason: string) => void
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 5,
    },
    onLocation,
    onError
  );
}
