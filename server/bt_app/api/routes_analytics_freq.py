# app/api/routes_analytics_freq.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from .deps import get_database
from ..utils.query import parse_date_range

router = APIRouter()

@router.get("/test-freq-router")
def test_freq_router():
    """Test endpoint to verify frequency router is working"""
    return {"message": "Frequency router is working!", "timestamp": "2025-08-23"}

@router.get("/transaction-frequency-by-category")
def transaction_frequency_by_category(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database),
):
    start, end = parse_date_range(date_from, date_to)
    months = ((end.year - start.year) * 12 + (end.month - start.month)) + 1
    rows = db.execute(text("""
        SELECT 
          c.name AS category_name,
          c.color AS category_color,
          COUNT(t.id) AS total_transactions,
          ROUND(CAST(COUNT(t.id) AS FLOAT) / :months, 2) AS avg_per_month
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE lower(t.txn_type)='expense'
          AND t.posted_date >= :start AND t.posted_date <= :end
          AND t.category_id IS NOT NULL
        GROUP BY c.id, c.name, c.color
        ORDER BY total_transactions DESC
        LIMIT :limit
    """), {"start": start, "end": end, "months": months, "limit": limit}).fetchall()
    return {
        "data": [
            {
                "category": r.category_name,
                "color": r.category_color,
                "total_transactions": int(r.total_transactions or 0),
                "avg_per_month": float(r.avg_per_month or 0.0),
            } for r in rows
        ],
        "date_range": {"start_date": str(start), "end_date": str(end), "months_count": months},
    }

@router.get("/transaction-frequency-by-merchant")
def transaction_frequency_by_merchant(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database),
):
    start, end = parse_date_range(date_from, date_to)
    months = ((end.year - start.year) * 12 + (end.month - start.month)) + 1
    rows = db.execute(text("""
        SELECT 
          COALESCE(NULLIF(TRIM(t.cleaned_final_merchant), ''), NULLIF(TRIM(t.merchant_raw), ''), 'Unknown') AS merchant,
          COUNT(t.id) AS total_transactions,
          ROUND(CAST(COUNT(t.id) AS FLOAT) / :months, 2) AS avg_per_month,
          SUM(t.amount) AS total_amount
        FROM transactions t
        WHERE lower(t.txn_type)='expense'
          AND t.posted_date >= :start AND t.posted_date <= :end
        GROUP BY merchant
        ORDER BY total_transactions DESC
        LIMIT :limit
    """), {"start": start, "end": end, "months": months, "limit": limit}).fetchall()
    return {
        "data": [
            {
                "merchant": r.merchant,
                "total_transactions": int(r.total_transactions or 0),
                "avg_per_month": float(r.avg_per_month or 0.0),
                "total_amount": float(r.total_amount or 0.0),
            } for r in rows
        ],
        "date_range": {"start_date": str(start), "end_date": str(end), "months_count": months},
    }

@router.get("/spending-amount-by-category")
def spending_amount_by_category(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database),
):
    start, end = parse_date_range(date_from, date_to)
    months = ((end.year - start.year) * 12 + (end.month - start.month)) + 1
    rows = db.execute(text("""
        SELECT 
          c.name AS category_name,
          c.color AS category_color,
          ABS(SUM(t.amount)) AS total_amount,
          ROUND(ABS(SUM(t.amount)) / :months, 2) AS avg_per_month,
          COUNT(t.id) AS total_transactions
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE lower(t.txn_type)='expense'
          AND t.posted_date >= :start AND t.posted_date <= :end
          AND t.category_id IS NOT NULL
          AND lower(c.name) != 'rent'
        GROUP BY c.id, c.name, c.color
        ORDER BY total_amount DESC
        LIMIT :limit
    """), {"start": start, "end": end, "months": months, "limit": limit}).fetchall()
    return {
        "data": [
            {
                "category": r.category_name,
                "color": r.category_color,
                "total_amount": float(r.total_amount or 0.0),
                "avg_per_month": float(r.avg_per_month or 0.0),
                "total_transactions": int(r.total_transactions or 0),
            } for r in rows
        ],
        "date_range": {"start_date": str(start), "end_date": str(end), "months_count": months},
    }

@router.get("/spending-amount-by-merchant")
def spending_amount_by_merchant(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database),
):
    start, end = parse_date_range(date_from, date_to)
    months = ((end.year - start.year) * 12 + (end.month - start.month)) + 1
    rows = db.execute(text("""
        SELECT 
          COALESCE(NULLIF(TRIM(t.cleaned_final_merchant), ''), NULLIF(TRIM(t.merchant_raw), ''), 'Unknown') AS merchant,
          ABS(SUM(t.amount)) AS total_amount,
          ROUND(ABS(SUM(t.amount)) / :months, 2) AS avg_per_month,
          COUNT(t.id) AS total_transactions
        FROM transactions t
        WHERE lower(t.txn_type)='expense'
          AND t.posted_date >= :start AND t.posted_date <= :end
          AND COALESCE(NULLIF(TRIM(t.cleaned_final_merchant), ''), NULLIF(TRIM(t.merchant_raw), ''), 'Unknown') != 'RENT'
        GROUP BY merchant
        ORDER BY total_amount DESC
        LIMIT :limit
    """), {"start": start, "end": end, "months": months, "limit": limit}).fetchall()
    return {
        "data": [
            {
                "merchant": r.merchant,
                "total_amount": float(r.total_amount or 0.0),
                "avg_per_month": float(r.avg_per_month or 0.0),
                "total_transactions": int(r.total_transactions or 0),
            } for r in rows
        ],
        "date_range": {"start_date": str(start), "end_date": str(end), "months_count": months},
    }