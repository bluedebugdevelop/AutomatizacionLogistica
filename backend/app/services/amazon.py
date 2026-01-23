import httpx
import os
from typing import Dict, Any, List
from dotenv import load_dotenv

# Carga las variables de entorno desde .env
load_dotenv()

RAINFOREST_API_KEY = os.getenv("RAINFOREST_API_KEY")

class AmazonService:
    """
    Servicio para interactuar con la API de Rainforest y obtener datos de Amazon.
    """
    RAINFOREST_API_URL = "https://api.rainforestapi.com/request"

    def __init__(self, **kwargs):
        """
        Inicializa el servicio. Valida que la API key esté presente.
        """
        if not RAINFOREST_API_KEY:
            raise ValueError("La clave de API de Rainforest no está configurada. Revisa tu archivo .env")

    async def _make_rainforest_request(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Realiza una petición a la API de Rainforest de forma asíncrona.
        Maneja errores comunes de HTTP y de red.
        """
        # Añade la API key a todos los requests
        params['api_key'] = RAINFOREST_API_KEY
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                print(f"🚀 Realizando petición a Rainforest con params: {params.get('type')}, {params.get('search_term') or params.get('asin')}")
                response = await client.get(self.RAINFOREST_API_URL, params=params)
                response.raise_for_status()  # Lanza una excepción para errores 4xx/5xx
                return response.json()
            except httpx.HTTPStatusError as e:
                print(f"❌ Error de estado HTTP en Rainforest: {e.response.status_code} - {e.response.text}")
                return {"error": "HTTP_STATUS_ERROR", "details": e.response.text}
            except httpx.RequestError as e:
                print(f"❌ Error de petición a Rainforest: {e}")
                return {"error": "REQUEST_ERROR", "details": str(e)}

    async def search_product(self, query: str) -> Dict[str, Any]:
        """
        Busca un único producto en Amazon.es usando la API de Rainforest.
        Devuelve el primer resultado que tenga ASIN y precio.
        """
        print(f"🔍 Buscando en Rainforest: '{query}'")
        params = {
            'type': 'search',
            'amazon_domain': 'amazon.es',
            'search_term': query
        }
        
        data = await self._make_rainforest_request(params)

        if not data or data.get("error") or "search_results" not in data or not data["search_results"]:
            print("⚠️ No se encontraron resultados válidos en Rainforest.")
            return {}

        # Devolvemos el primer resultado que tenga un precio y un ASIN
        for product in data["search_results"]:
            if product.get("asin") and product.get("price"):
                print(f"✅ Producto encontrado: {product.get('title', 'Sin título')}")
                return {
                    "title": product.get("title"),
                    "price": product.get("price", {}).get("value"),
                    "image": product.get("image"),
                    "url": product.get("link"),
                    "asin": product.get("asin")
                }
        
        print("⚠️ Ningún resultado de búsqueda tenía ASIN y precio.")
        return {}

    async def search_products(self, query: str, num_products: int = 3) -> List[Dict[str, Any]]:
        """
        Busca múltiples productos en Amazon.es y devuelve una lista.
        """
        print(f"🔍 Buscando los {num_products} mejores productos en Rainforest para: '{query}'")
        params = {
            'type': 'search',
            'amazon_domain': 'amazon.es',
            'search_term': query
        }
        
        data = await self._make_rainforest_request(params)

        if not data or data.get("error") or "search_results" not in data or not data["search_results"]:
            print("⚠️ No se encontraron resultados válidos en Rainforest.")
            return []

        products = []
        for product in data["search_results"]:
            # Aseguramos que el producto tenga la información mínima requerida
            if product.get("asin") and product.get("price") and len(products) < num_products:
                products.append({
                    "title": product.get("title"),
                    "price": product.get("price", {}).get("value"),
                    "image": product.get("image"),
                    "url": product.get("link"),
                    "asin": product.get("asin")
                })
        
        print(f"✅ Encontrados {len(products)} de {num_products} productos solicitados.")
        return products

    async def get_product_details(self, asin: str) -> Dict[str, Any]:
        """
        Obtiene los detalles de un producto específico a partir de su ASIN.
        """
        print(f"📦 Obteniendo detalles del producto con ASIN: {asin}")
        params = {
            'type': 'product',
            'amazon_domain': 'amazon.es',
            'asin': asin
        }
        
        data = await self._make_rainforest_request(params)

        if not data or data.get("error") or "product" not in data:
            print(f"⚠️ No se encontraron detalles para el ASIN {asin}.")
            return {}

        product_data = data["product"]
        
        # Extraer descripción de los 'feature_bullets' o del campo 'description'
        description = ". ".join(product_data.get("feature_bullets_flat", "").splitlines())
        if not description:
            description = product_data.get("description", "No hay descripción disponible.")

        # Formatear especificaciones en un diccionario simple
        specifications = {spec['name']: spec['value'] for spec in product_data.get("specifications", [])}

        return {
            "title": product_data.get("title"),
            "price": product_data.get("buybox_winner", {}).get("price", {}).get("value"),
            "image": product_data.get("main_image", {}).get("link"),
            "url": product_data.get("link"),
            "asin": product_data.get("asin"),
            "description": description.strip(),
            "specifications": specifications
        }