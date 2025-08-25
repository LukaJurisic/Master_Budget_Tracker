"""Enhanced Plaid API routes with staging workflow."""
from fastapi import APIRouter, HTTPException, Depends, Query, Request, Body, Response
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, field_validator
from typing import Optional, List, Literal
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
import json
import os
import inspect
from fastapi import HTTPException, Depends

from ..services.plaid_service import PlaidService
from ..services.plaid_import_service import PlaidImportService
from ..models.institution_item import InstitutionItem
from ..models.account import Account
from ..models.plaid_import import PlaidImport
from ..models.staging_transaction import StagingTransaction
from .deps import get_database

router = APIRouter(tags=["plaid-enhanced"])

# PlaidService will be created per request as needed

# Request/Response models
class LinkTokenRequest(BaseModel):
    products: List[str] = ["transactions", "liabilities"]
    account_subtypes: Optional[List[str]] = None

class ExchangeRequest(BaseModel):
    public_token: str

class ImportSyncBody(BaseModel):
    mode: Literal["sync"]
    item_id: str
    account_ids: Optional[List[str]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("item_id")
    @classmethod
    def _non_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("item_id is required")
        return v.strip()

class ImportRequest(BaseModel):
    item_id: int
    mode: str = "sync"  # "get" or "sync"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    account_ids: Optional[List[str]] = None

class ApproveRequest(BaseModel):
    row_ids: List[int]

class CommitRequest(BaseModel):
    row_ids: Optional[List[int]] = None
    statuses: Optional[List[str]] = None

class ExclusionRuleRequest(BaseModel):
    pattern: str
    field: str = "merchant"  # "merchant" or "description"
    is_regex: bool = False
    is_active: bool = True

@router.get("/whoami")
def plaid_whoami():
    """Debug endpoint to show which module/config the server is using."""
    from ..services import plaid_service as ps
    return {
        "module": ps.__name__,
        "file": inspect.getsourcefile(ps),
        "env": os.getenv("PLAID_ENV"),
        "cid_present": bool(os.getenv("PLAID_CLIENT_ID")),
        "secret_len": len(os.getenv("PLAID_SECRET") or ""),
    }

@router.get("/_ping_enhanced")
def _ping_enhanced():
    """Verify the enhanced router is being used."""
    return {"ok": True, "file": __file__, "_route": "enhanced-sync-v1"}

@router.post("/_test_import")
def _test_import():
    """Test endpoint to debug import issues."""
    from datetime import date
    print("[TEST] Test import endpoint called")
    return {
        "test": "success",
        "today": date.today().isoformat(),
        "message": "Test endpoint works"
    }

@router.get("/_test_json")
def _test_json():
    """Test JSON serialization."""
    from ..services.plaid_import_service import to_jsonable
    from datetime import date
    test_data = {
        "today": date.today(),
        "text": "test",
        "number": 123
    }
    return to_jsonable(test_data)

@router.post("/link-token")
@router.post("/link-token/create")  # alias
def create_link_token_endpoint(request: LinkTokenRequest, db: Session = Depends(get_database)):
    """Create a Plaid Link token."""
    print("[ROUTE DEBUG] Enhanced route handler called!")
    try:
        print("[ROUTE DEBUG] Creating PlaidService instance...")
        plaid = PlaidService(db)
        print("[ROUTE DEBUG] Calling plaid.create_link_token()...")
        resp = plaid.create_link_token()
        print(f"[ROUTE DEBUG] Got response: {resp}")
        # Add marker to prove this enhanced path is hit
        return {**resp, "_route": "enhanced-v2", "_file": __file__}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/exchange")
@router.post("/public-token/exchange")  # alias
def exchange_public_token_endpoint(request: ExchangeRequest, db: Session = Depends(get_database)):
    """Exchange public token for access token and fetch accounts."""
    try:
        plaid_service = PlaidService(db)
        result = plaid_service.exchange_public_token(request.public_token)
        
        # Save institution item
        institution_item = InstitutionItem(
            institution_name="Connected Institution",
            plaid_item_id=result["item_id"],
            access_token_encrypted=result["access_token"]
        )
        db.add(institution_item)
        db.flush()
        
        # Fetch and save accounts
        from plaid.model.accounts_get_request import AccountsGetRequest
        from ..services.plaid_import_service import PlaidImportService
        
        service = PlaidImportService(db)
        accounts_request = AccountsGetRequest(access_token=result["access_token"])
        accounts_response = service.client.accounts_get(accounts_request)
        
        account_data = []
        for acc in accounts_response.accounts:
            account = Account(
                institution_item_id=institution_item.id,
                plaid_account_id=acc.account_id,
                name=acc.name,
                mask=acc.mask,
                official_name=acc.official_name,
                currency=acc.balances.iso_currency_code or "USD",
                account_type=acc.type.value if acc.type else None,
                is_enabled_for_import=True
            )
            db.add(account)
            account_data.append({
                "id": acc.account_id,
                "name": acc.name,
                "type": acc.type.value if acc.type else None,
                "mask": acc.mask
            })
        
        db.commit()
        
        return {
            "item_id": institution_item.id,
            "accounts": account_data,
            "message": "Account linked successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/test-simple")
def test_simple():
    """Test endpoint with no parameters."""
    return {"test": "success", "message": "Simple route is working"}

@router.post("/test-sign-logic")
def test_sign_logic():
    """Test endpoint to verify the sign logic fix."""
    # Test positive amount (should be expense)
    test_cases = [
        {"amount": 100.0, "expected_type": "expense", "expected_amount": -100.0},
        {"amount": -50.0, "expected_type": "income", "expected_amount": 50.0}
    ]
    
    results = []
    for case in test_cases:
        plaid_amount = float(case["amount"])
        
        if plaid_amount > 0:
            # Outflow -> expense
            txn_type = "expense"
            amount_db = -abs(plaid_amount)
        else:
            # Inflow -> income
            txn_type = "income"
            amount_db = abs(plaid_amount)
        
        results.append({
            "input_amount": plaid_amount,
            "calculated_type": txn_type,
            "calculated_amount": amount_db,
            "expected_type": case["expected_type"],
            "expected_amount": case["expected_amount"],
            "correct": txn_type == case["expected_type"] and amount_db == case["expected_amount"]
        })
    
    return {"test_results": results}

@router.post("/fix-atm-transactions")
def fix_atm_transactions(db: Session = Depends(get_database)):
    """Fix the specific ATM withdrawal transactions that were incorrectly categorized."""
    try:
        # Update the two specific ATM transactions that were committed with wrong logic
        atm_ids = [4664, 4665]  # The transaction IDs we identified
        
        updated_count = 0
        for txn_id in atm_ids:
            result = db.execute(
                text("UPDATE transactions SET txn_type = 'expense', amount = -ABS(amount) WHERE id = :txn_id AND txn_type = 'income'"),
                {"txn_id": txn_id}
            )
            if result.rowcount > 0:
                updated_count += 1
        
        db.commit()
        return {
            "success": True,
            "updated_count": updated_count,
            "message": f"Fixed {updated_count} ATM withdrawal transactions"
        }
    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/transactions/test-import")
def test_import():
    """Test endpoint to verify enhanced router is being hit."""
    print("[TEST] Enhanced transactions/test-import route hit!")
    return {"test": "success", "message": "Enhanced route working", "route": "enhanced"}

def _parse_date(x):
    if not x:
        return None
    if isinstance(x, date):
        return x
    s = str(x)
    # tolerate "YYYY-MM-DDTHH:mm:ssZ"
    if "T" in s:
        s = s.split("T", 1)[0]
    s = s.rstrip("Z")
    return date.fromisoformat(s)

@router.post("/import-transactions")
def import_transactions(body: dict = Body(...), db: Session = Depends(get_database)):
    service = PlaidImportService(db)

    start_date = _parse_date(body.get("start_date"))
    end_date   = _parse_date(body.get("end_date"))
    account_ids = body.get("account_ids") or []
    item_id = int(body["item_id"])
    
    print(f"[IMPORT DEBUG] Received: start_date={start_date}, end_date={end_date}")

    # If caller supplied a date window OR asked for "get/range" → use /transactions/get
    mode = (body.get("mode") or "auto").lower()
    use_range = bool(start_date or end_date) or mode in ("get", "range", "date_range")

    print(f"[ROUTE DEBUG] start_date={start_date}, end_date={end_date}, mode={mode}, use_range={use_range}")

    if use_range:
        print(f"[ROUTE DEBUG] Using range mode - calling import_transactions with mode='get'")
        res = service.import_transactions(
            item_id=item_id,
            mode="get",
            start_date=start_date,
            end_date=end_date,
            account_ids=account_ids,
        )
        # normalize the response shape for the frontend
        return {
            "import_id": res["import_id"],
            "counts": res["summary"],
            "window": {
                "mode": "range",
                "start": res["start_date"],
                "end": res["end_date"],
            },
        }

    # otherwise fall back to cursor-based sync (deltas)
    print(f"[ROUTE DEBUG] Using sync mode - calling import_transactions_sync")
    return service.import_transactions_sync(
        item_id=item_id,
        account_ids=account_ids,
        start_date=start_date,
        end_date=end_date,
    )

@router.get("/imports/{import_id}/staging")
def get_staging_transactions(
    import_id: int,
    status: Optional[List[str]] = Query(None),
    mapped_state: Optional[str] = Query(None),
    account_ids: Optional[List[int]] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_database)
):
    """Get staging transactions with filters."""
    service = PlaidImportService(db)
    transactions = service.get_staging_transactions(
        import_id=import_id,
        status=status,
        mapped_state=mapped_state,
        account_ids=account_ids,
        search=search
    )
    
    # Format response - using the already loaded relationships
    result = []
    for tx in transactions:
        result.append({
            "id": tx.id,
            "plaid_transaction_id": tx.plaid_transaction_id,
            "date": tx.date.isoformat() if tx.date else None,
            "authorized_date": tx.authorized_date.isoformat() if tx.authorized_date else None,
            "name": tx.name,
            "merchant_name": tx.merchant_name,
            "amount": float(tx.amount),
            "currency": tx.currency,
            "account_id": tx.account_id,
            "account_name": tx.account.name if tx.account else None,
            "status": tx.status,
            "exclude_reason": tx.exclude_reason,
            "suggested_category_id": tx.suggested_category_id,
            "suggested_subcategory_id": tx.suggested_subcategory_id,
            "suggested_category_name": tx.suggested_category.name if tx.suggested_category else None,
            "suggested_subcategory_name": tx.suggested_subcategory.name if tx.suggested_subcategory else None,
            "pf_category_primary": tx.pf_category_primary,
            "pf_category_detailed": tx.pf_category_detailed
        })
    
    # Get aggregates
    status_counts = {}
    for tx in transactions:
        status_counts[tx.status] = status_counts.get(tx.status, 0) + 1
    
    response_data = {
        "transactions": result,
        "aggregates": {
            "total": len(transactions),
            "by_status": status_counts
        }
    }
    
    # Return with no-cache headers to prevent stale data issues
    return JSONResponse(
        content=response_data,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )


@router.get("/imports/{import_id}/staging/audit")
def audit_import(import_id: int, db: Session = Depends(get_database)):
    """Audit staging transactions for date consistency."""
    from app.models.plaid_import import PlaidImport
    from sqlalchemy import and_, or_
    
    imp = db.query(PlaidImport).get(import_id)
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    
    start, end = imp.start_date, imp.end_date
    q = db.query(StagingTransaction).filter_by(import_id=import_id)
    
    # Count transactions outside the window
    out_of_window_conditions = []
    if start:
        out_of_window_conditions.append(StagingTransaction.date < start)
    if end:
        out_of_window_conditions.append(StagingTransaction.date > end)
    
    out_of_window = 0
    if out_of_window_conditions:
        out_of_window = q.filter(
            or_(StagingTransaction.date.is_(None), or_(*out_of_window_conditions))
        ).count()
    
    null_dates = q.filter(StagingTransaction.date.is_(None)).count()
    
    return {
        "import_id": import_id,
        "window": {"start": start, "end": end},
        "total": q.count(),
        "out_of_window": out_of_window,
        "null_dates": null_dates,
    }

@router.post("/imports/{import_id}/approve")
def approve_transactions(
    import_id: int,
    request: ApproveRequest,
    db: Session = Depends(get_database)
):
    """Mark transactions as approved or toggle exclude status."""
    try:
        transactions = db.query(StagingTransaction).filter(
            StagingTransaction.id.in_(request.row_ids),
            StagingTransaction.import_id == import_id
        ).all()
        
        for tx in transactions:
            if tx.status == "excluded":
                # Toggle back to needs_category or ready
                if tx.suggested_category_id:
                    tx.status = "ready"
                else:
                    tx.status = "needs_category"
                tx.exclude_reason = None
            elif tx.status in ["needs_category", "ready"]:
                tx.status = "approved"
        
        db.commit()
        
        return {
            "updated": len(transactions),
            "message": "Transactions updated successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/imports/{import_id}/commit")
def commit_import(
    import_id: int,
    request: CommitRequest,
    db: Session = Depends(get_database)
):
    """Commit staged transactions to main transactions table."""
    try:
        service = PlaidImportService(db)
        result = service.commit_import(import_id, request.row_ids, request.statuses)
        return result
    except ValueError as ve:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"[COMMIT] ValueError: {ve}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        tb = traceback.format_exc()
        logger.error(f"[COMMIT] Unexpected error: {e}\n{tb}")
        db.rollback()
        # Temporarily surface the traceback so we can see the exact line:
        raise HTTPException(status_code=500, detail=f"{e}\n{tb}")

@router.get("/items")
def list_items(db: Session = Depends(get_database)):
    """List connected Plaid items with their accounts."""
    items = db.query(InstitutionItem).all()
    
    result = []
    for item in items:
        accounts = db.query(Account).filter(Account.institution_item_id == item.id).all()
        result.append({
            "item_id": str(item.id),  # This is what should be sent in import requests
            "plaid_item_id": item.plaid_item_id,
            "institution_name": item.institution_name,
            "accounts": [
                {
                    "account_id": acc.plaid_account_id,
                    "name": acc.name,
                    "mask": acc.mask,
                    "enabled": acc.is_enabled_for_import
                }
                for acc in accounts
            ]
        })
    
    return result

@router.get("/accounts")
def get_plaid_accounts(db: Session = Depends(get_database)):
    """Get all Plaid-connected accounts."""
    accounts = db.query(Account).join(InstitutionItem).all()
    
    result = []
    for acc in accounts:
        result.append({
            "id": acc.id,
            "plaid_account_id": acc.plaid_account_id,
            "name": acc.name,
            "mask": acc.mask,
            "type": acc.account_type,
            "currency": acc.currency,
            "is_enabled_for_import": acc.is_enabled_for_import,
            "institution_name": acc.institution_item.institution_name if acc.institution_item else None,
            "institution_item_id": acc.institution_item_id
        })
    
    return result

@router.put("/accounts/{account_id}/toggle-import")
def toggle_account_import(account_id: int, db: Session = Depends(get_database)):
    """Toggle account import status."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    account.is_enabled_for_import = not account.is_enabled_for_import
    db.commit()
    
    return {
        "id": account.id,
        "is_enabled_for_import": account.is_enabled_for_import
    }

@router.get("/imports")
def get_imports(db: Session = Depends(get_database)):
    """Get all import sessions."""
    imports = db.query(PlaidImport).order_by(PlaidImport.created_at.desc()).all()
    
    result = []
    for imp in imports:
        summary = json.loads(imp.summary_json) if imp.summary_json else {}
        result.append({
            "id": imp.id,
            "item_id": imp.item_id,
            "mode": imp.mode,
            "start_date": imp.start_date.isoformat() if imp.start_date else None,
            "end_date": imp.end_date.isoformat() if imp.end_date else None,
            "created_at": imp.created_at.isoformat() if imp.created_at else None,
            "summary": summary,
            "institution_name": imp.institution_item.institution_name if imp.institution_item else None
        })
    
    return result

@router.post("/imports/{import_id}/remap-staging")
def remap_staging_transactions(
    import_id: int,
    db: Session = Depends(get_database)
):
    """Re-apply mapping to all staging transactions in an import."""
    try:
        service = PlaidImportService(db)
        
        # Get all staging transactions for this import
        staging_txs = db.query(StagingTransaction).filter(
            StagingTransaction.import_id == import_id
        ).all()
        
        updated_count = 0
        for staging_tx in staging_txs:
            old_category = staging_tx.suggested_category_id
            old_status = staging_tx.status
            
            # Re-apply mapping
            service._apply_mapping(staging_tx)
            
            if staging_tx.suggested_category_id != old_category or staging_tx.status != old_status:
                updated_count += 1
        
        db.commit()
        
        return {
            "updated": updated_count,
            "total": len(staging_txs),
            "message": f"Re-mapped {updated_count} transactions"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

class UpdateCategoryRequest(BaseModel):
    category_id: int
    subcategory_id: Optional[int] = None

@router.put("/staging/{staging_id}/category")
def update_staging_category(
    staging_id: int,
    category_id: Optional[int] = Query(default=None),
    request: Optional[UpdateCategoryRequest] = Body(default=None),
    db: Session = Depends(get_database)
):
    """Update category for a staging transaction."""
    # Allow both query parameter and request body
    if category_id is None and request and hasattr(request, 'category_id'):
        category_id = request.category_id
    if not isinstance(category_id, int):
        raise HTTPException(status_code=422, detail="category_id must be an integer")
    
    tx = db.query(StagingTransaction).filter(StagingTransaction.id == staging_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Staging transaction not found")
    
    tx.suggested_category_id = category_id
    tx.suggested_subcategory_id = request.subcategory_id if request else None
    
    # Update status
    if tx.status == "needs_category":
        tx.status = "ready"
    
    db.commit()
    
    return {
        "id": tx.id,
        "status": tx.status,
        "suggested_category_id": tx.suggested_category_id,
        "suggested_subcategory_id": tx.suggested_subcategory_id
    }

@router.post("/staging/bulk-categorize")
def bulk_categorize(
    staging_ids: List[int],
    category_id: int,
    subcategory_id: Optional[int] = None,
    db: Session = Depends(get_database)
):
    """Bulk categorize staging transactions."""
    transactions = db.query(StagingTransaction).filter(
        StagingTransaction.id.in_(staging_ids)
    ).all()
    
    for tx in transactions:
        tx.suggested_category_id = category_id
        tx.suggested_subcategory_id = subcategory_id
        if tx.status == "needs_category":
            tx.status = "ready"
    
    db.commit()
    
    return {
        "updated": len(transactions),
        "message": f"Updated {len(transactions)} transactions"
    }

@router.delete("/staging/{staging_id}")
def delete_staging_transaction(
    staging_id: int,
    db: Session = Depends(get_database)
):
    """Delete a staging transaction."""
    tx = db.query(StagingTransaction).filter(StagingTransaction.id == staging_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Staging transaction not found")
    
    db.delete(tx)
    db.commit()
    
    return {"message": "Transaction deleted successfully"}

class CreateCategoryRequest(BaseModel):
    name: str
    parent_id: Optional[int] = None

@router.post("/categories")
def create_category(
    request: CreateCategoryRequest,
    db: Session = Depends(get_database)
):
    """Create a new category."""
    from ..models.category import Category
    
    # Check if category already exists
    existing = db.query(Category).filter(Category.name == request.name).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "message": "Category already exists"}
    
    category = Category(name=request.name, parent_id=request.parent_id)
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return {"id": category.id, "name": category.name, "message": "Category created successfully"}# Force reload
