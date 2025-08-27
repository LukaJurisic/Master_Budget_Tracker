"""External integration model for non-Plaid providers (crypto exchanges, etc)."""
from sqlalchemy import Column, String, Text, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from .base import BaseModel
import enum


class ProviderType(enum.Enum):
    """Supported external providers."""
    NDAX = "ndax"
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"


class ExternalIntegration(BaseModel):
    """Represents an external integration (crypto exchange, etc)."""
    
    __tablename__ = "external_integrations"
    
    provider = Column(Enum(ProviderType), nullable=False, index=True)
    api_key_encrypted = Column(Text, nullable=False)
    api_secret_encrypted = Column(Text, nullable=False)
    uid_encrypted = Column(Text)  # Optional, some exchanges require this
    login_encrypted = Column(Text)  # Optional, for exchanges requiring email login
    password_encrypted = Column(Text)  # Optional, for exchanges requiring password
    
    # Metadata
    label = Column(String(255))  # User-friendly name
    last_refresh = Column(DateTime(timezone=True))
    last_error = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # Cache for balance data (optional, JSON field)
    cached_balances = Column(Text)  # JSON string
    cache_expires_at = Column(DateTime(timezone=True))
    
    def __repr__(self):
        return f"<ExternalIntegration(id={self.id}, provider={self.provider}, active={self.is_active})>"