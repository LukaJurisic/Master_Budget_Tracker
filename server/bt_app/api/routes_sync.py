"""Sync API routes."""
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..services.plaid_service import PlaidService
from ..services.mapping_service import MappingService
from .deps import get_database

router = APIRouter()


@router.post("/amex")
async def sync_amex_transactions(
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Sync transactions from all connected Amex accounts via Plaid.
    
    Returns:
        Dictionary with sync results
    """
    try:
        plaid_service = PlaidService(db)
        result = plaid_service.sync_all_items()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/item/{item_id}")
async def sync_item_transactions(
    item_id: int,
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Sync transactions for a specific institution item.
    
    Args:
        item_id: Institution item ID
        
    Returns:
        Dictionary with sync results
    """
    try:
        plaid_service = PlaidService(db)
        result = plaid_service.sync_item_transactions(item_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/normalize")
async def normalize_transactions(
    since_date: Optional[str] = None,
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Normalize merchant names for transactions.
    
    Args:
        since_date: Only process transactions after this date (YYYY-MM-DD)
        
    Returns:
        Dictionary with normalization results
    """
    try:
        mapping_service = MappingService(db)
        count = mapping_service.normalize_unmapped_transactions(since_date)
        return {"normalized_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/map")
async def apply_mapping_rules(
    since_date: Optional[str] = None,
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Apply mapping rules to unmapped transactions.
    
    Args:
        since_date: Only process transactions after this date (YYYY-MM-DD)
        
    Returns:
        Dictionary with mapping results
    """
    try:
        mapping_service = MappingService(db)
        result = mapping_service.apply_rules_to_unmapped(since_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))















