/**
 * API Configuration
 */

// 10.0.2.2 es la IP especial que el emulador Android usa para acceder a localhost del host
const LOCAL_IP = '10.0.2.2';
const API_PORT = '8000';

export const API_CONFIG = {
  BASE_URL: `http://${LOCAL_IP}:${API_PORT}`,
  TIMEOUT: 30000, // 30 segundos
};

console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);

export default API_CONFIG;
