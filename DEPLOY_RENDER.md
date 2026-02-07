# Despliegue en Render

Esta guía explica cómo desplegar el backend de Sales Automation en Render usando Docker.

## Arquitectura del Despliegue

El backend se despliega con los siguientes servicios:

1. **Redis** (Managed Service) - Para colas de Celery
2. **API Web Service** (Docker) - FastAPI + Uvicorn
3. **Celery Worker** (Docker) - Procesamiento en segundo plano
4. **MongoDB Atlas** (Externo) - Base de datos

## Requisitos Previos

### 1. Crear cuenta en MongoDB Atlas (IMPORTANTE)

Render no tiene MongoDB managed, así que necesitas MongoDB Atlas:

1. Ve a [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crea una cuenta gratuita (Free Tier M0)
3. Crea un cluster (región similar a tu Render, ej: Frankfurt)
4. Ve a **Database Access** → Crea un usuario con contraseña
5. Ve a **Network Access** → Permite acceso desde `0.0.0.0/0` (todas las IPs)
6. Ve a **Database** → Connect → Drivers → Copia tu connection string
   - Se verá así: `mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/sales?retryWrites=true&w=majority`

### 2. Obtener API Key de Gemini

Tu aplicación usa Google Gemini AI:

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una API Key
3. Guárdala para configurarla en Render

## Pasos para Desplegar

### Opción A: Despliegue Automático con Blueprint (Recomendado)

1. **Sube tu código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Configure Render deployment"
   git branch -M main
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git push -u origin main
   ```

2. **Conecta con Render**
   - Ve a [Render Dashboard](https://dashboard.render.com/)
   - Click en **New** → **Blueprint**
   - Conecta tu repositorio de GitHub
   - Render detectará automáticamente el archivo `render.yaml`

3. **Configura las variables de entorno**
   
   Una vez creados los servicios, ve a cada uno y configura:
   
   **Para `sales-api`:**
   - `GEMINI_API_KEY`: Tu API key de Google Gemini
   - `MONGODB_URL`: Tu connection string de MongoDB Atlas
   
   **Para `sales-worker`:**
   - `GEMINI_API_KEY`: Tu API key de Google Gemini
   - `MONGODB_URL`: Tu connection string de MongoDB Atlas

4. **Deploy automático**
   - Render desplegará automáticamente todos los servicios
   - El Redis se creará primero
   - Luego la API y el Worker se conectarán automáticamente

### Opción B: Despliegue Manual

Si prefieres crear los servicios uno por uno:

#### 1. Crear Redis

1. Dashboard → **New** → **Redis**
2. Nombre: `sales-redis`
3. Región: Frankfurt (o la más cercana)
4. Plan: Free
5. Click **Create Redis**
6. Una vez creado, copia el **Internal Redis URL** (formato: `redis://...`)

#### 2. Crear API Web Service

1. Dashboard → **New** → **Web Service**
2. Conecta tu repositorio
3. Configuración:
   - **Name**: `sales-api`
   - **Region**: Frankfurt
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile`
   - **Docker Context**: `./backend`
   - **Plan**: Free

4. **Variables de entorno**:
   ```
   REDIS_URL=redis://internal-redis-url-aqui
   GEMINI_API_KEY=tu-api-key-aqui
   MONGODB_URL=tu-mongodb-atlas-url-aqui
   ENVIRONMENT=production
   PORT=8000
   ```

5. **Persistent Disk** (para uploads):
   - Name: `sales-uploads`
   - Mount Path: `/app/uploads`
   - Size: 1 GB

6. Click **Create Web Service**

#### 3. Crear Celery Worker

1. Dashboard → **New** → **Background Worker**
2. Conecta tu repositorio
3. Configuración:
   - **Name**: `sales-worker`
   - **Region**: Frankfurt
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./backend/Dockerfile.worker`
   - **Docker Context**: `./backend`
   - **Plan**: Free

4. **Variables de entorno** (iguales que la API):
   ```
   REDIS_URL=redis://internal-redis-url-aqui
   GEMINI_API_KEY=tu-api-key-aqui
   MONGODB_URL=tu-mongodb-atlas-url-aqui
   ENVIRONMENT=production
   ```

5. **Persistent Disk**:
   - Name: `sales-worker-uploads`
   - Mount Path: `/app/uploads`
   - Size: 1 GB

6. Click **Create Background Worker**

## Verificar el Despliegue

### 1. Verificar que los servicios están corriendo

En el dashboard de Render, todos los servicios deben mostrar estado **Live** (verde).

### 2. Probar la API

```bash
# Obtén tu URL de la API (ej: https://sales-api.onrender.com)
curl https://tu-api.onrender.com/

# Deberías recibir:
# {
#   "service": "Sales Automation API",
#   "status": "running",
#   "version": "2.0.0"
# }
```

### 3. Ver logs

- En cada servicio, click en **Logs** para ver la salida
- Verifica que no haya errores de conexión a Redis o MongoDB

## Actualizar la App React Native

Una vez desplegado, actualiza la URL del backend en tu app:

**Archivo**: `frontend/src/constants/api.ts`

```typescript
export const API_CONFIG = {
  BASE_URL: 'https://tu-api.onrender.com',  // Cambia esto por tu URL de Render
};
```

Luego reconstruye tu app:

```bash
cd frontend
npm run android  # o npm run ios
```

## Consideraciones Importantes

### Plan Free de Render

- ⚠️ **Los servicios free se duermen después de 15 min de inactividad**
- La primera petición después de dormir tardará ~30-60 segundos (cold start)
- Tienes **750 horas/mes gratis** compartidas entre todos los servicios
- Para uso 24/7, necesitarás el plan Starter ($7/mes por servicio)

### Logs y Monitoreo

```bash
# Ver logs en vivo desde CLI
render logs -s sales-api -f
render logs -s sales-worker -f
```

### Variables de Entorno

Si necesitas cambiar alguna variable:

1. Ve al servicio en Render Dashboard
2. **Environment** → Edita la variable
3. Click **Save Changes**
4. Render redesplegará automáticamente

### Discos Persistentes

Los uploads se guardan en discos persistentes. Si necesitas más espacio:

1. Ve al servicio → **Disks**
2. Ajusta el tamaño (cuesta $0.25/GB/mes)

## Troubleshooting

### Error: "Cannot connect to MongoDB"

- Verifica que tu IP esté en la whitelist de MongoDB Atlas (usa `0.0.0.0/0` para permitir todas)
- Verifica el formato del connection string
- Asegúrate de que el usuario/contraseña sean correctos

### Error: "Cannot connect to Redis"

- Verifica que el Redis service esté **Live**
- Copia el **Internal Redis URL** exacto (no el External)

### Celery Worker no procesa tareas

- Verifica que el worker esté **Live** en el dashboard
- Revisa los logs del worker: `render logs -s sales-worker`
- Asegúrate de que `REDIS_URL` sea la misma en API y Worker

### Playwright/Chromium no funciona

La imagen base `mcr.microsoft.com/playwright/python:v1.41.0-jammy` ya incluye todo lo necesario. Si tienes problemas:

- Verifica en los logs que Playwright se instaló correctamente
- El plan Free puede tener limitaciones de memoria (512MB) - considera Starter plan

## Costos Estimados

### Free Tier (Actual)
- Redis: Free (25 MB)
- API Web Service: Free (750 horas/mes)
- Worker: Free (compartidas de las 750 horas/mes)
- MongoDB Atlas: Free (512 MB)
- **Total: $0/mes**

### Producción Recomendada
- Redis: $7/mes (1 GB)
- API Web Service: $7/mes (siempre activo)
- Worker: $7/mes (siempre activo)
- MongoDB Atlas: $9/mes (2GB storage, backups)
- Discos: $0.50/mes (2 GB total)
- **Total: ~$30/mes**

## Soporte

- [Documentación Render](https://docs.render.com/)
- [Render Community](https://community.render.com/)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com/)
