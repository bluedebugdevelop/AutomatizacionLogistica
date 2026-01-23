"""
Tareas de Celery para automatización de ventas
"""
import time
from celery import Task
from worker.celery_app import celery_app


class CallbackTask(Task):
    """Task base con callbacks personalizados"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Ejecutado cuando la tarea se completa exitosamente"""
        print(f"✅ Tarea {task_id} completada exitosamente")
        
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Ejecutado cuando la tarea falla"""
        print(f"❌ Tarea {task_id} falló: {exc}")


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="worker.tasks.process_product_task",
    max_retries=3,
    default_retry_delay=60
)
def process_product_task(self, task_data: dict):
    """
    Tarea principal para procesar un producto
    
    Args:
        task_data: Diccionario con información del producto e imágenes
    
    Returns:
        Resultado del procesamiento
    """
    try:
        product_id = task_data.get("product_id")
        product_data = task_data.get("product_data", {})
        images = task_data.get("images", [])
        
        product_name = product_data.get("name", "Producto sin nombre")
        
        print("=" * 60)
        print(f"🚀 Iniciando proceso para [{product_name}]...")
        print(f"📦 Product ID: {product_id}")
        print(f"🖼️  Imágenes recibidas: {len(images)}")
        print("=" * 60)
        
        # Actualizar estado de la tarea
        self.update_state(
            state="PROCESSING",
            meta={
                "status": "Iniciando automatización",
                "product": product_name,
                "progress": 0
            }
        )
        
        # Simulación de procesamiento (aquí irá la lógica de Playwright)
        steps = [
            "Preparando navegador...",
            "Iniciando sesión en plataforma...",
            "Subiendo imágenes...",
            "Completando formulario...",
            "Publicando producto...",
        ]
        
        for i, step in enumerate(steps):
            print(f"⏳ {step}")
            time.sleep(2)  # Simular trabajo
            
            progress = int((i + 1) / len(steps) * 100)
            self.update_state(
                state="PROCESSING",
                meta={
                    "status": step,
                    "product": product_name,
                    "progress": progress
                }
            )
        
        result = {
            "status": "success",
            "product_id": product_id,
            "product_name": product_name,
            "images_processed": len(images),
            "message": f"Producto '{product_name}' procesado exitosamente"
        }
        
        print("=" * 60)
        print(f"✅ Producto '{product_name}' procesado exitosamente")
        print("=" * 60)
        
        return result
        
    except Exception as exc:
        print(f"❌ Error procesando producto: {exc}")
        # Reintentar la tarea
        raise self.retry(exc=exc)


@celery_app.task(name="worker.tasks.test_task")
def test_task(message: str):
    """Tarea simple de prueba"""
    print(f"📝 Test Task ejecutándose: {message}")
    time.sleep(2)
    return f"Test completado: {message}"


@celery_app.task(
    bind=True,
    base=CallbackTask,
    name="worker.tasks.task_prepare_wallapop",
    max_retries=3,
    default_retry_delay=60
)
def task_prepare_wallapop(self, product_id: str):
    """
    Tarea para preparar y subir producto a Wallapop
    
    Por ahora solo registra en logs que el producto está listo.
    En futuras iteraciones implementará la subida automatizada a Wallapop.
    
    Args:
        product_id: UUID del producto almacenado en /app/uploads/items/{uuid}/
    
    Returns:
        Información del producto preparado
    """
    try:
        import json
        from pathlib import Path
        
        # Leer metadata del producto
        metadata_path = Path(f"/app/uploads/items/{product_id}/metadata.json")
        
        if not metadata_path.exists():
            raise FileNotFoundError(f"No se encontró metadata para producto {product_id}")
        
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        # Extraer información relevante
        title = metadata['amazon_data']['title']
        wallapop_price = metadata['pricing']['wallapop_price']
        photo_count = len(metadata['real_condition']['photos'])
        defects = metadata['real_condition']['defects_description']
        
        # Log del producto listo para Wallapop
        print("=" * 70)
        print("🎯 PRODUCTO LISTO PARA WALLAPOP")
        print("=" * 70)
        print(f"📦 Título: {title}")
        print(f"💰 Precio: {wallapop_price}€")
        print(f"📸 Fotos: {photo_count}")
        print(f"⚠️  Desperfectos: {defects if defects else 'Ninguno'}")
        print(f"🆔 Product ID: {product_id}")
        print("=" * 70)
        
        # Actualizar estado en metadata
        metadata['status'] = 'ready_for_upload'
        metadata['celery_task_id'] = self.request.id
        
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        return {
            "status": "ready",
            "product_id": product_id,
            "title": title,
            "price": wallapop_price,
            "photos": photo_count,
            "message": f"Listo para subir a Wallapop: {title} a {wallapop_price}€"
        }
        
    except Exception as exc:
        print(f"❌ Error preparando producto {product_id} para Wallapop: {exc}")
        raise self.retry(exc=exc)

