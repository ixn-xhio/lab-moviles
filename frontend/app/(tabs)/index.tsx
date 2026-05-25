// CameraScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView
} from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCamera } from '@/hooks/useCamera';

// Definimos la interfaz basada en tu nuevo backend RAG
interface AIResult {
  description: string;
  classification: string;
  danger_level: string;
  confidence: number;
  similar_findings: string[]; // Los strings que vienen del RAG
}

export default function CameraScreen() {
  const {
    cameraRef,
    cameraStatus,
    isReady,
    askForPermission,
    lastPhoto,
    setLastPhoto
  } = useCamera();

  const [isSyncing, setIsSyncing] = useState(false);
  const [analysis, setAnalysis] = useState<AIResult | null>(null);

  const handleIdentify = async () => {
    if (!cameraRef.current) return;

    setIsSyncing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.3,
        skipProcessing: true
      });

      setLastPhoto(photo);

      // Reducción de imagen para optimizar el envío
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        {
          compress: 0.4,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      const base64 = manipulated.base64 || '';

      // NOTA: Ajusta esta URL a tu endpoint de clasificación
      const response = await fetch('http://desynth.dev/classification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          photo_url: `data:image/jpeg;base64,${base64}` // Enviando base64 como URL temporal
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: AIResult = await response.json();
      setAnalysis(data);

    } catch (e) {
      console.error('FETCH ERROR:', e);
      Alert.alert('Error', 'No se pudo clasificar la forma de vida.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (cameraStatus === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>La cámara está bloqueada</Text>
        <TouchableOpacity style={styles.btn} onPress={askForPermission}>
          <Text style={styles.btnText}>Solicitar Acceso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {lastPhoto ? (
        <View style={styles.container}>
          <Image source={{ uri: lastPhoto.uri }} style={styles.full} />

          <View style={styles.overlay}>
            {isSyncing ? (
              <ActivityIndicator size="large" color="#4ade80" />
            ) : (
              <ScrollView style={styles.cardContainer} contentContainerStyle={styles.cardContent}>
                <View style={styles.card}>
                  <Text style={styles.badge}>{analysis?.classification || 'UNKNOWN'}</Text>
                  
                  <Text style={styles.title}>Análisis de Bitácora</Text>
                  
                  <Text style={styles.description}>
                    {analysis?.description || 'Procesando descubrimiento...'}
                  </Text>

                  <View style={styles.row}>
                    <Text style={styles.label}>Peligro:</Text>
                    <Text style={[
                      styles.value, 
                      { color: analysis?.danger_level === 'DANGEROUS' ? '#f87171' : '#4ade80' }
                    ]}>
                      {analysis?.danger_level}
                    </Text>
                  </View>

                  {/* SECCIÓN RAG: Similar Findings */}
                  {analysis?.similar_findings && analysis.similar_findings.length > 0 && (
                    <View style={styles.ragSection}>
                      <Text style={styles.ragTitle}>📚 Registros Similares en BD:</Text>
                      {analysis.similar_findings.map((finding, index) => (
                        <View key={index} style={styles.ragItem}>
                          <Text style={styles.ragText}>• {finding}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      setLastPhoto(null);
                      setAnalysis(null);
                    }}
                    style={styles.btn}
                  >
                    <Text style={styles.btnText}>Nueva Captura</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      ) : (
        <CameraView ref={cameraRef} style={styles.full}>
          <View style={styles.footer}>
            {/* AGREGAR testID AQUÍ */}
            <TouchableOpacity testID="snap-button" style={styles.snap} onPress={handleIdentify} />
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  full: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  text: { color: '#fff', marginBottom: 20 },
  btn: { backgroundColor: '#4ade80', padding: 15, borderRadius: 12, marginTop: 15 },
  btnText: { color: '#000', fontWeight: 'bold', textAlign: 'center' },
  footer: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  snap: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 4, borderColor: '#4ade80' },
  overlay: { position: 'absolute', bottom: 0, width: '100%', maxHeight: '70%' },
  
  cardContainer: { width: '100%' },
  cardContent: { alignItems: 'center', paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 20,
    borderRadius: 25,
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  
  badge: {
    alignSelf: 'center',
    backgroundColor: '#000',
    color: '#4ade80',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    overflow: 'hidden'
  },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#111' },
  description: { fontSize: 15, color: '#333', marginVertical: 10, textAlign: 'center', fontStyle: 'italic' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  label: { fontWeight: 'bold', color: '#666' },
  value: { fontWeight: 'bold' },

  // Estilos para el RAG
  ragSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    width: '100%'
  },
  ragTitle: { fontSize: 14, fontWeight: 'bold', color: '#059669', marginBottom: 8 },
  ragItem: { marginBottom: 6, backgroundColor: '#f0fdf4', padding: 8, borderRadius: 8 },
  ragText: { fontSize: 13, color: '#374151', lineHeight: 18 }
});