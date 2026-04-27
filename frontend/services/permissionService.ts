// services/permissionService.ts
import { Camera } from 'expo-camera';
import { Linking, Platform } from 'react-native';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

const PermissionService = {
  async checkCameraStatus(): Promise<PermissionStatus> {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status as PermissionStatus;
  },

  async requestCamera(): Promise<PermissionStatus> {
    const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
    
    // Si Android dice que ya no podemos preguntar, mandamos al usuario a Ajustes
    if (status === 'denied' && !canAskAgain && Platform.OS !== 'web') {
      this.openSettings();
    }
    
    return status as PermissionStatus;
  },

  openSettings() {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings(); // Abre la info de la app en Android
    }
  }
};

export default PermissionService;