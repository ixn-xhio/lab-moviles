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

interface Recipe {
  id: number;
  title: string;
  instructions: string;
  used_plants: { id: number; name: string }[];
}

export default function TabTwoScreen() {
  const [plants, setPlants] = useState<PlantItem[]>([]);
  const [pastRecipes, setPastRecipes] = useState<Recipe[]>([]);
  const [selectedPlants, setSelectedPlants] = useState<number[]>([]);
  
  const [loadingScreen, setLoadingScreen] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Carga inicial coordinada del catálogo de ingredientes e historial de recetas
  const loadData = async () => {
    try {
      const [plantsRes, recipesRes] = await Promise.all([
        fetch('http://desynth.dev/plants-detailed'),
        fetch('http://desynth.dev/recipes')
      ]);

      if (!plantsRes.ok || !recipesRes.ok) throw new Error();

      const plantsData = await plantsRes.json();
      const recipesData = await recipesRes.json();

      setPlants(plantsData);
      setPastRecipes(recipesData);
    } catch (error) {
      Alert.alert('Error de sincronización', 'No se pudieron recuperar los registros del servidor botánico.');
    } finally {
      setLoadingScreen(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLongPressPlant = (id: number) => {
    if (selectedPlants.includes(id)) {
      setSelectedPlants(selectedPlants.filter((pId) => pId !== id));
    } else {
      setSelectedPlants([...selectedPlants, id]);
    }
  };

  const handleDeletePlant = (id: number, name: string) => {
    Alert.alert(
      'Eliminar Planta',
      `¿Confirmas la eliminación de "${name}"? Esta acción purgará de forma definitiva todas las recetas en las que se incluye.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar Eliminación',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`http://desynth.dev/plants/${id}`, { method: 'DELETE' });
              if (!response.ok) throw new Error();
              
              Alert.alert('Éxito', 'Registros relacionales purgados.');
              setPlants(plants.filter(p => p.id !== id));
              setSelectedPlants(selectedPlants.filter(pId => pId !== id));
              // Volver a consultar recetas para actualizar el feed reactivamente sin la planta eliminada
              const recipesRes = await fetch('http://desynth.dev/recipes');
              setPastRecipes(await recipesRes.json());
            } catch (error) {
              Alert.alert('Error', 'No se pudo completar la operación de borrado.');
            }
          }
        }
      ]
    );
  };

  const handleFetchRecipe = async () => {
    if (selectedPlants.length === 0) {
      Alert.alert('Selección Vacía', 'Mantén presionado un ingrediente para seleccionarlo.');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('http://desynth.dev/generate-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plant_ids: selectedPlants }),
      });

      if (!response.ok) throw new Error();
      const data = await response.json();

      // Inyectamos la receta recién creada al inicio del historial de forma reactiva
      setPastRecipes([data.recipe, ...pastRecipes]);
      setSelectedPlants([]);
      Alert.alert('¡Receta Creada!', 'Se ha guardado e incorporado a tu historial botánico.');
    } catch (error) {
      Alert.alert('Error de Procesamiento', 'Gemini no logró estructurar la receta.');
    } finally {
      setGenerating(false);
    }
  };

  if (loadingScreen) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>Sincronizando laboratorios...</Text>
      </View>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A7F3D0', dark: '#064E3B' }}
      headerImage={<IconSymbol size={310} color="#059669" name="paperplane.fill" style={styles.headerImage} />}>
      
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Cocina e Infusiones IA</ThemedText>
      </ThemedView>

      <Text style={styles.helperText}>
        Mantén presionado un ingrediente de tu bitácora para seleccionarlo. Pulsa el contenedor de reciclaje para eliminarlo.
      </Text>

      {/* SECCIÓN 1: Selector de Ingredientes */}
      {plants.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Tu bitácora está vacía. Registra plantas en tu pestaña de cámara 📷.</Text>
        </View>
      ) : (
        <View style={styles.chipsContainer}>
          {plants.map((plant) => {
            const isSelected = selectedPlants.includes(plant.id);
            return (
              <TouchableOpacity
                key={plant.id}
                style={[styles.chip, isSelected && styles.chipActive]}
                onLongPress={() => handleLongPressPlant(plant.id)}
                delayLongPress={350}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {plant.name} {isSelected ? '🌿' : ''}
                </Text>
                <TouchableOpacity style={styles.deleteAction} onPress={() => handleDeletePlant(plant.id, plant.name)}>
                  <Text style={styles.deleteActionText}>×</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Botón de Procesamiento de IA */}
      <TouchableOpacity 
        style={[styles.actionButton, selectedPlants.length === 0 && styles.actionButtonDisabled]} 
        onPress={handleFetchRecipe}
        disabled={generating || selectedPlants.length === 0}
      >
        {generating ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.actionButtonText}>
            Procesar con Gemini ({selectedPlants.length})
          </Text>
        )}
      </TouchableOpacity>

      {/* SECCIÓN 2: Historial y Nuevas Recetas */}
      <View style={styles.historyHeaderContainer}>
        <Text style={styles.historyTitle}>Historial de Fórmulas y Recetas</Text>
        <View style={styles.divider} />
      </View>

      {pastRecipes.length === 0 ? (
        <Text style={styles.noRecipesText}>Aún no has generado ninguna receta relacional.</Text>
      ) : (
        pastRecipes.map((item) => (
          <View key={item.id} style={styles.recipeCard}>
            <Text style={styles.recipeCardTitle}>{item.title}</Text>
            
            {/* Badges de plantas asociadas */}
            <View style={styles.badgeRow}>
              {item.used_plants?.map((p, idx) => (
                <View key={idx} style={styles.badge}>
                  <Text style={styles.badgeText}>🌱 {p.name}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.recipeCardInstructions}>{item.instructions}</Text>
          </View>
        ))
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  loadingText: { marginTop: 12, color: '#4B5563', fontWeight: '500' },
  headerImage: { color: '#808080', bottom: -90, left: -35, position: 'absolute' },
  titleContainer: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  helperText: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 5 },
  
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 16, paddingRight: 8, borderRadius: 24, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#D1FAE5', borderColor: '#10B981' },
  chipText: { color: '#374151', fontWeight: '600', fontSize: 14 },
  chipTextActive: { color: '#065F46' },
  
  deleteAction: { marginLeft: 10, backgroundColor: '#FEE2E2', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  deleteActionText: { color: '#EF4444', fontWeight: 'bold', fontSize: 14, marginTop: -2 },

  emptyCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', marginVertical: 10 },
  emptyText: { color: '#9CA3AF', textAlign: 'center', fontSize: 14 },

  actionButton: { backgroundColor: '#4ade80', paddingVertical: 16, borderRadius: 16, marginTop: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  actionButtonDisabled: { backgroundColor: '#E5E7EB', opacity: 0.7, elevation: 0 },
  actionButtonText: { color: '#000', fontWeight: '700', textAlign: 'center', fontSize: 16 },

  historyHeaderContainer: { marginTop: 30, marginBottom: 15 },
  historyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  divider: { height: 2, backgroundColor: '#E5E7EB', width: '100%' },
  noRecipesText: { fontStyle: 'italic', color: '#9CA3AF', textAlign: 'center', marginVertical: 20 },

  recipeCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#F3F4F6', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  recipeCardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  recipeCardInstructions: { fontSize: 14, color: '#4B5563', lineHeight: 22, marginTop: 10 },
  
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  badge: { backgroundColor: '#EFF6FF', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 0.5, borderColor: '#BFDBFE' },
  badgeText: { color: '#1E40AF', fontSize: 12, fontWeight: '600' }
});