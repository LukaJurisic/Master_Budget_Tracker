"""Common schema definitions."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class BaseSchema(BaseModel):
    """Base schema with common fields."""
    
    class Config:
        from_attributes = True


class TimestampSchema(BaseSchema):
    """Schema with timestamp fields."""
    
    created_at: datetime
    updated_at: Optional[datetime] = None


class CategoryBase(BaseSchema):
    """Base category schema."""
    
    name: str
    parent_id: Optional[int] = None
    color: Optional[str] = None


class Category(CategoryBase, TimestampSchema):
    """Category schema with ID."""
    
    id: int
    full_path: str


class CategoryCreate(CategoryBase):
    """Category creation schema."""
    pass


class AccountBase(BaseSchema):
    """Base account schema."""
    
    name: str
    mask: Optional[str] = None
    official_name: Optional[str] = None
    currency: str = "CAD"
    account_type: Optional[str] = None


class Account(AccountBase, TimestampSchema):
    """Account schema with ID."""
    
    id: int
    institution_item_id: int
    plaid_account_id: Optional[str] = None


class InstitutionItemBase(BaseSchema):
    """Base institution item schema."""
    
    institution_name: str
    plaid_item_id: str


class InstitutionItem(InstitutionItemBase, TimestampSchema):
    """Institution item schema with ID."""
    
    id: int
    accounts: list[Account] = []










