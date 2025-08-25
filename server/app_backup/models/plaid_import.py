"""Plaid import tracking model."""
from sqlalchemy import Column, String, Integer, ForeignKey, Date, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import BaseModel


class PlaidImport(BaseModel):
    """Tracks Plaid import sessions for staging workflow."""
    
    __tablename__ = "plaid_imports"
    
    item_id = Column(Integer, ForeignKey("institution_items.id"), nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    mode = Column(String(10), nullable=False)  # 'get' or 'sync'
    created_by = Column(String(255), default="system")
    summary_json = Column(Text)  # JSON summary of counts by status
    
    # Relationships
    institution_item = relationship("InstitutionItem")
    staging_transactions = relationship("StagingTransaction", back_populates="plaid_import")
    
    def __repr__(self):
        return f"<PlaidImport(id={self.id}, mode={self.mode}, created_at={self.created_at})>"