from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from ..api.deps import get_database

# If you already have a credential store model/service, import + reuse it.
# Otherwise, keep this simple and wire it into your existing secrets service.

router = APIRouter(prefix="/api/integrations/ndax", tags=["ndax"])

class NdaxCredsIn(BaseModel):
    api_key: str = Field(..., min_length=1)
    api_secret: str = Field(..., min_length=1)
    label: str | None = None
    uid: str | None = None  # optional

class TestResult(BaseModel):
    success: bool
    message: str | None = None

class BalancesOut(BaseModel):
    connected: bool
    balances: list[dict] = []
    message: str | None = None

# --- In-memory placeholder; replace with your encrypted store ---------------
# e.g., write/read via your Secrets table/service keyed by user_id.
_ndax_store: dict[str, dict] = {}

@router.get("/test-loaded")
def test_router_loaded():
    """Test endpoint to verify router is loaded"""
    return {"loaded": True, "message": "New NDAX router is working"}

@router.get("/balances", response_model=BalancesOut)
def get_balances(db: Session = Depends(get_database)):
    # Return 200 even when not connected (avoids noisy 404s on the UI)
    creds = _ndax_store.get("default")
    if not creds:
        return BalancesOut(connected=False, balances=[], message="Not connected")

    try:
        import ccxt
        ex = ccxt.ndax({
            'apiKey': creds['api_key'],
            'secret': creds['api_secret'],
            'uid': creds.get('uid'),
            'enableRateLimit': True,
        })
        raw = ex.fetch_balance()
        totals = raw.get('total') or {}
        free   = raw.get('free')  or {}
        used   = raw.get('used')  or {}
        rows = []
        for asset, total in totals.items():
            if total:
                rows.append({
                    "asset": asset,
                    "free": float(free.get(asset) or 0),
                    "used": float(used.get(asset) or 0),
                    "total": float(total or 0),
                })
        return BalancesOut(connected=True, balances=rows)
    except Exception as e:
        # Surface a friendly error but keep 200 so UI can display it
        return BalancesOut(connected=True, balances=[], message=str(e))

@router.post("/test", response_model=TestResult)
def test_connection(body: NdaxCredsIn | None = None):
    try:
        import ccxt
        # Use body if provided, otherwise fall back to stored creds
        creds = body.dict() if body else _ndax_store.get("default")
        if not creds:
            return TestResult(success=False, message="No credentials provided or connected")
        
        ex = ccxt.ndax({
            'apiKey': creds['api_key'],
            'secret': creds['api_secret'],
            'uid': creds.get('uid'),
            'enableRateLimit': True,
        })
        # lightweight call
        ex.fetch_balance()
        return TestResult(success=True)
    except Exception as e:
        return TestResult(success=False, message=str(e))

@router.post("/connect", response_model=TestResult)
def connect_ndax(body: NdaxCredsIn, db: Session = Depends(get_database)):
    # TODO: replace with your encrypted persistence
    _ndax_store["default"] = body.dict()
    return TestResult(success=True)