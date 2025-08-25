"""Account balance model for daily snapshots."""
from sqlalchemy import Column, String, Integer, ForeignKey, Date, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class AccountBalance(BaseModel):
    """Represents a daily snapshot of an account's balance."""
    
    __tablename__ = "account_balances"
    
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    as_of = Column(Date, nullable=False, index=True)  # Daily snapshot date
    available = Column(Numeric(15, 2), nullable=True)  # Available balance
    current = Column(Numeric(15, 2), nullable=True)  # Current balance
    iso_currency_code = Column(String(3))  # ISO 4217 currency code
    
    # Relationships
    account = relationship("Account", back_populates="balances")
    
    # Unique constraint: only one balance per account per day
    __table_args__ = (
        UniqueConstraint('account_id', 'as_of', name='_account_date_uc'),
    )
    
    def __repr__(self):
        return f"<AccountBalance(account_id={self.account_id}, as_of={self.as_of}, current={self.current})>"