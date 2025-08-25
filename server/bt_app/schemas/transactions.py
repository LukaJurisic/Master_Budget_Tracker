"""Transaction-related schemas."""
from typing import Optional, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field
from .common import BaseSchema, TimestampSchema, Category


class TransactionBase(BaseSchema):
    """Base transaction schema."""
    
    posted_date: date
    amount: Decimal
    currency: str = "CAD"
    merchant_raw: Optional[str] = None
    description_raw: Optional[str] = None
    merchant_norm: Optional[str] = None
    description_norm: Optional[str] = None
    cleaned_final_merchant: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    source: str = "plaid"
    txn_type: str = "expense"


class Transaction(TransactionBase, TimestampSchema):
    """Transaction schema with ID."""
    
    id: int
    account_id: int
    plaid_transaction_id: Optional[str] = None
    hash_dedupe: str
    category: Optional["Category"] = None
    subcategory: Optional["Category"] = None


class TransactionCreate(TransactionBase):
    """Transaction creation schema."""
    
    account_id: int
    hash_dedupe: Optional[str] = None


class TransactionUpdate(BaseSchema):
    """Transaction update schema - does NOT allow changing txn_type to prevent corruption."""
    
    posted_date: Optional[date] = None
    amount: Optional[Decimal] = None
    merchant_raw: Optional[str] = None
    description_raw: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    merchant_norm: Optional[str] = None
    # Deliberately exclude txn_type to prevent accidental corruption


class TransactionFilter(BaseSchema):
    """Transaction filtering parameters."""
    
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    account_id: Optional[int] = None
    category_id: Optional[int] = None
    merchant: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    source: Optional[str] = None
    unmapped: Optional[bool] = None


class TransactionList(BaseSchema):
    """Paginated transaction list."""
    
    transactions: List[Transaction]
    total: int
    page: int
    per_page: int
    pages: int


class UnmappedMerchant(BaseSchema):
    """Unmapped merchant summary."""
    
    merchant_norm: str
    count: int
    total_amount: Decimal
    first_seen: date
    last_seen: date















