"""Transaction model."""
from sqlalchemy import Column, String, Integer, ForeignKey, Date, Numeric, Index, UniqueConstraint, Boolean, Text
from sqlalchemy.orm import relationship
from .base import BaseModel


class Transaction(BaseModel):
    """Represents a financial transaction."""
    
    __tablename__ = "transactions"
    
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    plaid_transaction_id = Column(String(255), unique=True, index=True)  # Nullable for manual imports
    posted_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(10, 2), nullable=False)  # Negative for expenses, positive for income
    currency = Column(String(3), default="CAD")
    
    # Raw data from source
    merchant_raw = Column(String(500))
    description_raw = Column(String(500))
    
    # Normalized/processed data
    merchant_norm = Column(String(255), index=True)
    description_norm = Column(String(255), index=True)  # Added for 2-level mapping
    cleaned_final_merchant = Column(String(255), index=True)  # Final merchant name for analysis
    category_id = Column(Integer, ForeignKey("categories.id"))
    subcategory_id = Column(Integer, ForeignKey("categories.id"))
    
    # Metadata
    source = Column(String(50), default="plaid")  # plaid, csv, ofx
    hash_dedupe = Column(String(64), nullable=False, index=True)
    txn_type = Column(String(10), nullable=False, default="expense")  # expense, income
    
    # Enhanced Plaid integration fields
    external_id = Column(String(255), unique=True, index=True)  # Maps to plaid_transaction_id
    import_id = Column(Integer, ForeignKey("plaid_imports.id"))  # Links to import session
    raw_json = Column(Text)  # Complete source JSON for audit
    is_deleted = Column(Boolean, default=False, index=True)  # Soft delete for removed transactions
    
    # Relationships
    account = relationship("Account", back_populates="transactions")
    category = relationship("Category", foreign_keys=[category_id])  # back_populates temporarily disabled
    subcategory = relationship("Category", foreign_keys=[subcategory_id])
    plaid_import = relationship("PlaidImport")
    
    # Unique constraint for deduplication
    __table_args__ = (
        UniqueConstraint('account_id', 'posted_date', 'amount', 'hash_dedupe', name='_transaction_dedupe_uc'),
        Index('ix_transactions_unmapped', 'merchant_norm', 'category_id'),
        Index('ix_transactions_import_id', 'import_id'),
    )
    
    def __repr__(self):
        return f"<Transaction(id={self.id}, date={self.posted_date}, amount={self.amount}, merchant={self.merchant_norm})>"















