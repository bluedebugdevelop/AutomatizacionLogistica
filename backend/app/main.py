"""
FastAPI Application - Sales Automation Backend
"""
import os
import json
import uuid
import hashlib
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

# Importar MongoDB
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.models import (
    UserLogin, UserCreate, UserRole, LoginResponse, UserResponse,
    ProductResponse, ProductListResponse
)

# Crear una instancia del servicio de Amazon
amazon_service = AmazonService()

app = FastAPI(
    title="Sales Automation API",
    description="Backend para automatización de ventas con FastAPI y Celery",
    version="2.0.0"
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


# ===== EVENTOS DE INICIO/CIERRE =====
@app.on_event("startup")
async def startup_event():
    """Conectar a MongoDB al iniciar la aplicación"""
    await connect_to_mongo()
    await create_default_users()


@app.on_event("shutdown")
async def shutdown_event():
    """Cerrar conexión a MongoDB al cerrar"""
    await close_mongo_connection()


async def create_default_users():
    """Crear usuarios por defecto: operario y vendedor"""
    db = get_database()
    if db is None:
        return
    
    default_users = [
        {"username": "operario", "password": "operario123", "role": "operario"},
        {"username": "vendedor", "password": "vendedor123", "role": "vendedor"},
    ]
    
    for user_data in default_users:
        existing = await db.users.find_one({"username": user_data["username"]})
        if not existing:
            hashed_password = hashlib.sha256(user_data["password"].encode()).hexdigest()
            await db.users.insert_one({
                "username": user_data["username"],
                "password": hashed_password,
                "role": user_data["role"],
                "created_at": datetime.now()
            })
            print(f"✅ Usuario '{user_data['username']}' creado")


@app.get("/")
async def root():
    """Endpoint de salud del servicio"""
    return {
        "service": "Sales Automation API",
        "status": "running",
        "version": "2.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# ===== ENDPOINTS DE AUTENTICACIÓN =====
@app.post("/auth/login")
async def login(credentials: UserLogin):
    """Login de usuario (operario o vendedor)"""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    hashed_password = hashlib.sha256(credentials.password.encode()).hexdigest()
    
    user = await db.users.find_one({
        "username": credentials.username,
        "password": hashed_password
    })
    
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    return LoginResponse(
        success=True,
        message="Login exitoso",
        user=UserResponse(
            id=str(user["_id"]),
            username=user["username"],
            role=UserRole(user["role"]),
            created_at=user["created_at"]
        ),
        token=f"token_{user['username']}_{datetime.now().timestamp()}"
    )


# ===== ENDPOINTS DE PRODUCTOS =====
@app.get("/products")
async def get_products(
    search: Optional[str] = Query(None, description="Buscar por título"),
    date_from: Optional[str] = Query(None, description="Fecha desde (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Fecha hasta (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    """Obtener lista de productos con filtros"""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    query = {}
    
    if search:
        query["$or"] = [
            {"amazon_data.title": {"$regex": search, "$options": "i"}},
            {"wallapop_listing.title": {"$regex": search, "$options": "i"}}
        ]
    
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            try:
                date_from_dt = datetime.strptime(date_from, "%Y-%m-%d")
                query["created_at"]["$gte"] = date_from_dt
            except ValueError:
                pass
        if date_to:
            try:
                date_to_dt = datetime.strptime(date_to, "%Y-%m-%d")
                date_to_dt = date_to_dt.replace(hour=23, minute=59, second=59)
                query["created_at"]["$lte"] = date_to_dt
            except ValueError:
                pass
        if not query["created_at"]:
            del query["created_at"]
    
    total = await db.products.count_documents(query)
    
    cursor = db.products.find(query).sort("created_at", -1).skip(skip).limit(limit)
    products_raw = await cursor.to_list(length=limit)
    
    products = []
    for p in products_raw:
        # Compatibilidad con documentos antiguos y nuevos
        photos = p["real_condition"].get("photos", [])
        photos_count = p["real_condition"].get("photos_count", len(photos))
        
        # Construir URLs de fotos (manejar formato objeto o string)
        photo_urls = []
        for photo in photos:
            if isinstance(photo, dict):
                photo_urls.append(f"/photos/{p['product_id']}/{photo['filename']}")
            else:
                photo_urls.append(f"/photos/{p['product_id']}/{photo}")
        
        products.append(ProductResponse(
            id=str(p["_id"]),
            product_id=p["product_id"],
            created_at=p["created_at"],
            title=p["amazon_data"]["title"],
            amazon_price=p["pricing"]["amazon_price"],
            wallapop_price=p["pricing"]["wallapop_price"],
            optimized_description=p["wallapop_listing"]["optimized_description"],
            defects=p["real_condition"]["defects_description"],
            photos_count=photos_count,
            photo_urls=photo_urls,
            amazon_image_url=p["amazon_data"].get("image_url"),
            status=p.get("status", "pending")
        ))
    
    return ProductListResponse(
        success=True,
        total=total,
        products=products
    )


@app.get("/products/{product_id}")
async def get_product(product_id: str):
    """Obtener detalle de un producto específico"""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    product = await db.products.find_one({"product_id": product_id})
    
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Construir URLs de las fotos (manejar formato objeto o string)
    photos = product.get("real_condition", {}).get("photos", [])
    photo_urls = []
    for photo in photos:
        if isinstance(photo, dict):
            photo_urls.append(f"/photos/{product_id}/{photo['filename']}")
        else:
            photo_urls.append(f"/photos/{product_id}/{photo}")
    
    return {
        "success": True,
        "product": {
            "id": str(product["_id"]),
            "product_id": product["product_id"],
            "created_at": product["created_at"].isoformat(),
            "amazon_data": product["amazon_data"],
            "real_condition": {
                **product["real_condition"],
                "photo_urls": photo_urls
            },
            "wallapop_listing": product["wallapop_listing"],
            "pricing": product["pricing"],
            "status": product.get("status", "revisado")
        }
    }


@app.patch("/products/{product_id}/status")
async def update_product_status(product_id: str, status: str = Form(...)):
    """
    Actualizar el estado de un producto.
    Estados válidos: revisado, publicado, vendido
    """
    valid_statuses = ["revisado", "publicado", "vendido"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Estado inválido. Estados válidos: {', '.join(valid_statuses)}"
        )
    
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    result = await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"status": status}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    print(f"📝 Producto {product_id} actualizado a estado: {status}")
    
    return {"success": True, "message": f"Estado actualizado a '{status}'"}


@app.delete("/products/{product_id}")
async def delete_product(product_id: str):
    """Eliminar un producto y sus fotos"""
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")
    
    # Verificar que existe
    product = await db.products.find_one({"product_id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # Eliminar carpeta de fotos
    import shutil
    product_dir = UPLOAD_DIR / "items" / product_id
    if product_dir.exists():
        shutil.rmtree(product_dir)
        print(f"🗑️ Carpeta de fotos eliminada: {product_dir}")
    
    # Eliminar de MongoDB
    await db.products.delete_one({"product_id": product_id})
    print(f"🗑️ Producto {product_id} eliminado de la base de datos")
    
    return {"success": True, "message": "Producto eliminado correctamente"}


@app.get("/photos/{product_id}/{filename}")
async def get_photo(product_id: str, filename: str):
    """Servir foto de un producto"""
    from fastapi.responses import FileResponse
    
    file_path = UPLOAD_DIR / "items" / product_id / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Foto no encontrada")
    
    # Determinar el tipo de contenido
    extension = Path(filename).suffix.lower()
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp"
    }
    media_type = media_types.get(extension, "image/jpeg")
    
    return FileResponse(file_path, media_type=media_type)


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
    amazon_description: str = Form(""),
    defects_description: str = Form(""),
    amazon_image_url: Optional[str] = Form(None),
    amazon_url: Optional[str] = Form(None),
    files: List[UploadFile] = File(...)
):
    """
    Endpoint para subir producto con fotos reales y desperfectos.
    Guarda el producto en MongoDB y las fotos en el servidor.
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
        
        # Calcular precio Wallapop
        wallapop_price = amazon_price * 0.5 if amazon_price < 250 else amazon_price * 0.6
        wallapop_price = round(wallapop_price, 2)
        
        print(f"💰 Precio Amazon: {amazon_price}€ → Precio Wallapop: {wallapop_price}€")
        
        # Generar ID único
        product_id = str(uuid.uuid4())
        
        # Crear carpeta para las fotos
        items_dir = UPLOAD_DIR / "items"
        items_dir.mkdir(parents=True, exist_ok=True)
        product_dir = items_dir / product_id
        product_dir.mkdir(parents=True, exist_ok=True)
        
        # Guardar fotos
        saved_photos = []
        for idx, file in enumerate(files):
            file_extension = Path(file.filename).suffix or ".jpg"
            file_name = f"photo_{idx + 1}{file_extension}"
            file_path = product_dir / file_name
            
            content = await file.read()
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(content)
            
            # Guardar info completa de la foto
            saved_photos.append({
                "filename": file_name,
                "path": str(file_path),
                "size_bytes": len(content)
            })
        
        print(f"📸 Guardadas {len(saved_photos)} fotos en {product_dir}")
        
        # Generar descripción optimizada con IA
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
            optimized_description = amazon_description
        
        # Crear documento del producto
        product_data = {
            "product_id": product_id,
            "created_at": datetime.now(),
            "amazon_data": {
                "title": title,
                "price": amazon_price,
                "description": amazon_description,
                "image_url": amazon_image_url,
                "url": amazon_url
            },
            "real_condition": {
                "defects_description": defects_description or "Ningún desperfecto",
                "photos": saved_photos
            },
            "wallapop_listing": {
                "optimized_description": optimized_description,
                "title": title,
                "price": wallapop_price
            },
            "pricing": {
                "amazon_price": amazon_price,
                "wallapop_price": wallapop_price,
                "discount_percentage": round((1 - wallapop_price / amazon_price) * 100, 1)
            },
            "status": "revisado"
        }
        
        # Guardar en MongoDB
        db = get_database()
        if db is not None:
            result = await db.products.insert_one(product_data)
            print(f"💾 Producto guardado en MongoDB con ID: {result.inserted_id}")
        else:
            print("⚠️ MongoDB no disponible")
            raise HTTPException(status_code=500, detail="Base de datos no disponible")
        
        return JSONResponse(
            status_code=201,
            content={
                "success": True,
                "message": "Producto guardado correctamente",
                "product_id": product_id,
                "pricing": {
                    "amazon_price": amazon_price,
                    "wallapop_price": wallapop_price,
                    "savings": round(amazon_price - wallapop_price, 2)
                },
                "photos_uploaded": len(saved_photos),
                "optimized_description": optimized_description
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
