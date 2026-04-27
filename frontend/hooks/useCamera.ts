// hooks/useCamera.ts
import { useRef, useState, useEffect, useCallback } from 'react';
import { CameraView } from 'expo-camera';
import PermissionService from '@/services/permissionService';

export function useCamera() {
  const cameraRef = useRef<CameraView>(null);
  const [cameraStatus, setCameraStatus] = useState<string>('loading');
  const [lastPhoto, setLastPhoto] = useState<any>(null);

  // Función para pedir permiso manualmente (la llama el botón del video)
  const askForPermission = useCallback(async () => {
    const status = await PermissionService.requestCamera();
    setCameraStatus(status);
  }, []);

  // Verificar estado al montar la app
  useEffect(() => {
    (async () => {
      const status = await PermissionService.checkCameraStatus();
      setCameraStatus(status);
    })();
  }, []);

  return {
    cameraRef,
    cameraStatus,
    isReady: cameraStatus === 'granted',
    askForPermission,
    lastPhoto,
    setLastPhoto
  };
}