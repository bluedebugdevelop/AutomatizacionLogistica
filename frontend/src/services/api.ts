/**
 * API Service - Health check and product upload
 */
import axios from 'axios';
import { Asset } from 'react-native-image-picker';
import API_CONFIG from '../constants/api';

/**
 * Verificar estado del backend
 */
export const checkHealth = async (): Promise<boolean> => {
  try {
    const response = await axios.get(`${API_CONFIG.BASE_URL}/`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch (error) {
    console.error('Backend offline:', error);
    return false;
  }
};

/**
 * Subir producto con fotos reales al backend
 */
export interface UploadProductData {
  title: string;
  amazon_price: number;
  amazon_description: string;
  defects_description: string;
  amazon_image_url?: string;
  amazon_url?: string;
  photos: Asset[];
}

export interface UploadProductResponse {
  success: boolean;
  message: string;
  product_id: string;
  task_id: string;
  pricing: {
    amazon_price: number;
    wallapop_price: number;
    savings: number;
  };
  photos_uploaded: number;
  optimized_description?: string;
}

export const uploadProduct = async (data: UploadProductData): Promise<UploadProductResponse> => {
  try {
    const formData = new FormData();

    // Añadir campos de texto
    formData.append('title', data.title);
    formData.append('amazon_price', data.amazon_price.toString());
    formData.append('amazon_description', data.amazon_description);
    formData.append('defects_description', data.defects_description);

    if (data.amazon_image_url) {
      formData.append('amazon_image_url', data.amazon_image_url);
    }

    if (data.amazon_url) {
      formData.append('amazon_url', data.amazon_url);
    }

    // Añadir fotos
    data.photos.forEach((photo, index) => {
      if (photo.uri) {
        const file = {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: photo.fileName || `photo_${index + 1}.jpg`,
        };
        formData.append('files', file as any);
      }
    });

    console.log('📤 Enviando producto al backend...');
    console.log('Título:', data.title);
    console.log('Precio:', data.amazon_price);
    console.log('Fotos:', data.photos.length);

    const response = await axios.post<UploadProductResponse>(
      `${API_CONFIG.BASE_URL}/upload-product`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 segundos
      }
    );

    console.log('✅ Producto enviado correctamente');
    return response.data;
  } catch (error: any) {
    console.error('❌ Error al enviar producto:', error);

    if (error.response) {
      throw new Error(error.response.data?.detail || 'Error del servidor');
    } else if (error.request) {
      throw new Error('No se pudo conectar con el servidor');
    } else {
      throw new Error('Error al preparar la petición');
    }
  }
};
