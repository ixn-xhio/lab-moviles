import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface PlantItem {
  id: number;
  name: string;
}

export default function TabTwoScreen() {
  const [plants, setPlants] = useState<PlantItem[]>([]);
  const [selectedPlants, setSelectedPlants] = useState<number[]>([]); // Almacena IDs numéricos
  const [recipe, setRecipe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingScreen, setLoadingScreen] = useState(true);

  // Obtener las plantas de la DB al montar la pantalla
  const fetchPlants = async () => {
    try {
      const response = await fetch('http://desynth.dev/plants-detailed');
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPlants(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudo conectar con el servidor para obtener las plantas.');
    } finally {
      setLoadingScreen(false);
    }
  };

  useEffect(() => {
    fetchPlants();
  }, []);

  // Selección múltiple con Presión Prolongada (Long Press)
  const handleLongPressPlant = (id: number) => {
    if (selectedPlants.includes(id)) {
      setSelectedPlants(selectedPlants.filter((pId) => pId !== id));
    } else {
      setSelectedPlants([...selectedPlants, id]);
    }
  };

  // Eliminar planta de la DB y limpiar el estado local
  const handleDeletePlant = (id: number, name: string) => {
    Alert.alert(
      'Eliminar Registro',
      `¿Deseas eliminar "${name}" de tu bitácora? Esto borrará también todas sus recetas asociadas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`http://desynth.dev/plants/${id}`, { method: 'DELETE' });
              if (!response.ok) throw new Error();
              
              Alert.alert('Éxito', 'Planta eliminada correctamente.');
              setPlants(plants.filter(p => p.id !== id));
              setSelectedPlants(selectedPlants.filter(pId => pId !== id));
            } catch (error) {
              Alert.alert('Error', 'No se pudo procesar la eliminación.');
            }
          }
        }
      ]
    );
  };

  const handleFetchRecipe = async () => {
    if (selectedPlants.length === 0) {
      Alert.alert('Atención', 'Mantén presionada al menos una planta para seleccionarla.');
      return;
    }

    setLoading(true);
    setRecipe(null);

    try {
      const response = await fetch('http://desynth.dev/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plant_ids: selectedPlants }),
      });

      if (!response.ok) throw new Error('HTTP Error');

      const data = await response.json();
      setRecipe(data.recipe);
    } catch (error) {
      Alert.alert('Error', 'No se logró procesar la receta con Gemini.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A7F3D0', dark: '#064E3B' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#059669"
          name="paperplane.fill"
          style={styles.headerImage}
        />
      }>
      
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Generador de Recetas IA</ThemedText>
      </ThemedView>

      <ThemedText>
        Mantén presionado para seleccionar las plantas de tu bitácora y procesar una receta con Gemini:
      </ThemedText>

      {loadingScreen ? (
        <ActivityIndicator size="large" color="#059669" style={{ marginVertical: 20 }} />
      ) : plants.length === 0 ? (
        <Text style={styles.noPlantsText}>No hay plantas registradas en tu bitácora 🌱.</Text>
      ) : (
        /* Selector de Chips / Checkbox */
        <View style={styles.chipsContainer}>
          {plants.map((plant) => {
            const isSelected = selectedPlants.includes(plant.id);
            return (
              <TouchableOpacity
                key={plant.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onLongPress={() => handleLongPressPlant(plant.id)}
                delayLongPress={380} // Tiempo de espera nativo confortable para Android
                activeOpacity={0.6}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {plant.name} {isSelected ? '🌱 ✅' : '➕'}
                </Text>
                
                {/* Botón Autónomo para Borrar */}
                <TouchableOpacity 
                  style={styles.deleteBadge} 
                  onPress={() => handleDeletePlant(plant.id, plant.name)}
                >
                  <Text style={styles.deleteBadgeText}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Botón Cómodo y Accesible */}
      <TouchableOpacity 
        style={[styles.actionButton, selectedPlants.length === 0 && styles.actionButtonDisabled]} 
        onPress={handleFetchRecipe}
        disabled={loading || selectedPlants.length === 0}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.actionButtonText}>
            Generar Receta con Ingredientes ({selectedPlants.length})
          </Text>
        )}
      </TouchableOpacity>

      {recipe && (
        <ScrollView style={styles.recipeContainer}>
          <Text style={styles.recipeText}>{recipe}</Text>
        </ScrollView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: { color: '#808080', bottom: -90, left: -35, position: 'absolute' },
  titleContainer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  noPlantsText: { fontStyle: 'italic', color: '#6B7280', marginVertical: 15, textAlign: 'center' },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 15 },
  
  chip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 20, 
    backgroundColor: '#E5E7EB', 
    borderWidth: 1, 
    borderColor: '#D1D5DB' 
  },
  chipActive: { backgroundColor: '#A7F3D0', borderColor: '#10B981' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#065F46', fontWeight: 'bold' },
  
  deleteBadge: { marginLeft: 8, backgroundColor: '#FEE2E2', padding: 4, borderRadius: 10 },
  deleteBadgeText: { fontSize: 12 },

  actionButton: { backgroundColor: '#4ade80', padding: 15, borderRadius: 12, marginTop: 10, elevation: 2 },
  actionButtonDisabled: { backgroundColor: '#9CA3AF', opacity: 0.6 },
  actionButtonText: { color: '#000', fontWeight: 'bold', textAlign: 'center', fontSize: 15 },
  
  recipeContainer: { marginTop: 25, padding: 15, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  recipeText: { fontSize: 14, color: '#1F2937', lineHeight: 22 }
});