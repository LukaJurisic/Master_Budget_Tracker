"""Income-specific API routes."""
from typing import Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..models.transaction import Transaction
from ..models.category import Category
from ..schemas.transactions import Transaction as TransactionSchema
from .deps import get_database
from ..utils.account_mapping import get_source_from_account_id
import hashlib

router = APIRouter()


class IncomeCreate(BaseModel):
    """Income creation request."""
    posted_date: date
    source: str
    amount: Decimal
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    notes: Optional[str] = None
    income_category: Optional[str] = None


@router.post("")
async def create_income(
    income_data: IncomeCreate,
    db: Session = Depends(get_database)
) -> TransactionSchema:
    """Create a new income transaction.
    
    Args:
        income_data: Income data
        
    Returns:
        Created income transaction
    """
    try:
        # Normalize fields
        from ..services.mapping_service import MappingService
        mapping_service = MappingService(db)
        
        merchant_norm = mapping_service.normalize_text(income_data.source)
        description_norm = mapping_service.normalize_text(income_data.notes or "")
        
        # Create hash for deduplication
        hash_input = f"{income_data.posted_date}|{income_data.amount}|{merchant_norm}|{description_norm}|income"
        hash_dedupe = hashlib.sha256(hash_input.encode()).hexdigest()
        
        # Check if exists
        existing = db.query(Transaction).filter_by(hash_dedupe=hash_dedupe).first()
        if existing:
            raise HTTPException(status_code=400, detail="Duplicate income transaction")
        
        # Use provided category_id if available, otherwise default to Income parent category
        if hasattr(income_data, 'category_id') and income_data.category_id:
            category_id = income_data.category_id
            subcategory_id = income_data.subcategory_id
        else:
            # Get or create Income parent category as fallback
            income_parent = db.query(Category).filter_by(name="Income", parent_id=None).first()
            if not income_parent:
                income_parent = Category(name="Income", color="#4CAF50")
                db.add(income_parent)
                db.flush()
            
            category_id = income_parent.id
            subcategory_id = income_data.subcategory_id
        
        # If income_category is provided in notes, create/find subcategory
        if hasattr(income_data, 'income_category') and income_data.income_category:
            subcategory = db.query(Category).filter_by(
                name=income_data.income_category, 
                parent_id=income_parent.id
            ).first()
            
            if not subcategory:
                # Auto-create new income category
                subcategory = Category(
                    name=income_data.income_category,
                    parent_id=income_parent.id,
                    color=f"#{hash(income_data.income_category) % 0xFFFFFF:06x}"  # Generate color from name
                )
                db.add(subcategory)
                db.flush()
            
            subcategory_id = subcategory.id
        
        # Create transaction with account_id = 1 (first account)
        # Determine source based on account
        account_id = 1  # Use first account
        source = get_source_from_account_id(db, account_id)
        if source == "Unknown":
            source = "Manual"  # Fallback for income transactions
        
        txn = Transaction(
            posted_date=income_data.posted_date,
            amount=abs(income_data.amount),  # Income is positive
            merchant_raw=income_data.source,
            description_raw=income_data.notes or "",
            merchant_norm=merchant_norm,
            description_norm=description_norm,
            category_id=category_id,
            subcategory_id=subcategory_id,
            source=source,
            hash_dedupe=hash_dedupe,
            txn_type="income",
            currency="CAD",
            account_id=account_id
        )
        
        db.add(txn)
        db.commit()
        db.refresh(txn)
        
        return txn
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))