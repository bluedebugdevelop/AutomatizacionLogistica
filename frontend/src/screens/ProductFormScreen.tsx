/**
 * ProductFormScreen - Pantalla para completar datos del producto
 * Recibe datos de Amazon y permite añadir fotos reales y desperfectos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Asset } from 'react-native-image-picker';
import CameraCapture from '../components/CameraCapture';
import { uploadProduct } from '../services/api';

interface ProductFormProps {
  amazonData: {
    title: string;
    price: number;
    description: string;
    image_url?: string;
    url?: string;
  };
  onSuccess: () => void;
  onBack: () => void;
}

export default function ProductFormScreen({ amazonData, onSuccess, onBack }: ProductFormProps) {
  const [photos, setPhotos] = useState<Asset[]>([]);
  const [defects, setDefects] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Calcular precio Wallapop según la lógica
  const calculateWallapopPrice = (amazonPrice: number): number => {
    if (amazonPrice < 250) {
      return amazonPrice * 0.5;
    } else {
      return amazonPrice * 0.6;
    }
  };

  const wallapopPrice = calculateWallapopPrice(amazonData.price);
  const savings = amazonData.price - wallapopPrice;

  const handleSubmit = async () => {
    // Validaciones
    if (photos.length === 0) {
      Alert.alert('Error', 'Debes añadir al menos una foto del producto');
      return;
    }

    if (!defects.trim()) {
      Alert.alert(
        'Confirmar',
        'No has descrito desperfectos. ¿El producto está en perfecto estado?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => submitProduct() },
        ]
      );
      return;
    }

    submitProduct();
  };

  const submitProduct = async () => {
    setIsUploading(true);

    try {
      const result = await uploadProduct({
        title: amazonData.title,
        amazon_price: amazonData.price,
        amazon_description: amazonData.description,
        defects_description: defects.trim() || 'Ningún desperfecto',
        amazon_image_url: amazonData.image_url,
        amazon_url: amazonData.url,
        photos: photos,
      });

      Alert.alert(
        '¡Éxito!',
        `Producto preparado correctamente\n\nPrecio: ${wallapopPrice.toFixed(2)}€\nFotos: ${photos.length}`,
        [{ text: 'Aceptar', onPress: onSuccess }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'No se pudo enviar el producto. Intenta de nuevo.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles del Producto</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Datos de Amazon */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información del Producto</Text>

          {amazonData.image_url && (
            <Image source={{ uri: amazonData.image_url }} style={styles.amazonImage} />
          )}

          <Text style={styles.productTitle}>{amazonData.title}</Text>

          <View style={styles.priceRow}>
            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Precio Amazon</Text>
              <Text style={styles.priceValue}>{amazonData.price.toFixed(2)}€</Text>
            </View>

            <View style={styles.arrow}>
              <Text style={styles.arrowText}>→</Text>
            </View>

            <View style={[styles.priceBox, styles.wallapopBox]}>
              <Text style={styles.priceLabel}>Precio Wallapop</Text>
              <Text style={[styles.priceValue, styles.wallapopPrice]}>
                {wallapopPrice.toFixed(2)}€
              </Text>
              <Text style={styles.savings}>Ahorras: {savings.toFixed(2)}€</Text>
            </View>
          </View>
        </View>

        {/* Cámara */}
        <View style={styles.section}>
          <CameraCapture maxPhotos={6} onPhotosChange={setPhotos} />
        </View>

        {/* Desperfectos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estado del Producto</Text>
          <Text style={styles.hint}>
            Describe el estado: arañazos, golpes, caja abierta, etc.
          </Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ej: Caja abierta, pequeño arañazo en la esquina inferior..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={5}
            value={defects}
            onChangeText={setDefects}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{defects.length} caracteres</Text>
        </View>

        {/* Botón de envío */}
        <TouchableOpacity
          style={[styles.submitButton, isUploading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.submitButtonText}>Enviando...</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>Preparar para Venta</Text>
          )}
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
  section: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  amazonImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 15,
    resizeMode: 'contain',
  },
  productTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 15,
    lineHeight: 22,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  wallapopBox: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  priceLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  wallapopPrice: {
    color: '#059669',
  },
  savings: {
    fontSize: 11,
    color: '#059669',
    marginTop: 4,
    fontWeight: '500',
  },
  arrow: {
    marginHorizontal: 10,
  },
  arrowText: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  hint: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 18,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    backgroundColor: '#F9FAFB',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
  },
  submitButton: {
    backgroundColor: '#111827',
    margin: 24,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bottomPadding: {
    height: 30,
  },
});
