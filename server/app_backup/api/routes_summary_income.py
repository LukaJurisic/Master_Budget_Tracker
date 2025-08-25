"""Income summary helper for dashboard."""
from typing import Dict, Any
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc

from ..models.transaction import Transaction


def get_income_summary(db: Session, start_date: date, end_date: date) -> Dict[str, Any]:
    """Get income summary for a date range.
    
    Args:
        db: Database session
        start_date: Start date
        end_date: End date
        
    Returns:
        Income summary
    """
    # Get total income
    total_income = db.query(
        func.sum(Transaction.amount).label('total')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.txn_type == 'income'
        )
    ).scalar() or 0
    
    # Get income by source
    income_by_source = db.query(
        Transaction.merchant_norm,
        func.sum(Transaction.amount).label('total'),
        func.count(Transaction.id).label('count')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.txn_type == 'income'
        )
    ).group_by(
        Transaction.merchant_norm
    ).order_by(
        desc(func.sum(Transaction.amount))
    ).limit(10).all()
    
    # Get total expenses for net calculation
    total_expenses = db.query(
        func.sum(func.abs(Transaction.amount)).label('total')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.txn_type == 'expense'
        )
    ).scalar() or 0
    
    return {
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "net_savings": float(total_income) - float(total_expenses),
        "income_by_source": [
            {
                "source": row.merchant_norm or "Unknown",
                "total": float(row.total),
                "count": row.count
            }
            for row in income_by_source
        ]
    }