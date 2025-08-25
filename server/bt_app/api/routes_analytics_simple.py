"""Simple analytics endpoints for transaction frequency."""
from typing import Optional
from datetime import datetime
import calendar
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..core.db import get_db

router = APIRouter()

@router.get("/transaction-frequency-by-category")
def transaction_frequency_by_category(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Transaction frequency by category with sample data."""
    return {
        "data": [
            {"category": "Groceries", "color": "#ff6b6b", "total_transactions": 45, "avg_per_month": 5.0},
            {"category": "Restaurants", "color": "#4ecdc4", "total_transactions": 32, "avg_per_month": 3.6},
            {"category": "Gas", "color": "#45b7d1", "total_transactions": 28, "avg_per_month": 3.1},
            {"category": "Shopping", "color": "#96ceb4", "total_transactions": 25, "avg_per_month": 2.8},
            {"category": "Telecom", "color": "#feca57", "total_transactions": 12, "avg_per_month": 1.3},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
    }

@router.get("/transaction-frequency-by-merchant") 
def transaction_frequency_by_merchant(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    """Transaction frequency by merchant with sample data."""
    return {
        "data": [
            {"merchant": "Loblaws", "total_transactions": 42, "avg_per_month": 4.7, "total_amount": 2150.50},
            {"merchant": "Tim Hortons", "total_transactions": 38, "avg_per_month": 4.2, "total_amount": 380.00},
            {"merchant": "Shell", "total_transactions": 24, "avg_per_month": 2.7, "total_amount": 1200.00},
            {"merchant": "Metro", "total_transactions": 22, "avg_per_month": 2.4, "total_amount": 1890.25},
            {"merchant": "Rogers", "total_transactions": 12, "avg_per_month": 1.3, "total_amount": 960.00},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
    }

@router.get("/available-months")
def available_months(db: Session = Depends(get_db)):
    """Get the available months range from transactions."""
    row = db.execute(text("""
        SELECT
          strftime('%Y-%m', MIN(posted_date))  AS first_month,
          strftime('%Y-%m', MAX(posted_date))  AS last_month,
          -- months_count inclusive
          ( (cast(strftime('%Y', MAX(posted_date)) as int) * 12 + cast(strftime('%m', MAX(posted_date)) as int))
          - (cast(strftime('%Y', MIN(posted_date)) as int) * 12 + cast(strftime('%m', MIN(posted_date)) as int)) + 1
          ) AS months_count
        FROM transactions
    """)).fetchone()

    first = row.first_month  # 'YYYY-MM'
    last  = row.last_month   # 'YYYY-MM'

    # Build day-precision dates the UI expects
    start_date = f"{first}-01"
    last_y, last_m = map(int, last.split("-"))
    end_date = f"{last}-{calendar.monthrange(last_y, last_m)[1]:02d}"

    payload = {
        # simple keys
        "first": first,
        "last": last,

        # snake_case variants
        "first_month": first,
        "last_month": last,

        # frontend expects these exact field names
        "min_month": first,
        "max_month": last,
        "latest_with_data": last,

        # nested month-only range
        "range": {"start": first, "end": last},

        # day-precision range the Analytics page expects
        "date_range": {
            "start_date": start_date,
            "end_date": end_date,
            "months_count": row.months_count,
        },

        "months_count": row.months_count,

        # optional wrapper some callers use
        "data": {"first_month": first, "last_month": last},
    }

    return payload