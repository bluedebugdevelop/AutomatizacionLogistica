/**
 * API Service - Search by image
 */
import axios from 'axios';
import { Asset } from 'react-native-image-picker';
import API_CONFIG from '../constants/api';
import { AmazonProduct } from './amazon';

export interface SearchByImageResponse {
  success: boolean;
  identified_query: string;
  search_method: string;
  products: AmazonProduct[];
  product?: AmazonProduct | null;
}

export const searchAmazonByImage = async (
  photo: Asset,
  headless: boolean = true
): Promise<SearchByImageResponse> => {
  try {
    const formData = new FormData();

    // Añadir imagen - React Native requiere este formato específico
    formData.append('file', {
      uri: photo.uri!,
      type: photo.type || 'image/jpeg',
      name: photo.fileName || 'product.jpg',
    } as any);
    
    formData.append('headless', String(headless));

    console.log('📸 Enviando imagen al backend...');
    console.log('URI:', photo.uri);
    console.log('Type:', photo.type);
    console.log('Name:', photo.fileName);

    const response = await axios.post<SearchByImageResponse>(
      `${API_CONFIG.BASE_URL}/search-amazon-by-image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 180000, // 3 minutos - búsqueda por imagen tarda más (AI Vision + Amazon scraping)
      }
    );

    console.log('✅ Producto identificado:', response.data.identified_query);
    return response.data;
  } catch (error: any) {
    console.error('❌ Error en búsqueda por imagen:', error);

    if (error.response) {
      throw new Error(error.response.data?.detail || 'Error del servidor');
    } else if (error.request) {
      throw new Error('No se pudo conectar con el servidor');
    } else {
      throw new Error('Error al preparar la petición');
    }
  }
};
