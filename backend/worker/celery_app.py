"""
Configuración de Celery
"""
import os
from celery import Celery

# Obtener URL de Redis desde variable de entorno
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Crear instancia de Celery
celery_app = Celery(
    "sales_automation",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"]
)

# Configuración de Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Mexico_City",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutos límite por tarea
    task_soft_time_limit=25 * 60,  # 25 minutos soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
)

if __name__ == "__main__":
    celery_app.start()
