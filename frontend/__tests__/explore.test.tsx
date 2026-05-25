import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TabTwoScreen from '../app/(tabs)/explore';

jest.mock('@/components/parallax-scroll-view', () => ({
  __esModule: true,
  default: ({ children }: any) => children,
}));

jest.mock('@/components/themed-text', () => ({
  __esModule: true,
  ThemedText: ({ children }: any) => children,
}));

jest.mock('@/components/themed-view', () => ({
  __esModule: true,
  ThemedView: ({ children }: any) => children,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  __esModule: true,
  IconSymbol: () => null,
}));

jest.mock('expo-image', () => ({
  __esModule: true,
  Image: () => null,
}));

describe('TDD - Módulo de Recetas Inteligentes (Gemini)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debería seleccionar "Romero", disparar la solicitud HTTP POST y mostrar la receta en la UI', async () => {
    // Simulamos la respuesta JSON estructurada de nuestro Fastify Backend
    const mockApiResponse = { recipe: '### Receta Sugerida\nTé medicinal de Romero para el cansancio.' };
    
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      })
    );

    // Renderizar la pantalla de exploración de forma limpia
    const { getByText, findByText } = render(<TabTwoScreen />);

    // Buscar el chip/checkbox de la planta "Romero" y presionarlo
    const plantCheckbox = getByText(/Romero/);
    fireEvent.press(plantCheckbox);

    // Presionar el botón de disparo hacia la IA
    const submitButton = getByText('Generar Receta con Gemini');
    fireEvent.press(submitButton);

    // Verificar que el fetch del cliente móvil armó el array de forma correcta
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/generate-recipes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ plants: ['Romero'] }),
        })
      );
    });

    // Validar el renderizado en la tarjeta final
    const recipeResultText = await findByText(/Té medicinal de Romero/);
    expect(recipeResultText).toBeTruthy();
  });
});