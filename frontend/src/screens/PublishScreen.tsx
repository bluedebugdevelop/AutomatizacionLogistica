/**
 * PublishScreen - Pantalla final para copiar datos y publicar en Wallapop
 * Muestra título, descripción optimizada, precio y fotos listas para copiar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Linking,
  Share,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Asset } from 'react-native-image-picker';
import RNFS from 'react-native-fs';

interface PublishScreenProps {
  productData: {
    title: string;
    description: string;
    price: number;
    photos: Asset[];
  };
  onBack: () => void;
  onFinish: () => void;
}

export default function PublishScreen({ productData, onBack, onFinish }: PublishScreenProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const [savedPhotos, setSavedPhotos] = useState<number[]>([]);

  const copyToClipboard = (text: string, fieldName: string) => {
    Clipboard.setString(text);
    setCopiedField(fieldName);
    
    // Resetear el estado después de 2 segundos
    setTimeout(() => setCopiedField(null), 2000);
  };

  const savePhotoToGallery = async (photo: Asset, index: number) => {
    try {
      if (!photo.uri) return false;

      // Copiar la foto al directorio de Pictures
      const destFolder = Platform.OS === 'android' 
        ? RNFS.PicturesDirectoryPath 
        : RNFS.DocumentDirectoryPath;
      
      const fileName = `wallapop_${Date.now()}_${index + 1}.jpg`;
      const destPath = `${destFolder}/${fileName}`;
      
      // Obtener la ruta sin el prefijo file://
      const sourcePath = photo.uri.replace('file://', '');
      
      await RNFS.copyFile(sourcePath, destPath);
      
      // En Android, escanear para que aparezca en la galería
      if (Platform.OS === 'android') {
        await RNFS.scanFile(destPath);
      }
      
      setSavedPhotos(prev => [...prev, index]);
      return true;
    } catch (error) {
      console.log('Error saving photo:', error);
      return false;
    }
  };

  const saveAllPhotos = async () => {
    setSavingPhotos(true);
    let savedCount = 0;

    for (let i = 0; i < productData.photos.length; i++) {
      const success = await savePhotoToGallery(productData.photos[i], i);
      if (success) savedCount++;
    }

    setSavingPhotos(false);
    Alert.alert(
      'Fotos guardadas',
      `Se guardaron ${savedCount} de ${productData.photos.length} fotos en tu galería`
    );
  };

  const openWallapop = async () => {
    // Primero copiar la descripción
    Clipboard.setString(productData.description);
    
    // Intentar abrir Wallapop
    const wallapopUrl = 'wallapop://';
    const wallapopWebUrl = 'https://es.wallapop.com/app/catalog/upload';
    
    try {
      const canOpen = await Linking.canOpenURL(wallapopUrl);
      if (canOpen) {
        await Linking.openURL(wallapopUrl);
      } else {
        await Linking.openURL(wallapopWebUrl);
      }
    } catch (error) {
      Alert.alert('Info', 'Abre Wallapop manualmente y pega los datos');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publicar en Wallapop</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Instrucciones */}
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsTitle}>Instrucciones</Text>
          <Text style={styles.instructionsText}>
            1. Guarda las fotos en tu galería{'\n'}
            2. Copia el título, precio y descripción{'\n'}
            3. Abre Wallapop y pega los datos
          </Text>
        </View>

        {/* Título */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Título</Text>
            <TouchableOpacity 
              style={[styles.copyButton, copiedField === 'title' && styles.copiedButton]}
              onPress={() => copyToClipboard(productData.title, 'title')}
            >
              <Text style={styles.copyButtonText}>
                {copiedField === 'title' ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.copyableBox}
            onPress={() => copyToClipboard(productData.title, 'title')}
            activeOpacity={0.7}
          >
            <Text style={styles.titleText}>{productData.title}</Text>
          </TouchableOpacity>
        </View>

        {/* Precio */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Precio</Text>
            <TouchableOpacity 
              style={[styles.copyButton, copiedField === 'price' && styles.copiedButton]}
              onPress={() => copyToClipboard(productData.price.toFixed(2), 'price')}
            >
              <Text style={styles.copyButtonText}>
                {copiedField === 'price' ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.priceBox}
            onPress={() => copyToClipboard(productData.price.toFixed(2), 'price')}
            activeOpacity={0.7}
          >
            <Text style={styles.priceText}>{productData.price.toFixed(2)}€</Text>
          </TouchableOpacity>
        </View>

        {/* Descripción */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Descripción</Text>
            <TouchableOpacity 
              style={[styles.copyButton, copiedField === 'description' && styles.copiedButton]}
              onPress={() => copyToClipboard(productData.description, 'description')}
            >
              <Text style={styles.copyButtonText}>
                {copiedField === 'description' ? 'Copiado' : 'Copiar'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={styles.copyableBox}
            onPress={() => copyToClipboard(productData.description, 'description')}
            activeOpacity={0.7}
          >
            <Text style={styles.descriptionText}>{productData.description}</Text>
          </TouchableOpacity>
        </View>

        {/* Fotos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fotos ({productData.photos.length})</Text>
            <TouchableOpacity 
              style={[styles.savePhotosButton, savingPhotos && styles.savePhotosButtonDisabled]}
              onPress={saveAllPhotos}
              disabled={savingPhotos}
            >
              <Text style={styles.savePhotosButtonText}>
                {savingPhotos ? 'Guardando...' : 'Guardar todas'}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
            {productData.photos.map((photo, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.photoContainer}
                onPress={() => savePhotoToGallery(photo, index)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <View style={[
                  styles.photoStatus,
                  savedPhotos.includes(index) && styles.photoSaved
                ]}>
                  <Text style={styles.photoStatusText}>
                    {savedPhotos.includes(index) ? 'Guardada' : 'Guardar'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Botón abrir Wallapop */}
        <TouchableOpacity style={styles.wallapopButton} onPress={openWallapop}>
          <Text style={styles.wallapopButtonText}>Abrir Wallapop</Text>
        </TouchableOpacity>

        {/* Botón finalizar */}
        <TouchableOpacity style={styles.finishButton} onPress={onFinish}>
          <Text style={styles.finishButtonText}>Terminado</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  instructionsBox: {
    backgroundColor: '#EEF2FF',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  instructionsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4338CA',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#4338CA',
    lineHeight: 22,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  copiedButton: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  copyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  copyableBox: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 24,
  },
  priceBox: {
    backgroundColor: '#F0FDF4',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  priceText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: -1,
  },
  descriptionText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
  },
  savePhotosButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  savePhotosButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  savePhotosButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  photosRow: {
    flexDirection: 'row',
  },
  photoContainer: {
    marginRight: 12,
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  photoStatus: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 6,
  },
  photoSaved: {
    backgroundColor: '#D1FAE5',
  },
  photoStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  wallapopButton: {
    backgroundColor: '#13C1AC',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  wallapopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
