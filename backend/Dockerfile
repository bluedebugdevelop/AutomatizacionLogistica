# Esta imagen ya incluye Python y todas las dependencias de sistema de Playwright
FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Aquí solo descargamos el binario del navegador (las libs ya vienen en la imagen base)
RUN playwright install chromium

# Crear directorio y asegurar permisos para las fotos
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

COPY . .

EXPOSE 8000