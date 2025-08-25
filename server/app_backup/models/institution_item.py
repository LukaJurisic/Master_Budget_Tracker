"""Institution item model for Plaid connections."""
from sqlalchemy import Column, String, Text
from sqlalchemy.orm import relationship
from .base import BaseModel


class InstitutionItem(BaseModel):
    """Represents a connected financial institution via Plaid."""
    
    __tablename__ = "institution_items"
    
    institution_name = Column(String(255), nullable=False)
    plaid_item_id = Column(String(255), unique=True, nullable=False, index=True)
    access_token_encrypted = Column(Text, nullable=False)
    next_cursor = Column(String(512))  # For transactions/sync pagination
    
    # Relationships
    accounts = relationship("Account", back_populates="institution_item", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<InstitutionItem(id={self.id}, institution={self.institution_name})>"










