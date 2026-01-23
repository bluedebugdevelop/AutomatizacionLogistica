"""
FastAPI Application - Sales Automation Backend
"""
import os
import json
import uuid
from typing import List, Optional
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import aiofiles

# Importar la tarea de Celery
from worker.tasks import process_product_task

# Importar servicio de Amazon
from app.services.amazon import AmazonService

# Crear una instancia del servicio de Amazon
amazon_service = AmazonService()

app = FastAPI(
    title="Sales Automation API",
    description="Backend para automatización de ventas con FastAPI y Celery",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directorio para uploads
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.get("/")
async def root():
    """Endpoint de salud del servicio"""
    return {
        "service": "Sales Automation API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/search-amazon")
async def search_amazon(
    query: str = Query(..., description="Texto de búsqueda para Amazon"),
    headless: bool = Query(True, description="Ejecutar navegador en modo headless")
):
    """
    Buscar producto en Amazon y extraer información
    
    Args:
        query: Texto de búsqueda (ej: "iPhone 15 Pro")
        headless: Si ejecutar el navegador sin interfaz gráfica (default: True)
    
    Returns:
        JSON con información del producto encontrado
    """
    try:
        print(f"🔍 Nueva búsqueda en Amazon: '{query}'")
        
        # Validar query
        if not query or len(query.strip()) < 3:
            raise HTTPException(
                status_code=400, 
                detail="La búsqueda debe tener al menos 3 caracteres"
            )
        
        # Ejecutar búsqueda con el servicio
        product_data = await amazon_service.search_product(query.strip())
        
        # Validar que tengamos datos mínimos
        if not product_data.get('title'):
            raise HTTPException(
                status_code=404,
                detail="No se pudo encontrar información del producto"
            )
        
        # Si no hay precio, indicarlo claramente
        if not product_data.get('price'):
            product_data['price_available'] = False
            product_data['price_message'] = "Precio no disponible en este momento"
        else:
            product_data['price_available'] = True
        
        return {
            "success": True,
            "query": query,
            "product": product_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en búsqueda de Amazon: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al buscar en Amazon: {str(e)}"
        )


@app.post("/search-amazon-by-image")
async def search_amazon_by_image(
    file: UploadFile = File(...),
    headless: bool = Form(True)
):
    """
    Buscar producto en Amazon usando una imagen
    
    El flujo es:
    1. Recibe imagen del producto
    2. Usa IA Vision (Gemini) para identificar el producto
    3. Genera query de búsqueda
    4. Busca en Amazon como búsqueda normal
    
    Args:
        file: Imagen del producto
        headless: Si ejecutar el navegador sin interfaz gráfica
    
    Returns:
        JSON con información del producto encontrado
    """
    try:
        print("📸 Nueva búsqueda por imagen")
        
        # Validar que sea una imagen
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="El archivo debe ser una imagen (JPEG, PNG, etc.)"
            )
        
        # Guardar imagen temporalmente
        temp_dir = UPLOAD_DIR / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        temp_image_path = temp_dir / f"search_{uuid.uuid4()}{Path(file.filename).suffix}"
        
        async with aiofiles.open(temp_image_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        print(f"💾 Imagen guardada en {temp_image_path}")
        
        # Usar IA Vision para identificar el producto
        from app.services.llm import identify_product_from_image
        
        search_query = await identify_product_from_image(str(temp_image_path))
        
        # Eliminar imagen temporal
        temp_image_path.unlink()
        
        if not search_query:
            raise HTTPException(
                status_code=500,
                detail="No se pudo identificar el producto en la imagen"
            )
        
        print(f"🔍 Query generado por IA: '{search_query}'")
        
        # Buscar en Amazon con el query generado (TOP 3)
        products_data = await search_amazon_products(search_query, headless=headless, limit=3)

        if not products_data:
            raise HTTPException(
                status_code=404,
                detail=f"No se encontró '{search_query}' en Amazon"
            )

        # Marcar disponibilidad de precio
        for product in products_data:
            if not product.get('price'):
                product['price_available'] = False
                product['price_message'] = "Precio no disponible en este momento"
            else:
                product['price_available'] = True

        return {
            "success": True,
            "identified_query": search_query,
            "search_method": "image",
            "products": products_data,
            "product": products_data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error en búsqueda por imagen: {str(e)}")
        # Limpiar imagen temporal si existe
        if 'temp_image_path' in locals() and temp_image_path.exists():
            temp_image_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar la imagen: {str(e)}"
        )


@app.post("/upload-product")
async def upload_product(
    title: str = Form(...),
    amazon_price: float = Form(...),
    amazon_description: str = Form(...),
    defects_description: str = Form(""),
    amazon_image_url: Optional[str] = Form(None),
    amazon_url: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """
    Endpoint para subir producto con fotos reales y desperfectos
    
    Args:
        title: Título del producto desde Amazon
        amazon_price: Precio original de Amazon (€)
        amazon_description: Descripción desde Amazon
        defects_description: Descripción de desperfectos del usuario
        amazon_image_url: URL de la imagen de Amazon
        amazon_url: URL del producto en Amazon
        files: Fotos reales del producto (máximo 6)
    
    Returns:
        JSON con información del producto guardado y tarea encolada
    """
    try:
        # Validar número de archivos
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="Se requiere al menos una foto del producto")
        
        if len(files) > 6:
            raise HTTPException(status_code=400, detail="Máximo 6 fotos permitidas")
        
        # Validar precio
        if amazon_price <= 0:
            raise HTTPException(status_code=400, detail="El precio debe ser mayor a 0")
        
        # ===== LÓGICA DE CÁLCULO DE PRECIO WALLAPOP =====
        # Precio < 250€ → 50% del precio Amazon
        # Precio ≥ 250€ → 60% del precio Amazon
        wallapop_price = amazon_price * 0.5 if amazon_price < 250 else amazon_price * 0.6
        wallapop_price = round(wallapop_price, 2)  # Redondear a 2 decimales
        
        print(f"💰 Precio Amazon: {amazon_price}€ → Precio Wallapop: {wallapop_price}€")
        
        # Generar ID único para este producto
        product_id = str(uuid.uuid4())
        
        # Crear carpeta específica: /app/uploads/items/{uuid}/
        items_dir = UPLOAD_DIR / "items"
        items_dir.mkdir(parents=True, exist_ok=True)
        
        product_dir = items_dir / product_id
        product_dir.mkdir(parents=True, exist_ok=True)
        
        # Guardar fotos reales
        saved_photos = []
        for idx, file in enumerate(files):
            # Generar nombre único: photo_1.jpg, photo_2.jpg, etc.
            file_extension = Path(file.filename).suffix or ".jpg"
            file_name = f"photo_{idx + 1}{file_extension}"
            file_path = product_dir / file_name
            
            # Guardar archivo de forma asíncrona
            async with aiofiles.open(file_path, 'wb') as f:
                content = await file.read()
                await f.write(content)
            
            saved_photos.append({
                "filename": file_name,
                "path": str(file_path),
                "size_bytes": len(content)
            })
        
        print(f"📸 Guardadas {len(saved_photos)} fotos en {product_dir}")
        
        # ===== GENERAR DESCRIPCIÓN OPTIMIZADA CON IA =====
        # Combinar descripción de Amazon + desperfectos del operario
        try:
            from app.services.llm import clean_description
            
            combined_input = f"""
DESCRIPCIÓN DE AMAZON:
{amazon_description}

ESTADO REAL DEL PRODUCTO:
{defects_description if defects_description else "Sin desperfectos mencionados"}
"""
            print("🤖 IA: Generando descripción optimizada...")
            optimized_description = await clean_description(combined_input)
            print(f"✅ IA: Descripción optimizada generada ({len(optimized_description)} caracteres)")
        except Exception as e:
            print(f"⚠️ Error al generar descripción con IA: {e}")
            optimized_description = amazon_description  # Fallback a descripción original
        
        # ===== CREAR METADATA.JSON =====
        metadata = {
            "product_id": product_id,
            "created_at": datetime.now().isoformat(),
            "amazon_data": {
                "title": title,
                "price": amazon_price,
                "description": amazon_description,
                "image_url": amazon_image_url,
                "url": amazon_url
            },
            "real_condition": {
                "defects_description": defects_description,
                "photos": saved_photos
            },
            "wallapop_listing": {
                "optimized_description": optimized_description,  # Descripción generada por IA
                "title": title,
                "price": wallapop_price
            },
            "pricing": {
                "amazon_price": amazon_price,
                "wallapop_price": wallapop_price,
                "discount_percentage": round((1 - wallapop_price / amazon_price) * 100, 1)
            },
            "status": "pending_upload"  # Estados: pending_upload, uploaded, failed
        }
        
        # Guardar metadata.json
        metadata_path = product_dir / "metadata.json"
        async with aiofiles.open(metadata_path, 'w', encoding='utf-8') as f:
            await f.write(json.dumps(metadata, indent=2, ensure_ascii=False))
        
        print(f"📄 Metadata guardado en {metadata_path}")
        
        # ===== ENCOLAR TAREA DE CELERY =====
        from worker.tasks import task_prepare_wallapop
        
        task = task_prepare_wallapop.delay(product_id)
        
        return JSONResponse(
            status_code=201,
            content={
                "success": True,
                "message": "Producto preparado correctamente",
                "product_id": product_id,
                "task_id": task.id,
                "pricing": {
                    "amazon_price": amazon_price,
                    "wallapop_price": wallapop_price,
                    "savings": round(amazon_price - wallapop_price, 2)
                },
                "photos_uploaded": len(saved_photos),
                "metadata_path": str(metadata_path)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error al procesar producto: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al procesar el producto: {str(e)}")


@app.get("/task-status/{task_id}")
async def get_task_status(task_id: str):
    """
    Consultar el estado de una tarea de Celery
    
    Args:
        task_id: ID de la tarea
    
    Returns:
        Estado de la tarea
    """
    from worker.celery_app import celery_app
    
    task = celery_app.AsyncResult(task_id)
    
    return {
        "task_id": task_id,
        "state": task.state,
        "result": task.result if task.ready() else None,
        "info": task.info
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
