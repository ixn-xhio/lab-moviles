import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import CameraScreen from '../app/(tabs)/index';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

let mockIsReady = true;
const mockAskForPermission = jest.fn();
const mockSetLastPhoto = jest.fn();

jest.mock('@/hooks/useCamera', () => {
  const React = require('react');
  return {
    useCamera: () => {
      const [lastPhoto, setLastPhotoState] = React.useState<any>(null);
      
      const cameraRef = React.useRef({
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'ph://test-photo-uri' }),
      });

      return {
        cameraRef,
        cameraStatus: 'ready',
        isReady: mockIsReady,
        askForPermission: mockAskForPermission,
        lastPhoto,
        setLastPhoto: (photo: any) => {
          setLastPhotoState(photo);
          mockSetLastPhoto(photo);
        },
      };
    },
  };
});

jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: ({ children }: any) => <View testID="mock-camera-view">{children}</View>,
  };
});

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'ph://compressed-uri.jpg',
    base64: 'fake-base64-string-data',
  }),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('Módulo CameraScreen — Análisis e Identificación Biológica', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady = true;
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  it('Fase 1: Debería renderizar la UI de bloqueo si el acceso a la cámara no está autorizado', () => {
    mockIsReady = false;

    render(<CameraScreen />);

    expect(screen.getByText('La cámara está bloqueada')).toBeTruthy();
    
    const permissionButton = screen.getByText('Solicitar Acceso');
    fireEvent.press(permissionButton);
    
    expect(mockAskForPermission).toHaveBeenCalledTimes(1);
  });

  it('Fase 2: Debería ejecutar todo el flujo de captura, compresión de imagen, envío POST y renderizar la data RAG', async () => {
    const mockRagResponse = {
      classification: 'Flora Mutante Alfa',
      description: 'Muestra orgánica con alto índice de radiación clorofílica.',
      danger_level: 'DANGEROUS',
      confidence: 0.94,
      similar_findings: ['Registro de laboratorio 2024', 'Especie invasora sector 4'],
    };

    // Usamos spyOn sobre el entorno global para garantizar la captura de la petición HTTP
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockRagResponse),
      } as Response)
    );

    render(<CameraScreen />);
    
    // Disparar el click en el botón de captura redondo
    const snapButton = screen.getByTestId('snap-button');
    fireEvent.press(snapButton);

    // findByText esperará de forma asíncrona a que se resuelvan los procesos asíncronos en cadena
    const classificationText = await screen.findByText('Flora Mutante Alfa', {}, { timeout: 3000 });
    expect(classificationText).toBeTruthy();

    expect(screen.getByText('Análisis de Bitácora')).toBeTruthy();
    expect(screen.getByText('Muestra orgánica con alto índice de radiación clorofílica.')).toBeTruthy();
    
    // Validar el estilo de peligro inyectado en caliente
    const dangerText = screen.getByText('DANGEROUS');
    expect(dangerText).toBeTruthy();
    expect(dangerText.props.style).toContainEqual({ color: '#f87171' });

    // Validar la existencia de los registros de la base de datos vectorial (RAG)
    expect(screen.getByText('📚 Registros Similares en BD:')).toBeTruthy();
    expect(screen.getByText('• Registro de laboratorio 2024')).toBeTruthy();
    expect(screen.getByText('• Especie invasora sector 4')).toBeTruthy();

    // Comprobar limpieza de estados al presionar "Nueva Captura"
    const newCaptureButton = screen.getByText('Nueva Captura');
    fireEvent.press(newCaptureButton);

    expect(mockSetLastPhoto).toHaveBeenCalledWith(null);
  });
});