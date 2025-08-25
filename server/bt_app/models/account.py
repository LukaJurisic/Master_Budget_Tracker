"""Account model."""
from sqlalchemy import Column, String, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from .base import BaseModel


class Account(BaseModel):
    """Represents a bank account."""
    
    __tablename__ = "accounts"
    
    institution_item_id = Column(Integer, ForeignKey("institution_items.id"), nullable=False)
    plaid_account_id = Column(String(255), unique=True, index=True)  # Nullable for manual imports
    name = Column(String(255), nullable=False)
    mask = Column(String(10))  # Last 4 digits
    official_name = Column(String(255))
    currency = Column(String(3), default="CAD")
    account_type = Column(String(50))  # checking, savings, credit, etc.
    is_enabled_for_import = Column(Boolean, default=True)  # Control which accounts to import
    
    # Relationships
    institution_item = relationship("InstitutionItem", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Account(id={self.id}, name={self.name}, mask={self.mask})>"















