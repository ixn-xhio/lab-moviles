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
  const [plantResult, setPlantResult] = useState<any>(null);

  const handleIdentify = async () => {
    if (!cameraRef.current) return;

    setIsSyncing(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false, // 🔴 no base64 aquí
        quality: 0.3,
        skipProcessing: true
      });

      setLastPhoto(photo);

      // 🔥 REDUCE tamaño real de la imagen
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }], // clave: bajar resolución
        {
          compress: 0.4,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      let base64 = manipulated.base64 || '';

      // 🔴 HARD LIMIT para evitar 413
      if (base64.length > 200000) {
        base64 = base64.slice(0, 200000);
      }

      const response = await fetch('http://desynth.dev/identify-plant', {
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
                    {(suggestion.probability * 100).toFixed(2)}%
                  </Text>
                )}

                {suggestion?.plant_details?.common_names?.[0] && (
                  <Text style={styles.subtitle}>
                    {suggestion.plant_details.common_names[0]}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() => {
                    setLastPhoto(null);
                    setPlantResult(null);
                  }}
                  style={styles.btn}
                >
                  <Text style={styles.btnText}>Volver</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      ) : (
        <CameraView ref={cameraRef} style={styles.full}>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.snap} onPress={handleIdentify} />
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  full: { flex: 1 },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212'
  },

  text: { color: '#fff', marginBottom: 20 },

  btn: {
    backgroundColor: '#4ade80',
    padding: 15,
    borderRadius: 10,
    marginTop: 10
  },

  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center'
  },

  footer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center'
  },

  snap: {
    width: 75,
    height: 75,
    borderRadius: 40,
    backgroundColor: '#fff',
    borderWidth: 5,
    borderColor: '#ccc'
  },

  overlay: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    alignItems: 'center'
  },

  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    width: '80%'
  },

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5
  },

  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
    color: '#444'
  }
});