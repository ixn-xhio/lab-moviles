import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';

const BOTANICAL_OPTIONS = ['Romero', 'Menta', 'Manzanilla', 'Eucalipto'];

export default function TabTwoScreen() {
  const [selectedPlants, setSelectedPlants] = useState<string[]>([]);
  const [recipe, setRecipe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTogglePlant = (plant: string) => {
    if (selectedPlants.includes(plant)) {
      setSelectedPlants(selectedPlants.filter((p) => p !== plant));
    } else {
      setSelectedPlants([...selectedPlants, plant]);
    }
  };

  const handleFetchRecipe = async () => {
    if (selectedPlants.length === 0) {
      Alert.alert('Atención', 'Selecciona al menos una planta de la lista.');
      return;
    }

    setLoading(true);
    setRecipe(null);

    try {
      const response = await fetch('http://10.0.2.2:3000/generate-recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plants: selectedPlants }),
      });

      if (!response.ok) throw new Error('HTTP Error');

      const data = await response.json();
      setRecipe(data.recipe);
    } catch (error) {
      Alert.alert('Error', 'No se logró conectar con el motor de IA.');
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
        Agrupa las plantas de tu bitácora para procesar una receta médica o gastronómica con Gemini:
      </ThemedText>

      {/* Selector de Chips / Checkbox */}
      <View style={styles.chipsContainer}>
        {BOTANICAL_OPTIONS.map((plant) => {
          const isSelected = selectedPlants.includes(plant);
          return (
            <TouchableOpacity
              key={plant}
              style={[styles.chip, isSelected && styles.chipActive]}
              onPress={() => handleTogglePlant(plant)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {plant} {isSelected ? '🌱 ✅' : '➕'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={handleFetchRecipe}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.actionButtonText}>Generar Receta con Gemini</Text>
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
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 15 },
  chip: { padding: 12, borderRadius: 20, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' },
  chipActive: { backgroundColor: '#A7F3D0', borderColor: '#10B981' },
  chipText: { color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#065F46', fontWeight: 'bold' },
  actionButton: { backgroundColor: '#4ade80', padding: 15, borderRadius: 12, marginTop: 10 },
  actionButtonText: { color: '#000', fontWeight: 'bold', textAlign: 'center' },
  recipeContainer: { marginTop: 25, padding: 15, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  recipeText: { fontSize: 14, color: '#1F2937', lineHeight: 22 }
});