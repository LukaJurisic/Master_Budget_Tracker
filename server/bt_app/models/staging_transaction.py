"""Staging transaction model for Plaid imports."""
from sqlalchemy import Column, String, Integer, ForeignKey, Date, Numeric, Text, Index
from sqlalchemy.orm import relationship
from .base import BaseModel


class StagingTransaction(BaseModel):
    """Staging area for Plaid transactions before committing to main transactions."""
    
    __tablename__ = "staging_transactions"
    
    # Import tracking
    import_id = Column(Integer, ForeignKey("plaid_imports.id"), nullable=False)
    
    # Plaid identifiers
    plaid_transaction_id = Column(String(255), nullable=False)
    plaid_pending_transaction_id = Column(String(255))  # For pending→posted reconciliation
    
    # Account info
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    
    # Transaction details
    date = Column(Date, nullable=False)
    authorized_date = Column(Date)
    name = Column(String(500))  # Plaid transaction name
    merchant_name = Column(String(500))  # Plaid merchant name
    amount = Column(Numeric(10, 2), nullable=False)  # Keep original sign
    currency = Column(String(3), default="USD")
    
    # Plaid categories
    pf_category_primary = Column(String(100))
    pf_category_detailed = Column(String(200))
    
    # Mapping suggestions
    suggested_category_id = Column(Integer, ForeignKey("categories.id"))
    suggested_subcategory_id = Column(Integer, ForeignKey("categories.id"))
    
    # Status and processing
    status = Column(String(20), nullable=False, default="needs_category")
    # Status values: 'needs_category', 'ready', 'excluded', 'duplicate', 'superseded', 'approved'
    exclude_reason = Column(String(100))
    
    # Technical fields
    hash_key = Column(String(64), nullable=False, index=True)  # For fast set operations
    raw_json = Column(Text)  # Complete Plaid transaction JSON
    
    # Relationships
    plaid_import = relationship("PlaidImport", back_populates="staging_transactions")
    account = relationship("Account")
    suggested_category = relationship("Category", foreign_keys=[suggested_category_id])
    suggested_subcategory = relationship("Category", foreign_keys=[suggested_subcategory_id])
    
    # Indexes
    __table_args__ = (
        Index('ix_staging_plaid_transaction_id', 'plaid_transaction_id'),
        Index('ix_staging_import_status', 'import_id', 'status'),
        Index('ix_staging_hash_key', 'hash_key'),
    )
    
    def __repr__(self):
        return f"<StagingTransaction(id={self.id}, plaid_id={self.plaid_transaction_id}, status={self.status})>"