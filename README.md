# 🚀 Sales Automation - Monorepo

Proyecto de automatización de ventas con FastAPI, Celery y Playwright.

## 📋 Stack Tecnológico

- **Backend:** Python 3.11, FastAPI
- **Worker:** Celery
- **Broker:** Redis
- **Automation:** Playwright
- **Infraestructura:** Docker, Docker Compose

## 🏗️ Estructura del Proyecto

```
AutomatizacionNico/
├── docker-compose.yml          # Orquestación de servicios
├── backend/
│   ├── Dockerfile              # Imagen Docker con Playwright
│   ├── requirements.txt        # Dependencias Python
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py            # API FastAPI
│   ├── worker/
│   │   ├── __init__.py
│   │   ├── celery_app.py      # Configuración Celery
│   │   └── tasks.py           # Tareas de automatización
│   └── uploads/               # Directorio para imágenes
└── README.md
```

## 🚀 Comandos para Levantar el Proyecto

### 1. Construir las imágenes Docker

```powershell
docker-compose build
```

### 2. Levantar todos los servicios

```powershell
docker-compose up -d
```

### 3. Ver logs de los servicios

```powershell
# Ver todos los logs
docker-compose logs -f

# Ver logs solo de la API
docker-compose logs -f api

# Ver logs solo del worker
docker-compose logs -f worker
```

### 4. Verificar que los servicios estén corriendo

```powershell
docker-compose ps
```

### 5. Detener los servicios

```powershell
docker-compose down
```

### 6. Detener y limpiar volúmenes

```powershell
docker-compose down -v
```

## 🧪 Probar el API

### Endpoint de salud

```powershell
curl http://localhost:8000/
```

### Subir un producto (PowerShell)

```powershell
# Crear archivo de prueba
"Test data" | Out-File -FilePath test.txt

# Enviar solicitud
$form = @{
    files = Get-Item -Path test.txt
    data = '{"name": "Producto Test", "price": 100, "description": "Producto de prueba"}'
}
Invoke-WebRequest -Uri http://localhost:8000/upload-product -Method Post -Form $form
```

### Consultar estado de tarea

```powershell
curl http://localhost:8000/task-status/{TASK_ID}
```

## 📊 Monitoreo

### Ver logs del worker en tiempo real

```powershell
docker-compose logs -f worker
```

### Conectarse a Redis

```powershell
docker exec -it sales-redis redis-cli
```

## 🔧 Desarrollo

### Reconstruir después de cambios en código

```powershell
docker-compose up -d --build
```

### Ejecutar comandos dentro del contenedor

```powershell
# Entrar al contenedor de la API
docker exec -it sales-api bash

# Entrar al contenedor del worker
docker exec -it sales-worker bash
```

## 📝 Notas Importantes

- El puerto **8000** expone la API FastAPI
- El puerto **6379** expone Redis (opcional, para debugging)
- Las imágenes se guardan en `backend/uploads` y se comparten entre API y Worker
- Playwright está pre-instalado en el Dockerfile con Chromium

## 🐛 Troubleshooting

Si los servicios no levantan:

```powershell
# Ver logs detallados
docker-compose logs

# Reconstruir desde cero
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```
