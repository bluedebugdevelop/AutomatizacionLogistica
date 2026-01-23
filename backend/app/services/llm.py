import os
import google.generativeai as genai
from pathlib import Path
from typing import Optional

# Cargamos la clave
api_key = os.getenv("GEMINI_API_KEY")

if api_key:
    try:
        genai.configure(api_key=api_key)
        # ACTUALIZACIÓN 2026: Usamos la nueva serie 2.5 Flash
        model = genai.GenerativeModel('gemini-2.5-flash')
        vision_model = genai.GenerativeModel('gemini-2.5-flash')  # Mismo modelo para Vision
        print("🚀 IA: Gemini 2.5 Flash configurado y listo (Text + Vision).")
    except Exception as e:
        model = None
        vision_model = None
        print(f"❌ Error al configurar Gemini: {e}")
else:
    model = None
    vision_model = None
    print("⚠️ IA: GEMINI_API_KEY no encontrada.")

async def clean_description(raw_text: str) -> str:
    if not model or not raw_text:
        return raw_text
    
    prompt = f"""
Eres un experto redactor de anuncios para Wallapop.

Tu tarea es crear una descripción profesional y atractiva, integrando de forma natural:
- Las características técnicas del producto
- El estado real mencionado por el vendedor

INSTRUCCIONES:
1. Redacta en español de forma natural y fluida
2. Integra el estado del producto en la descripción de manera honesta pero positiva
3. Si hay desperfectos, menciónelos claramente pero sin dramatizar (ej: "Presenta un pequeño arañazo lateral que no afecta su funcionamiento")
4. Si no hay desperfectos, destaca el excelente estado
5. Usa emojis profesionales (📱, 🔋, 📸, 📦, ✅, ⚠️)
6. Crea 4-5 bullet points cortos y directos
7. Tono profesional pero cercano

FORMATO:
- PROHIBIDO usar negritas (**) o cursivas. Solo texto plano con emojis.
- Estructura clara con bullet points

Devuelve SOLO la descripción optimizada, sin títulos adicionales.

INFORMACIÓN DEL PRODUCTO:
{raw_text}
"""
    
    try:
        # Gemini 2.5 maneja mucho mejor el contexto y es casi instantáneo
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"❌ Error en Gemini 2.5: {e}")
        # Fallback al modelo Pro si el Flash falla por cuotas
        try:
            fallback = genai.GenerativeModel('gemini-2.5-pro')
            res = fallback.generate_content(prompt)
            return res.text.strip()
        except:
            return raw_text


async def identify_product_from_image(image_path: str) -> Optional[str]:
    """
    Analiza una imagen de un producto y genera un query de búsqueda para Amazon
    
    Args:
        image_path: Ruta a la imagen del producto
    
    Returns:
        Query de búsqueda optimizado o None si hay error
    """
    if not vision_model:
        print("⚠️ Vision model no disponible")
        return None
    
    try:
        # Cargar la imagen
        image_file = genai.upload_file(image_path)
        
        prompt = """
Analiza esta imagen de un producto y genera un término de búsqueda preciso para Amazon España.

INSTRUCCIONES:
1. Identifica la marca, modelo y características principales del producto
2. Genera un término de búsqueda específico y directo
3. Incluye marca + modelo + especificación clave si es visible
4. Si es un dispositivo electrónico, incluye capacidad/color si se ve
5. Responde SOLO con el término de búsqueda, sin explicaciones

EJEMPLOS:
- Si ves un iPhone 15 Pro azul: "iPhone 15 Pro 256GB Azul"
- Si ves un MacBook Air: "MacBook Air M2 13 pulgadas"
- Si ves unos AirPods: "Apple AirPods Pro 2"

Genera el término de búsqueda para este producto:
"""
        
        response = vision_model.generate_content([prompt, image_file])
        search_query = response.text.strip()
        
        # Limpiar el resultado (quitar comillas, puntos finales, etc.)
        search_query = search_query.replace('"', '').replace("'", '').strip('.')
        
        print(f"🔍 IA Vision identificó: '{search_query}'")
        
        # Eliminar el archivo temporal de Gemini
        genai.delete_file(image_file.name)
        
        return search_query
        
    except Exception as e:
        print(f"❌ Error en identificación por imagen: {e}")
        return None
