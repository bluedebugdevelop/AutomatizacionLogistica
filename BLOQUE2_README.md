# Bloque 2: Captura de Datos Reales y Lógica de Negocio

## ✅ Implementación Completada

### Backend (FastAPI)

#### 1. Endpoint `/upload-product` 
- **Ubicación:** `backend/app/main.py`
- **Funcionalidad:**
  - Acepta hasta 6 fotos reales del producto
  - Recibe título, precio Amazon, descripción y desperfectos
  - Calcula precio Wallapop según la fórmula:
    - Precio < 250€ → 50% del precio Amazon
    - Precio ≥ 250€ → 60% del precio Amazon
  - Crea carpeta única: `/app/uploads/items/{uuid}/`
  - Guarda fotos como `photo_1.jpg`, `photo_2.jpg`, etc.
  - Genera `metadata.json` con toda la información

#### 2. Tarea Celery `task_prepare_wallapop`
- **Ubicación:** `backend/worker/tasks.py`
- **Funcionalidad:**
  - Lee metadata del producto
  - Imprime en logs: título, precio, número de fotos y desperfectos
  - Actualiza estado en metadata.json a `ready_for_upload`
  - Devuelve información del producto preparado

### Frontend (React Native)

#### 1. Componente `CameraCapture`
- **Ubicación:** `frontend/src/components/CameraCapture.tsx`
- **Funcionalidad:**
  - Captura hasta 6 fotos del producto
  - Permite elegir entre cámara o galería
  - Muestra galería de miniaturas con números
  - Botón para eliminar fotos individuales
  - Contador de fotos (X / 6)

#### 2. Pantalla `ProductFormScreen`
- **Ubicación:** `frontend/src/screens/ProductFormScreen.tsx`
- **Funcionalidad:**
  - Recibe datos de Amazon (título, precio, descripción, imagen)
  - Muestra cálculo de precio Wallapop en tiempo real
  - Input multilínea para descripción de desperfectos
  - Integra componente de cámara
  - Envía FormData al backend con fotos y datos
  - Muestra alertas de éxito/error

#### 3. Servicio API actualizado
- **Ubicación:** `frontend/src/services/api.ts`
- **Nueva función:** `uploadProduct()`
  - Construye FormData con todos los campos
  - Envía fotos como archivos binarios
  - Maneja errores y timeouts

#### 4. Flujo principal actualizado
- **Ubicación:** `frontend/App.tsx`
- **Mejoras:**
  - Navegación entre pantalla de búsqueda y formulario
  - Botón "Añadir Fotos" tras encontrar producto
  - Reset completo tras subir producto

## 📦 Dependencias Añadidas

### Frontend
```json
"react-native-image-picker": "^7.1.2"
```

### Permisos Android
- `CAMERA`
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `READ_MEDIA_IMAGES`

## 🚀 Instalación

### Backend
```bash
cd backend
# Las dependencias ya están en requirements.txt
```

### Frontend
```bash
cd frontend
npm install
# o
yarn install
```

Para Android, sincronizar permisos:
```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

## 📝 Uso del Sistema

### Flujo Completo

1. **Búsqueda en Amazon**
   - Usuario ingresa producto (ej: "iPhone 15 Pro")
   - Sistema hace scraping y muestra resultado
   - Botón "📸 Añadir Fotos →"

2. **Formulario de Producto**
   - Muestra datos de Amazon
   - Calcula y muestra precio Wallapop
   - Usuario añade 1-6 fotos del producto real
   - Usuario describe desperfectos (opcional)
   - Botón "🚀 Preparar para Wallapop"

3. **Procesamiento Backend**
   - Valida fotos (mínimo 1, máximo 6)
   - Calcula precio según fórmula
   - Crea carpeta `/app/uploads/items/{uuid}/`
   - Guarda fotos numeradas
   - Crea metadata.json
   - Lanza tarea Celery

4. **Tarea Celery**
   - Imprime en logs información del producto
   - Marca como "ready_for_upload"

## 🧪 Testing

### Probar endpoint desde terminal:
```bash
curl -X POST "http://localhost:8000/upload-product" \
  -F "title=iPhone 15 Pro Max" \
  -F "amazon_price=1099" \
  -F "amazon_description=Smartphone premium" \
  -F "defects_description=Pequeño arañazo" \
  -F "files=@photo1.jpg" \
  -F "files=@photo2.jpg"
```

### Verificar metadata:
```bash
docker compose exec api ls /app/uploads/items/
docker compose exec api cat /app/uploads/items/{uuid}/metadata.json
```

### Ver logs de Celery:
```bash
docker compose logs -f worker
```

## 📊 Estructura de metadata.json

```json
{
  "product_id": "uuid-unico",
  "created_at": "timestamp",
  "amazon_data": {
    "title": "Producto desde Amazon",
    "price": 299.99,
    "description": "Descripción completa...",
    "image_url": "https://...",
    "url": "https://amazon.es/..."
  },
  "real_condition": {
    "defects_description": "Caja abierta, pequeño arañazo",
    "photos": [
      {
        "filename": "photo_1.jpg",
        "path": "/app/uploads/items/{uuid}/photo_1.jpg",
        "size_bytes": 125430
      }
    ]
  },
  "pricing": {
    "amazon_price": 299.99,
    "wallapop_price": 149.99,
    "discount_percentage": 50.0
  },
  "status": "ready_for_upload",
  "celery_task_id": "task-id"
}
```

## ⚡ Próximos Pasos (Bloque 3)

- Implementar subida automatizada a Wallapop con Playwright
- Gestión de sesión y autenticación
- Manejo de errores y reintentos
- Panel de seguimiento de publicaciones
