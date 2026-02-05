"""
Pydantic Models for API requests/responses
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    OPERARIO = "operario"
    VENDEDOR = "vendedor"


class UserBase(BaseModel):
    username: str
    role: UserRole


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    role: UserRole
    created_at: datetime


class LoginResponse(BaseModel):
    success: bool
    message: str
    user: Optional[UserResponse] = None
    token: Optional[str] = None


# ===== Producto Models =====

class PhotoInfo(BaseModel):
    filename: str
    path: str
    size_bytes: int


class AmazonData(BaseModel):
    title: str
    price: float
    description: str
    image_url: Optional[str] = None
    url: Optional[str] = None


class RealCondition(BaseModel):
    defects_description: str
    photos: List[PhotoInfo]


class WallapopListing(BaseModel):
    optimized_description: str
    title: str
    price: float


class Pricing(BaseModel):
    amazon_price: float
    wallapop_price: float
    discount_percentage: float


class ProductBase(BaseModel):
    product_id: str
    created_at: datetime
    amazon_data: AmazonData
    real_condition: RealCondition
    wallapop_listing: WallapopListing
    pricing: Pricing
    status: str = "pending"


class ProductResponse(BaseModel):
    id: str
    product_id: str
    created_at: datetime
    title: str
    amazon_price: float
    wallapop_price: float
    optimized_description: str
    defects: str
    photos_count: int
    photo_urls: List[str] = []
    amazon_image_url: Optional[str] = None
    status: str


class ProductListResponse(BaseModel):
    success: bool
    total: int
    products: List[ProductResponse]


class ProductFilters(BaseModel):
    search: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    skip: int = 0
    limit: int = 20
