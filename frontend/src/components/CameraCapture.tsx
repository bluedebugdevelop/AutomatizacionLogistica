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
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.photoNumber}>{index + 1}</Text>
          </View>
        ))}

        {/* Botón para añadir más fotos */}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleTakePhoto}>
            <Text style={styles.addPhotoIcon}>+</Text>
            <Text style={styles.addPhotoText}>Añadir</Text>
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.2,
  },
  counterBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  counter: {
    fontSize: 13,
    color: '#6B7280',
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
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.95)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 14,
  },
  photoNumber: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.7)',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 120,
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#111827',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoIcon: {
    fontSize: 36,
    color: '#111827',
    marginBottom: 4,
    fontWeight: '300',
  },
  addPhotoText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});
