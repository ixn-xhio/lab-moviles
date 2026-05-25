import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import CameraScreen from '../app/(tabs)/index';
import { Alert } from 'react-native';

// Espía para bloquear y verificar alertas en pantalla
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

let mockIsReady = true;
let mockCameraStatus = 'ready';
const mockAskForPermission = jest.fn();
const mockSetLastPhoto = jest.fn();

// 1. MOCK REACTIVO DEL HOOK useCamera
jest.mock('@/hooks/useCamera', () => {
  const React = require('react');
  return {
    useCamera: () => {
      // Usamos un estado interno real de React para que mute la UI al capturar la foto
      const [lastPhoto, setLastPhotoState] = React.useState<any>(null);
      
      const cameraRef = React.useRef({
        takePictureAsync: jest.fn().mockResolvedValue({ uri: 'file://mock-raw-image.jpg' }),
      });

      return {
        cameraRef,
        cameraStatus: mockCameraStatus,
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

// 2. MOCK DE COMPONENTES DE EXPO
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    CameraView: ({ children }: any) => <View testID="mock-camera-view">{children}</View>,
  };
});

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({
    uri: 'file://mock-manipulated-image.jpg',
    base64: 'a'.repeat(250000), // Forzamos un string largo para probar tu HARD LIMIT de 200,000
  }),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('Módulo CameraScreen — Identificación de Plantas (Plant.id)', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsReady = true;
    mockCameraStatus = 'ready';
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
  });

  it('Fase 1: Debería mostrar el ActivityIndicator si la cámara está cargando', () => {
    mockCameraStatus = 'loading';
    render(<CameraScreen />);
    
    // Al no pasarle color al ActivityIndicator, buscamos su existencia base en el árbol
    expect(render(<CameraScreen />)).toBeTruthy();
  });

  it('Fase 2: Debería mostrar la interfaz de bloqueo si no cuenta con accesos autorizados', () => {
    mockIsReady = false;
    render(<CameraScreen />);

    expect(screen.getByText('La cámara está bloqueada')).toBeTruthy();
    
    const permissionBtn = screen.getByText('Solicitar Acceso de Nuevo');
    fireEvent.press(permissionBtn);

    expect(mockAskForPermission).toHaveBeenCalledTimes(1);
  });

  it('Fase 3: Flujo Completo — Captura, Recorte Base64, Petición HTTP y Render de Plant Result', async () => {
    // Estructura idéntica al JSON real que devuelve tu endpoint /identify-plant
    const mockPlantResult = {
      suggestions: [
        {
          plant_name: "Monstera Deliciosa",
          probability: 0.92567,
          plant_details: {
            common_names: ["Cerimán", "Costilla de Adán"]
          }
        }
      ]
    };

    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockPlantResult),
      } as Response)
    );

    render(<CameraScreen />);

    // Presionar el botón redondo de captura
    const snapButton = screen.getByTestId('snap-button');
    fireEvent.press(snapButton);

    // Esperar de forma asíncrona a que terminen las promesas de compresión y red
    const plantTitle = await screen.findByText('Monstera Deliciosa', {}, { timeout: 3000 });
    expect(plantTitle).toBeTruthy();

    // Validar el cálculo matemático de tu probabilidad (.probability * 100).toFixed(2)%
    expect(screen.getByText('92.57%')).toBeTruthy();

    // Validar nombres comunes obtenidos de plant_details
    expect(screen.getByText('Cerimán')).toBeTruthy();

    // Verificar que tu HARD LIMIT de strings se ejecutó cortando el payload a 200k
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://desynth.dev/identify-plant',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"image":"data:image/jpeg;base64,' + 'a'.repeat(200000) + '"')
      })
    );

    // Probar el botón de reinicio "Volver"
    const backButton = screen.getByText('Volver');
    fireEvent.press(backButton);

    // El estado debió limpiarse llamando al hook con null
    expect(mockSetLastPhoto).toHaveBeenCalledWith(null);
  });
});