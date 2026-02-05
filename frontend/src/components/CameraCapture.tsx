/**
 * CameraCapture Component
 * Permite capturar hasta 6 fotos del producto
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';

interface CameraCaptureProps {
  maxPhotos?: number;
  onPhotosChange: (photos: Asset[]) => void;
}

export default function CameraCapture({ maxPhotos = 6, onPhotosChange }: CameraCaptureProps) {
  const [photos, setPhotos] = useState<Asset[]>([]);

  const handleTakePhoto = () => {
    if (photos.length >= maxPhotos) {
      Alert.alert('Límite alcanzado', `Solo puedes tomar ${maxPhotos} fotos`);
      return;
    }

    Alert.alert(
      'Seleccionar imagen',
      'Elige una opción',
      [
        {
          text: 'Tomar foto',
          onPress: () => openCamera(),
        },
        {
          text: 'Elegir de galería',
          onPress: () => openGallery(),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const openCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
        saveToPhotos: false,
      },
      (response) => {
        if (response.didCancel) {
          console.log('Usuario canceló la cámara');
        } else if (response.errorCode) {
          Alert.alert('Error', `No se pudo acceder a la cámara: ${response.errorMessage}`);
        } else if (response.assets && response.assets.length > 0) {
          const newPhotos = [...photos, ...response.assets];
          setPhotos(newPhotos);
          onPhotosChange(newPhotos);
        }
      }
    );
  };

  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: maxPhotos - photos.length,
        maxWidth: 1920,
        maxHeight: 1920,
        includeBase64: false,
      },
      (response) => {
        if (response.didCancel) {
          console.log('Usuario canceló la selección');
        } else if (response.errorCode) {
          Alert.alert('Error', `No se pudo acceder a la galería: ${response.errorMessage}`);
        } else if (response.assets && response.assets.length > 0) {
          const newPhotos = [...photos, ...response.assets];
          setPhotos(newPhotos);
          onPhotosChange(newPhotos);
        }
      }
    );
  };

  const removePhoto = (index: number) => {
    Alert.alert('Eliminar foto', '¿Estás seguro de eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          const newPhotos = photos.filter((_, i) => i !== index);
          setPhotos(newPhotos);
          onPhotosChange(newPhotos);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Fotografías</Text>
        <View style={styles.counterBadge}>
          <Text style={styles.counter}>
            {photos.length} / {maxPhotos}
          </Text>
        </View>
      </View>

      {/* Galería de fotos */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(index)}>
              <Text style={styles.removeButtonText}>Eliminar</Text>
            </TouchableOpacity>
            <Text style={styles.photoNumber}>{index + 1}</Text>
          </View>
        ))}

        {/* Botón para añadir más fotos */}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleTakePhoto}>
            <Text style={styles.addPhotoText}>Añadir foto</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {photos.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Sin fotografías</Text>
          <Text style={styles.emptySubtext}>Añade fotos del producto para continuar</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  counterBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  counter: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  gallery: {
    marginVertical: 10,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photo: {
    width: 124,
    height: 124,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  photoNumber: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 124,
    height: 124,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addPhotoText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
