import { CameraView, CameraType, FlashMode } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import React, { RefObject } from 'react';

export interface PhotoResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

export interface CaptureOptions {
  quality?: number;
  base64?: boolean;
}

const CameraService = {
  async takePhoto(
    cameraRef: RefObject<CameraView | null>,
    options: CaptureOptions = {}
  ): Promise<PhotoResult> {
    if (!cameraRef.current) {
      throw new Error('REFERENCIA_NULA: La cámara no está lista');
    }

    const photo = await cameraRef.current.takePictureAsync({
      quality: options.quality ?? 0.7,
      base64: options.base64 ?? true,
    });

    if (!photo || !photo.uri) throw new Error('CAPTURA_FALLIDA');

    return {
      uri: photo.uri,
      width: photo.width,
      height: photo.height,
      base64: photo.base64,
    };
  },

  async saveToGallery(uri: string) {
    return await MediaLibrary.createAssetAsync(uri);
  },

  toggleFacing(current: CameraType): CameraType {
    return current === 'back' ? 'front' : 'back';
  },

  cycleFlashMode(current: FlashMode): FlashMode {
    const modes: FlashMode[] = ['off', 'on', 'auto'];
    const index = modes.indexOf(current);
    return modes[(index + 1) % modes.length];
  },
};

export default CameraService;