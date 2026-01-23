/**
 * Amazon API Service - Búsqueda de productos
 */
import axios from 'axios';
import API_CONFIG from '../constants/api';

export interface AmazonProduct {
  title: string;
  price: number | null;
  currency: string;
  description: string | null;
  features: string[];
  image_url: string | null;
  url: string;
  price_available: boolean;
  price_message?: string;
}

export interface AmazonSearchResponse {
  success: boolean;
  query: string;
  product: AmazonProduct;
}

/**
 * Buscar producto en Amazon
 */
export const searchAmazon = async (query: string): Promise<AmazonSearchResponse> => {
  try {
    console.log('🔍 Buscando en Amazon:', query);
    
    const response = await axios.get<AmazonSearchResponse>(
      `${API_CONFIG.BASE_URL}/search-amazon`,
      {
        params: { query: query },
        timeout: 60000, // 60 segundos para el scraping
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('Error buscando en Amazon:', error.response?.data || error.message);
    throw error;
  }
};
