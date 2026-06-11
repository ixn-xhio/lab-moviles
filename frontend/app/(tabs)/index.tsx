// CameraScreen.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCamera } from '@/hooks/useCamera';

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
  const [isSaving, setIsSaving] = useState(false); // 🟢 Estado para el guardado en DB
  const [plantResult, setPlantResult] = useState<any>(null);

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

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        {
          compress: 0.4,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      let base64 = manipulated.base64 || '';

      if (base64.length > 200000) {
        base64 = base64.slice(0, 200000);
      }

      const response = await fetch('http://74.220.28.80/identify-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64}`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('API RESULT:', data);

      setPlantResult(data);
    } catch (e) {
      console.error('FETCH ERROR:', e);
      Alert.alert('Error', 'Fallo en la identificación');
    } finally {
      setIsSyncing(false);
    }
  };

  // 🟢 NUEVA FUNCIÓN: Enviar la data limpia elegida al Backend para insertar en DB
  const handleSaveToDB = async () => {
    const suggestion = plantResult?.suggestions?.[0];
    if (!suggestion) return;

    setIsSaving(true);

    try {
      const response = await fetch('http://74.220.28.80/save-plant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plant_name: suggestion.plant_name,
          probability: (suggestion.probability * 100).toFixed(2),
          common_name: suggestion.plant_details?.common_names?.[0] || null
        })
      });

      if (!response.ok) throw new Error('Error en la respuesta del servidor');

      Alert.alert('¡Logrado!', 'La planta ha sido registrada en tu bitácora.');
      
      // Limpiar estados y regresar a la cámara
      setLastPhoto(null);
      setPlantResult(null);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar la planta en la base de datos.');
    } finally {
      setIsSaving(false);
    }
  };

  if (cameraStatus === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>La cámara está bloqueada</Text>
        <TouchableOpacity style={styles.btn} onPress={askForPermission}>
          <Text style={styles.btnText}>Solicitar Acceso de Nuevo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const suggestion = plantResult?.suggestions?.[0];

  return (
    <View style={styles.container}>
      {lastPhoto ? (
        <View style={styles.container}>
          <Image source={{ uri: lastPhoto.uri }} style={styles.full} />

          <View style={styles.overlay}>
            {isSyncing ? (
              <ActivityIndicator size="large" color="#4ade80" />
            ) : (
              <View style={styles.card}>
                <Text style={styles.title}>
                  {suggestion?.plant_name || 'Planta Identificada'}
                </Text>

                {suggestion?.probability && (
                  <Text style={styles.subtitle}>
                    {(suggestion.probability * 100).toFixed(2)}% de certeza
                  </Text>
                )}

                {suggestion?.plant_details?.common_names?.[0] && (
                  <Text style={styles.subtitleCommon}>
                    Común: {suggestion.plant_details.common_names[0]}
                  </Text>
                )}

                {/* 🟢 BOTÓN NUEVO: Guardar en Bitácora */}
                {suggestion && (
                  <TouchableOpacity
                    onPress={handleSaveToDB}
                    style={[styles.btn, styles.btnSave]}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.btnSaveText}>🌱 Guardar en Bitácora</Text>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setLastPhoto(null);
                    setPlantResult(null);
                  }}
                  style={styles.btnCancel}
                >
                  <Text style={styles.btnCancelText}>Volver</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <CameraView ref={cameraRef} style={styles.full}>
          <View style={styles.footer}>
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
  
  // Botones genéricos y específicos
  btn: { padding: 15, borderRadius: 10, marginTop: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', textAlign: 'center' },
  
  btnSave: { backgroundColor: '#4ade80', marginTop: 15 },
  btnSaveText: { color: '#000', fontWeight: 'bold', textAlign: 'center' },
  
  btnCancel: { backgroundColor: '#E5E7EB', padding: 12, borderRadius: 10, marginTop: 8 },
  btnCancelText: { color: '#374151', fontWeight: '600', textAlign: 'center' },

  footer: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
  snap: { width: 75, height: 75, borderRadius: 40, backgroundColor: '#fff', borderWidth: 5, borderColor: '#ccc' },
  overlay: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 20, width: '85%', elevation: 5 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 5, color: '#111827' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 4, color: '#059669', fontWeight: '600' },
  subtitleCommon: { fontSize: 14, textAlign: 'center', marginBottom: 10, color: '#4B5563', fontStyle: 'italic' }
});