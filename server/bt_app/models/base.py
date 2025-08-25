"""Base model classes."""
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.sql import func
from ..core.db import Base


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class BaseModel(Base, TimestampMixin):
    """Base model with id and timestamps."""
    
    __abstract__ = True
    
    id = Column(Integer, primary_key=True, index=True)










