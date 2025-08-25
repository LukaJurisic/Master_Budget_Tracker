"""API routes for account balances."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Optional

from ..services.balances import BalanceService
from .deps import get_database

router = APIRouter(tags=["balances"])


@router.post("/refresh")
async def refresh_balances(db: Session = Depends(get_database)):
    """Manually refresh account balances from Plaid.
    
    Returns:
        RefreshResult with updated balances and totals
    """
    try:
        service = BalanceService(db)
        result = service.refresh_all_balances()
        return jsonable_encoder(result.to_dict())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_balances(db: Session = Depends(get_database)):
    """Get the latest balance snapshot for all accounts.
    
    Returns:
        Latest balances with totals (assets, liabilities, net worth)
    """
    try:
        service = BalanceService(db)
        result = service.get_latest_balances()
        return jsonable_encoder(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_balance_history(
    account_id: int = Query(..., description="Account ID"),
    days: int = Query(30, description="Number of days of history"),
    db: Session = Depends(get_database)
):
    """Get balance history for a specific account.
    
    Args:
        account_id: The account ID to get history for
        days: Number of days of history (default 30)
        
    Returns:
        Time series of balance snapshots
    """
    try:
        service = BalanceService(db)
        result = service.get_balance_history(account_id, days)
        return jsonable_encoder(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))