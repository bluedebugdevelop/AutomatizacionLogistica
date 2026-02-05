/**
 * VendedorScreen - Pantalla para el vendedor con lista de productos
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import RNFS from 'react-native-fs';
import API_CONFIG from '../constants/api';

interface Product {
  id: string;
  product_id: string;
  created_at: string;
  title: string;
  amazon_price: number;
  wallapop_price: number;
  optimized_description: string;
  defects: string;
  photos_count: number;
  photo_urls: string[];
  amazon_image_url?: string;
  status: string;
}

interface VendedorScreenProps {
  onLogout: () => void;
  username: string;
}

export default function VendedorScreen({ onLogout, username }: VendedorScreenProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchProducts = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      let url = `${API_CONFIG.BASE_URL}/products?limit=50`;
      
      if (searchText.trim()) {
        url += `&search=${encodeURIComponent(searchText.trim())}`;
      }
      if (dateFrom) {
        url += `&date_from=${dateFrom}`;
      }
      if (dateTo) {
        url += `&date_to=${dateTo}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setProducts(data.products);
        setTotalProducts(data.total);
      } else {
        Alert.alert('Error', 'No se pudieron cargar los productos');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      Alert.alert('Error', 'Error de conexión con el servidor');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchText, dateFrom, dateTo]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSearch = () => {
    fetchProducts();
  };

  const clearFilters = () => {
    setSearchText('');
    setDateFrom('');
    setDateTo('');
    setShowFilters(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    Clipboard.setString(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openWallapop = async () => {
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
      Alert.alert('Información', 'Abre Wallapop manualmente y pega los datos');
    }
  };

  const updateProductStatus = async (productId: string, status: string) => {
    try {
      const formData = new FormData();
      formData.append('status', status);
      
      const response = await fetch(`${API_CONFIG.BASE_URL}/products/${productId}/status`, {
        method: 'PATCH',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Éxito', data.message);
        fetchProducts(true);
        setSelectedProduct(null);
      } else {
        Alert.alert('Error', data.detail || 'No se pudo actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Error de conexión');
    }
  };

  const deleteProduct = async (productId: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar este producto? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_CONFIG.BASE_URL}/products/${productId}`, {
                method: 'DELETE',
              });
              
              const data = await response.json();
              
              if (data.success) {
                Alert.alert('Eliminado', 'Producto eliminado correctamente');
                fetchProducts(true);
                setSelectedProduct(null);
              } else {
                Alert.alert('Error', data.detail || 'No se pudo eliminar');
              }
            } catch (error) {
              console.error('Error deleting product:', error);
              Alert.alert('Error', 'Error de conexión');
            }
          },
        },
      ]
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; color: string; bgColor: string } } = {
      en_analisis: { label: 'En análisis', color: '#7C3AED', bgColor: '#EDE9FE' },
      analisis: { label: 'En análisis', color: '#7C3AED', bgColor: '#EDE9FE' },
      revisado: { label: 'Revisado', color: '#D97706', bgColor: '#FEF3C7' },
      publicado: { label: 'Publicado', color: '#2563EB', bgColor: '#DBEAFE' },
      vendido: { label: 'Vendido', color: '#059669', bgColor: '#D1FAE5' },
    };
    return statusConfig[status] || { label: status, color: '#6B7280', bgColor: '#F3F4F6' };
  };

  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Permiso de almacenamiento',
            message: 'La app necesita acceso para guardar fotos',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'Aceptar',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED && Platform.Version < 33) {
          Alert.alert('Error', 'Sin permiso para guardar fotos');
          return false;
        }
      }

      const fileName = `wallapop_${Date.now()}_${index + 1}.jpg`;
      const destPath = Platform.OS === 'android'
        ? `${RNFS.PicturesDirectoryPath}/${fileName}`
        : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      await RNFS.downloadFile({
        fromUrl: imageUrl,
        toFile: destPath,
      }).promise;

      if (Platform.OS === 'android') {
        await RNFS.scanFile(destPath);
      }

      return true;
    } catch (error) {
      console.error('Error downloading image:', error);
      return false;
    }
  };

  const downloadAllPhotos = async (photoUrls: string[]) => {
    if (!photoUrls || photoUrls.length === 0) {
      Alert.alert('Info', 'No hay fotos para descargar');
      return;
    }

    try {
      // Pedir permisos primero
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Permiso de almacenamiento',
            message: 'La app necesita acceso para guardar fotos',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'Aceptar',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED && Platform.Version < 33) {
          Alert.alert('Error', 'Sin permiso para guardar fotos');
          return;
        }
      }

      Alert.alert('Descargando', `Descargando ${photoUrls.length} fotos...`);

      let successCount = 0;
      const timestamp = Date.now();

      for (let i = 0; i < photoUrls.length; i++) {
        const fullUrl = `${API_CONFIG.BASE_URL}${photoUrls[i]}`;
        const fileName = `wallapop_${timestamp}_${i + 1}.jpg`;
        const destPath = Platform.OS === 'android'
          ? `${RNFS.PicturesDirectoryPath}/${fileName}`
          : `${RNFS.DocumentDirectoryPath}/${fileName}`;

        try {
          await RNFS.downloadFile({
            fromUrl: fullUrl,
            toFile: destPath,
          }).promise;

          if (Platform.OS === 'android') {
            await RNFS.scanFile(destPath);
          }
          successCount++;
        } catch (err) {
          console.error(`Error downloading photo ${i + 1}:`, err);
        }
      }

      Alert.alert(
        'Descarga completada',
        `Se han guardado ${successCount} de ${photoUrls.length} fotos en tu galería`
      );
    } catch (error) {
      console.error('Error downloading photos:', error);
      Alert.alert('Error', 'No se pudieron descargar las fotos');
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    // Usar primera foto del operario o imagen de Amazon como fallback
    const imageUrl = item.photo_urls && item.photo_urls.length > 0
      ? `${API_CONFIG.BASE_URL}${item.photo_urls[0]}`
      : item.amazon_image_url;
    
    const statusBadge = getStatusBadge(item.status);
    
    return (
      <View style={styles.productCard}>
        <TouchableOpacity 
          onPress={() => setSelectedProduct(item)}
          activeOpacity={0.7}
        >
          <View style={styles.productContent}>
            {imageUrl && (
              <Image
                source={{ uri: imageUrl }}
                style={styles.productImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.productInfo}>
              <View style={styles.titleRow}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
                  <Text style={[styles.statusText, { color: statusBadge.color }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>
              <View style={styles.priceRow}>
                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>Amazon</Text>
                  <Text style={styles.amazonPrice}>{item.amazon_price.toFixed(2)}€</Text>
                </View>
                <View style={styles.priceDivider} />
                <View style={styles.priceColumn}>
                  <Text style={styles.priceLabel}>Wallapop</Text>
                  <Text style={styles.wallapopPrice}>{item.wallapop_price.toFixed(2)}€</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{item.photo_urls?.length || 0} fotos</Text>
                <Text style={styles.metaText}> {formatDate(item.created_at)}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Botones de acción rápida */}
        <View style={styles.quickActions}>
          {item.status === 'publicado' && (
            <TouchableOpacity
              style={styles.soldButton}
              onPress={() => updateProductStatus(item.product_id, 'vendido')}
            >
              <Text style={styles.soldButtonText}>Marcar vendido</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteButtonSmall}
            onPress={() => deleteProduct(item.product_id)}
          >
            <Text style={styles.deleteButtonSmallText}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderProductModal = () => (
    <Modal
      visible={selectedProduct !== null}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setSelectedProduct(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedProduct && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Detalle del Producto</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setSelectedProduct(null)}
                  >
                    <Text style={styles.closeButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>

                {/* Mostrar primera foto del operario o imagen de Amazon como fallback */}
                {selectedProduct.photo_urls && selectedProduct.photo_urls.length > 0 ? (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewPhoto(`${API_CONFIG.BASE_URL}${selectedProduct.photo_urls[0]}`)}
                  >
                    <Image
                      source={{ uri: `${API_CONFIG.BASE_URL}${selectedProduct.photo_urls[0]}` }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                ) : selectedProduct.amazon_image_url && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewPhoto(selectedProduct.amazon_image_url || '')}
                  >
                    <Image
                      source={{ uri: selectedProduct.amazon_image_url }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}

                {/* Título con botón copiar */}
                <View style={styles.copyableSection}>
                  <View style={styles.copyHeader}>
                    <Text style={styles.sectionTitle}>Título</Text>
                    <TouchableOpacity
                      style={[styles.copyButton, copiedField === 'title' && styles.copiedButton]}
                      onPress={() => copyToClipboard(selectedProduct.title, 'title')}
                    >
                      <Text style={styles.copyButtonText}>
                        {copiedField === 'title' ? 'Copiado' : 'Copiar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.copyableBox}
                    onPress={() => copyToClipboard(selectedProduct.title, 'title')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.copyableText}>{selectedProduct.title}</Text>
                  </TouchableOpacity>
                </View>

                {/* Precio Wallapop con botón copiar */}
                <View style={styles.copyableSection}>
                  <View style={styles.copyHeader}>
                    <Text style={styles.sectionTitle}>Precio Wallapop</Text>
                    <TouchableOpacity
                      style={[styles.copyButton, copiedField === 'price' && styles.copiedButton]}
                      onPress={() => copyToClipboard(selectedProduct.wallapop_price.toFixed(2), 'price')}
                    >
                      <Text style={styles.copyButtonText}>
                        {copiedField === 'price' ? 'Copiado' : 'Copiar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.copyableBox, styles.priceBoxCopyable]}
                    onPress={() => copyToClipboard(selectedProduct.wallapop_price.toFixed(2), 'price')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.priceTextLarge}>{selectedProduct.wallapop_price.toFixed(2)}€</Text>
                    <Text style={styles.originalPriceText}>
                      (Amazon: {selectedProduct.amazon_price.toFixed(2)}€)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Descripción con botón copiar */}
                <View style={styles.copyableSection}>
                  <View style={styles.copyHeader}>
                    <Text style={styles.sectionTitle}>Descripción</Text>
                    <TouchableOpacity
                      style={[styles.copyButton, copiedField === 'description' && styles.copiedButton]}
                      onPress={() => copyToClipboard(selectedProduct.optimized_description, 'description')}
                    >
                      <Text style={styles.copyButtonText}>
                        {copiedField === 'description' ? 'Copiado' : 'Copiar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.copyableBox}
                    onPress={() => copyToClipboard(selectedProduct.optimized_description, 'description')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.descriptionText}>{selectedProduct.optimized_description}</Text>
                  </TouchableOpacity>
                </View>

                {/* Fotos del producto (subidas por el operario) */}
                {selectedProduct.photo_urls && selectedProduct.photo_urls.length > 0 && (
                  <View style={styles.photosSection}>
                    <Text style={styles.sectionTitle}>
                      Fotos del producto ({selectedProduct.photo_urls.length})
                    </Text>
                    
                    {/* Galería de fotos */}
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.photosGallery}
                    >
                      {selectedProduct.photo_urls.map((photoUrl, index) => (
                        <TouchableOpacity
                          key={index}
                          activeOpacity={0.9}
                          onPress={() => setPreviewPhoto(`${API_CONFIG.BASE_URL}${photoUrl}`)}
                        >
                          <Image
                            source={{ uri: `${API_CONFIG.BASE_URL}${photoUrl}` }}
                            style={styles.galleryPhoto}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    
                    {/* Botón descargar todas */}
                    <TouchableOpacity
                      style={styles.downloadAllButton}
                      onPress={() => downloadAllPhotos(selectedProduct.photo_urls)}
                    >
                      <Text style={styles.downloadAllButtonText}>
                        Descargar todas las fotos ({selectedProduct.photo_urls.length})
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Botón abrir Wallapop */}
                <TouchableOpacity
                  style={styles.wallapopButton}
                  onPress={openWallapop}
                >
                  <Text style={styles.wallapopButtonText}>Abrir Wallapop</Text>
                </TouchableOpacity>

                {/* Botón marcar como publicado (solo si está en revisado) */}
                {selectedProduct.status === 'revisado' && (
                  <TouchableOpacity
                    style={styles.publishButton}
                    onPress={() => updateProductStatus(selectedProduct.product_id, 'publicado')}
                  >
                    <Text style={styles.publishButtonText}>Marcar como publicado</Text>
                  </TouchableOpacity>
                )}

                {/* Botón marcar como vendido (si está publicado) */}
                {selectedProduct.status === 'publicado' && (
                  <TouchableOpacity
                    style={styles.soldButtonLarge}
                    onPress={() => updateProductStatus(selectedProduct.product_id, 'vendido')}
                  >
                    <Text style={styles.soldButtonLargeText}>Marcar como vendido</Text>
                  </TouchableOpacity>
                )}

                {/* Botón eliminar */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteProduct(selectedProduct.product_id)}
                >
                  <Text style={styles.deleteButtonText}>Eliminar producto</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3F4F6" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
          <Text style={styles.menuButtonText}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Productos</Text>
          <Text style={styles.subtitle}>Bienvenido, {username}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Buscar</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, showFilters && styles.filterButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={[styles.filterButtonText, showFilters && styles.filterButtonTextActive]}>Filtros</Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filtersContainer}>
            <View style={styles.dateRow}>
              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>Desde:</Text>
                <TextInput
                  style={styles.dateField}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={dateFrom}
                  onChangeText={setDateFrom}
                />
              </View>
              <View style={styles.dateInput}>
                <Text style={styles.dateLabel}>Hasta:</Text>
                <TextInput
                  style={styles.dateField}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  value={dateTo}
                  onChangeText={setDateTo}
                />
              </View>
            </View>
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.applyButton} onPress={handleSearch}>
                <Text style={styles.applyButtonText}>Aplicar Filtros</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsText}>
          {totalProducts} producto{totalProducts !== 1 ? 's' : ''} encontrado{totalProducts !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Products List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.loadingText}>Cargando productos...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchProducts(true)}
              colors={['#111827']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No hay productos</Text>
              <Text style={styles.emptySubtext}>
                Los productos añadidos por operarios aparecerán aquí
              </Text>
            </View>
          }
        />
      )}

      {renderProductModal()}

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
                onLogout();
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

      <Modal
        visible={!!previewPhoto}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewPhoto(null)}
          />
          <View style={styles.previewContent}>
            {previewPhoto && (
              <Image
                source={{ uri: previewPhoto }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.previewCloseButton}
              onPress={() => setPreviewPhoto(null)}
            >
              <Text style={styles.previewCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F6',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  searchButton: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  filterButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: '#0F172A',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filtersContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInput: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  dateField: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  filterActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  clearButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  resultsText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EEF1F6',
  },
  productContent: {
    flexDirection: 'row',
    padding: 14,
  },
  productImage: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  productTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  soldButton: {
    flex: 1,
    backgroundColor: '#ECFDF3',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  soldButtonText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButtonSmall: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteButtonSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceColumn: {
    flex: 1,
  },
  priceDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 12,
  },
  priceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amazonPrice: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  wallapopPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
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
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  previewContent: {
    width: '92%',
    height: '70%',
    backgroundColor: '#0B1220',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
  },
  previewCloseButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  previewCloseText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  closeButtonText: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  modalImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  modalProductTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
    lineHeight: 24,
  },
  priceSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  priceBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  wallapopBox: {
    backgroundColor: '#ECFDF5',
  },
  priceBoxLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  priceBoxValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  wallapopPriceValue: {
    color: '#10B981',
  },
  // Copyable sections
  copyableSection: {
    marginBottom: 16,
  },
  copyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  copyButton: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copiedButton: {
    backgroundColor: '#16A34A',
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  copyableBox: {
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyableText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  priceBoxCopyable: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    alignItems: 'center',
  },
  priceTextLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: '#16A34A',
  },
  originalPriceText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  descriptionSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  descriptionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  defectsSection: {
    marginBottom: 16,
  },
  defectsText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
  },
  // Photos section
  photosSection: {
    marginBottom: 16,
  },
  photosGallery: {
    marginTop: 8,
  },
  galleryPhoto: {
    width: 124,
    height: 124,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#F8FAFC',
  },
  downloadAllButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  downloadAllButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  downloadButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    marginLeft: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  wallapopButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  wallapopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  publishButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  soldButtonLarge: {
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  soldButtonLargeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#F8FAFC',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  deleteButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
  },
});
