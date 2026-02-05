"""
MongoDB Database Connection
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional

# MongoDB connection settings
MONGO_URL = os.getenv(
    "MONGO_PUBLIC_URL", 
    "mongodb://mongo:UCYBFFUBybfLictgSQjRwJJwoLLDAAqz@nozomi.proxy.rlwy.net:44040"
)
DATABASE_NAME = "sales_automation"

# Global MongoDB client
client: Optional[AsyncIOMotorClient] = None
db = None


async def connect_to_mongo():
    """Establecer conexión a MongoDB"""
    global client, db
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DATABASE_NAME]
        # Verificar conexión
        await client.admin.command('ping')
        print("✅ Conectado a MongoDB correctamente")
        
        # Crear índices
        await create_indexes()
        
        return db
    except Exception as e:
        print(f"❌ Error conectando a MongoDB: {e}")
        raise e


async def close_mongo_connection():
    """Cerrar conexión a MongoDB"""
    global client
    if client:
        client.close()
        print("🔌 Conexión a MongoDB cerrada")


async def create_indexes():
    """Crear índices para optimizar consultas"""
    global db
    if db is not None:
        # Índices para productos
        await db.products.create_index("created_at")
        await db.products.create_index("title")
        await db.products.create_index([("title", "text")])
        
        # Índices para usuarios
        await db.users.create_index("username", unique=True)
        
        print("📑 Índices de MongoDB creados")


def get_database():
    """Obtener la instancia de la base de datos"""
    global db
    return db
