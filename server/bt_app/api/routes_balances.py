"""API routes for account balances."""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Optional, List

from ..services.balances import BalanceService
from .deps import get_database

router = APIRouter(tags=["balances"])


@router.get("/accounts")
async def get_refreshable_accounts(db: Session = Depends(get_database)):
    """Get list of accounts that can be refreshed.
    
    Returns:
        List of accounts with their institution info
    """
    try:
        from ..models.account import Account
        from ..models.institution_item import InstitutionItem
        
        # Get all accounts with active institution items
        accounts = db.query(Account).join(
            Account.institution_item
        ).filter(
            InstitutionItem.access_token_encrypted.isnot(None)
        ).all()
        
        account_list = []
        for account in accounts:
            account_list.append({
                "id": account.id,
                "name": account.name,
                "official_name": account.official_name,
                "mask": account.mask,
                "institution": account.institution_item.institution_name,
                "type": account.account_type,
                "subtype": account.account_subtype,
                "currency": account.iso_currency_code,
            })
        
        return {"accounts": account_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_balances(
    request_body: dict = {},
    db: Session = Depends(get_database)
):
    """Manually refresh account balances from Plaid.
    
    Request Body:
        account_ids: Optional list of account IDs to refresh. If None, refreshes all accounts.
    
    Returns:
        RefreshResult with updated balances and totals
    """
    try:
        account_ids = request_body.get('account_ids') if request_body else None
        service = BalanceService(db)
        result = service.refresh_all_balances(account_ids=account_ids)
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