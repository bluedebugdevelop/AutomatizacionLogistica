/**
 * Sales Automation App - Búsqueda de Amazon y Subida a Wallapop
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Image,
  Linking,
  StatusBar,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { checkHealth } from './src/services/api';
import { searchAmazon, AmazonProduct } from './src/services/amazon';
import { searchAmazonByImage } from './src/services/imageSearch';
import API_CONFIG from './src/constants/api';
import ProductFormScreen from './src/screens/ProductFormScreen';
import LoginScreen, { UserRole } from './src/screens/LoginScreen';
import VendedorScreen from './src/screens/VendedorScreen';

type Screen = 'login' | 'search' | 'form';
type SearchMode = 'text' | 'image';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState<string>('');
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('text');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [productResult, setProductResult] = useState<AmazonProduct | null>(null);
  const [productResults, setProductResults] = useState<AmazonProduct[]>([]);
  const [showImageOptions, setShowImageOptions] = useState(false);

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem('userSession');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.role && parsed?.username) {
            setUserRole(parsed.role as UserRole);
            setUsername(parsed.username as string);
            setCurrentScreen('search');
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const isHealthy = await checkHealth();
      setBackendStatus(isHealthy ? 'online' : 'offline');
    } catch (error) {
      setBackendStatus('offline');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Por favor ingresa un término de búsqueda');
      return;
    }

    if (searchQuery.trim().length < 3) {
      Alert.alert('Error', 'La búsqueda debe tener al menos 3 caracteres');
      return;
    }

    setIsSearching(true);
    setProductResult(null);
    setProductResults([]);

    try {
      console.log('Buscando:', searchQuery);
      const response = await searchAmazon(searchQuery.trim());
      
      console.log('Resultado:', response.product.title);
      setProductResult(response.product);
    } catch (error: any) {
      console.error('Error:', error);
      
      const errorMessage = error.response?.data?.detail || error.message || 'Error desconocido';
      
      Alert.alert(
        'Error en la búsqueda',
        `No se pudo buscar el producto.\n\n${errorMessage}`,
        [
          { text: 'Reintentar', onPress: handleSearch },
          { text: 'Cancelar', style: 'cancel' }
        ]
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchByImage = () => {
    setShowImageOptions(true);
  };

  const captureImage = (source: 'camera' | 'gallery') => {
    console.log('captureImage llamado con:', source);
    setShowImageOptions(false);
    
    const imagePickerOptions = {
      mediaType: 'photo' as const,
      quality: 1.0, // Cambiado a 1.0, que es un valor válido
      maxWidth: 1920,
      maxHeight: 1920,
      includeBase64: false,
      saveToPhotos: false,
    };

    const callback = async (response: any) => {
      console.log('Callback recibido:', { didCancel: response.didCancel, errorCode: response.errorCode, assetsLength: response.assets?.length });
      
      if (response.didCancel) {
        console.log('Usuario canceló la selección');
        return;
      }
      
      if (response.errorCode) {
        console.error('Error de image picker:', response.errorCode, response.errorMessage);
        Alert.alert('Error', `No se pudo acceder a ${source === 'camera' ? 'la cámara' : 'la galería'}: ${response.errorMessage}`);
        return;
      }
      
      if (response.assets && response.assets.length > 0) {
        const photo = response.assets[0];
        console.log('Foto capturada:', photo.uri);
        
        setIsSearching(true);
        setProductResult(null);
        setProductResults([]);

        try {
          console.log('Buscando por imagen...');
          const result = await searchAmazonByImage(photo);
          
          console.log('Productos encontrados:', result.products?.length || 0);
          setProductResults(result.products || []);
          
          Alert.alert(
            'Producto identificado',
            `Se identificó: ${result.identified_query}\n\nSe encontraron ${result.products?.length || 0} opciones`
          );
        } catch (error: any) {
          console.error('Error:', error);
          
          Alert.alert(
            'Error en búsqueda por imagen',
            error.message || 'No se pudo identificar el producto',
            [
              { text: 'Reintentar', onPress: handleSearchByImage },
              { text: 'Cancelar', style: 'cancel' }
            ]
          );
        } finally {
          setIsSearching(false);
        }
      }
    };

    console.log('Lanzando picker:', source);
    try {
      if (source === 'camera') {
        launchCamera(imagePickerOptions, callback);
      } else {
        launchImageLibrary(imagePickerOptions, callback);
      }
    } catch (error) {
      console.error('Error al lanzar picker:', error);
      Alert.alert('Error', 'No se pudo abrir el selector de imágenes');
    }
  };

  const handleContinueToForm = (product: AmazonProduct) => {
    setProductResult(product);
    setCurrentScreen('form');
  };

  const handleBackToSearch = () => {
    setCurrentScreen('search');
  };

  const handleProductSaved = () => {
    // Reset y volver a la búsqueda
    setProductResult(null);
    setProductResults([]);
    setSearchQuery('');
    setCurrentScreen('search');
  };

  const handleLogin = (role: UserRole, user: string) => {
    setUserRole(role);
    setUsername(user);
    setCurrentScreen('search');
    AsyncStorage.setItem('userSession', JSON.stringify({ role, username: user })).catch(() => undefined);
  };

  const handleLogout = () => {
    setUserRole(null);
    setUsername('');
    setProductResult(null);
    setProductResults([]);
    setSearchQuery('');
    setCurrentScreen('login');
    AsyncStorage.removeItem('userSession').catch(() => undefined);
  };

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url);
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'online': return '#4CAF50';
      case 'offline': return '#F44336';
      case 'checking': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'online': return 'Conectado';
      case 'offline': return 'Desconectado';
      case 'checking': return 'Verificando...';
      default: return 'Desconocido';
    }
  };

  if (isRestoringSession) {
    return (
      <View style={styles.sessionLoadingContainer}>
        <ActivityIndicator size="large" color="#0F172A" />
        <Text style={styles.sessionLoadingText}>Cargando sesión...</Text>
      </View>
    );
  }

  // Renderizar pantalla de login
  if (currentScreen === 'login') {
    return <LoginScreen onLoginSuccess={handleLogin} />;
  }

  // Renderizar pantalla de vendedor
  if (userRole === 'vendedor') {
    return <VendedorScreen onLogout={handleLogout} username={username} />;
  }

  // Renderizar pantalla de formulario si estamos en ese flujo (operario)
  if (currentScreen === 'form' && productResult) {
    return (
      <ProductFormScreen
        amazonData={{
          title: productResult.title,
          price: productResult.price || 0,
          description: productResult.features?.join('\n') || productResult.description || '',
          image_url: productResult.image || '',
          url: productResult.url,
        }}
        onSuccess={handleProductSaved}
        onBack={handleBackToSearch}
      />
    );
  }

  // Pantalla de búsqueda principal (operario)
  return (
    <View style={styles.wrapper}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
              <Text style={styles.menuButtonText}>☰</Text>
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>Sales Automation</Text>
              <Text style={styles.subtitle}>Bienvenido, {username}</Text>
            </View>
          </View>
        </View>

        {/* Amazon Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Buscar Producto</Text>
          
          {/* Selector de modo de búsqueda */}
          <View style={styles.searchModeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, searchMode === 'text' && styles.modeButtonActive]}
              onPress={() => {
                setSearchMode('text');
                setProductResult(null);
                setProductResults([]);
              }}
            >
              <Text style={[styles.modeButtonText, searchMode === 'text' && styles.modeButtonTextActive]}>
                EAN
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modeButton, searchMode === 'image' && styles.modeButtonActive]}
              onPress={() => {
                setSearchMode('image');
                setProductResult(null);
                setProductResults([]);
              }}
            >
              <Text style={[styles.modeButtonText, searchMode === 'image' && styles.modeButtonTextActive]}>
                Imagen
              </Text>
            </TouchableOpacity>
          </View>
          
          {searchMode === 'text' ? (
            <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Ej: iPhone 15 Pro, Samsung Galaxy..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={!isSearching && backendStatus === 'online'}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            
            <TouchableOpacity
              style={[
                styles.searchButton,
                (isSearching || backendStatus === 'offline') && styles.searchButtonDisabled
              ]}
              onPress={handleSearch}
              disabled={isSearching || backendStatus === 'offline'}
            >
              {isSearching ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Buscar</Text>
              )}
            </TouchableOpacity>
          </View>
          ) : (
            <View style={styles.imageSearchContainer}>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleSearchByImage}
                disabled={isSearching}
              >
                {isSearching ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.cameraButtonText}>Buscar por Imagen</Text>
                )}
              </TouchableOpacity>

              {showImageOptions && !isSearching && (
                <View style={styles.imageOptions}>
                  <TouchableOpacity
                    style={styles.imageOptionButton}
                    onPress={() => captureImage('camera')}
                  >
                    <Text style={styles.imageOptionText}>Cámara</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.imageOptionButton}
                    onPress={() => captureImage('gallery')}
                  >
                    <Text style={styles.imageOptionText}>Galería</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {isSearching && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111827" />
              <Text style={styles.loadingText}>Buscando en Amazon...</Text>
              <Text style={styles.loadingSubtext}>Esto puede tardar unos segundos</Text>
            </View>
          )}

          {/* Product Result Card (Texto) */}
          {searchMode === 'text' && productResult && !isSearching && (
            <View style={styles.productCard}>
              <View style={styles.productHeader}>
                {productResult.image && (
                  <Image
                    source={{ uri: productResult.image }}
                    style={styles.productImage}
                    resizeMode="contain"
                  />
                )}
                
                <View style={styles.productHeaderInfo}>
                  <Text style={styles.productTitle}>
                    {productResult.title}
                  </Text>
                  
                  {productResult.price ? (
                    <Text style={styles.productPrice}>
                      {productResult.price} €
                    </Text>
                  ) : (
                    <Text style={styles.productPriceUnavailable}>
                      Precio no disponible
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={() => handleContinueToForm(productResult)}
                >
                  <Text style={styles.continueButtonText}>Confirmar Producto</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Product Result Cards (Imagen) */}
          {searchMode === 'image' && productResults.length > 0 && !isSearching && (
            <View style={styles.productList}>
              {productResults.map((item, index) => (
                <View key={`${item.asin || index}`} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    {item.image && (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.productImage}
                        resizeMode="contain"
                      />
                    )}
                    
                    <View style={styles.productHeaderInfo}>
                      <Text style={styles.productTitle}>
                        {item.title}
                      </Text>
                      
                      {item.price ? (
                        <Text style={styles.productPrice}>
                          {item.price} €
                        </Text>
                      ) : (
                        <Text style={styles.productPriceUnavailable}>
                          Precio no disponible
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => handleContinueToForm(item)}
                    >
                      <Text style={styles.continueButtonText}>Elegir este producto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Product Result Cards (Imagen) */}
          {searchMode === 'image' && productResults.length > 0 && !isSearching && (
            <View style={styles.productList}>
              {productResults.map((item, index) => (
                <View key={`${item.url || index}`} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={styles.productImage}
                        resizeMode="contain"
                      />
                    )}
                    
                    <View style={styles.productHeaderInfo}>
                      <Text style={styles.productTitle}>
                        {item.title}
                      </Text>
                      
                      {item.price_available && item.price ? (
                        <Text style={styles.productPrice}>
                          {item.price.toFixed(2)} {item.currency}
                        </Text>
                      ) : (
                        <Text style={styles.productPriceUnavailable}>
                          {item.price_message || 'Precio no disponible'}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.continueButton}
                      onPress={() => handleContinueToForm(item)}
                    >
                      <Text style={styles.continueButtonText}>Elegir este producto</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={menuVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.menuOverlay}>
          <View style={styles.menuPanel}>
            <Text style={styles.menuTitle}>Menú</Text>
            <Text style={styles.menuSubtitle}>{username}</Text>
            <TouchableOpacity
              style={styles.menuPrimaryButton}
              onPress={() => {
                setMenuVisible(false);
                handleLogout();
              }}
            >
              <Text style={styles.menuPrimaryText}>Cerrar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuSecondaryButton}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuSecondaryText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
  },
  sessionLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  wrapper: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '400',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '600',
  },
  searchSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 18,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  searchModeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modeButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  modeButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  modeButtonTextActive: {
    color: 'white',
  },
  searchBox: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  searchButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.6,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cameraButton: {
    backgroundColor: '#111827',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  imageSearchContainer: {
    gap: 12,
  },
  imageOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  imageOptionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  imageOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
  },
  productCard: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productList: {
    gap: 16,
  },
  productHeader: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  productHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  productPriceUnavailable: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  descriptionContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 6,
  },
  actionButtons: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  menuBackdrop: {
    flex: 1,
  },
  menuPanel: {
    width: '72%',
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF1F6',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 20,
  },
  menuPrimaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  menuPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  menuSecondaryButton: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuSecondaryText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
});
