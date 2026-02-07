/**
 * API Configuration
 */

// URL del backend desplegado en Render
const PRODUCTION_URL = 'https://automatizacionlogistica.onrender.com';

// Para desarrollo local (descomentar si necesitas):
// const LOCAL_IP = '10.0.2.2';
// const LOCAL_URL = `http://${LOCAL_IP}:8000`;

export const API_CONFIG = {
  BASE_URL: PRODUCTION_URL,
  TIMEOUT: 60000, // 60 segundos (Render free puede tardar en despertar)
};

console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);

export default API_CONFIG;
