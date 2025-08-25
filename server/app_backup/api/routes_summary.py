"""Summary and dashboard API routes."""
from typing import Dict, Any, List, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, desc

from ..models.transaction import Transaction
from ..models.budget import Budget
from ..models.category import Category
from ..models.account import Account
from ..services.plaid_service import PlaidService
from ..services.mapping_service import MappingService
from .deps import get_database
from .routes_summary_income import get_income_summary

router = APIRouter()


@router.get("")
async def get_summary(
    month: Optional[str] = Query(None, description="Month in YYYY-MM format"),
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Get dashboard summary data.
    
    Args:
        month: Target month for budget vs actual (defaults to current month)
        
    Returns:
        Summary data for dashboard
    """
    try:
        # Default to current month if not specified
        if not month:
            month = datetime.now().strftime("%Y-%m")
        
        # Parse month
        year, month_num = map(int, month.split("-"))
        month_start = date(year, month_num, 1)
        
        # Calculate month end
        if month_num == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month_num + 1, 1) - timedelta(days=1)
        
        # Get monthly totals for the last 12 months
        monthly_totals = _get_monthly_totals(db)
        
        # Get budget vs actual for selected month
        budget_vs_actual = _get_budget_vs_actual(db, month, month_start, month_end)
        
        # Get top categories for selected month
        top_categories = _get_top_categories(db, month_start, month_end)
        
        # Get top merchants for selected month
        top_merchants = _get_top_merchants(db, month_start, month_end)
        
        # Get unmapped transaction count (expenses only)
        unmapped_count = db.query(Transaction).filter(
            and_(
                Transaction.category_id.is_(None),
                Transaction.merchant_norm.isnot(None),
                Transaction.merchant_norm != "",
                Transaction.txn_type == "expense"
            )
        ).count()
        
        # Get account summaries
        account_summaries = _get_account_summaries(db, month_start, month_end)
        
        # Get income summary for selected month
        income_summary = get_income_summary(db, month_start, month_end)
        
        return {
            "month": month,
            "monthly_totals": monthly_totals,
            "budget_vs_actual": budget_vs_actual,
            "top_categories": top_categories,
            "top_merchants": top_merchants,
            "unmapped_count": unmapped_count,
            "account_summaries": account_summaries,
            "income_summary": income_summary
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh")
async def refresh_data(
    db: Session = Depends(get_database)
) -> Dict[str, Any]:
    """Refresh all data: sync Plaid transactions and apply mappings.
    
    Returns:
        Refresh results
    """
    try:
        # Sync Plaid transactions
        plaid_service = PlaidService(db)
        sync_results = plaid_service.sync_all_items()
        
        # Apply normalization and mapping
        mapping_service = MappingService(db)
        # First normalize all descriptions
        description_results = mapping_service.normalize_all_descriptions()
        # Then apply rules to unmapped transactions
        mapping_results = mapping_service.apply_rules_to_unmapped()
        
        return {
            "sync_results": sync_results,
            "description_results": description_results,
            "mapping_results": mapping_results,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_monthly_totals(db: Session, months: int = 12) -> List[Dict[str, Any]]:
    """Get monthly spending totals for the last N months.
    
    Args:
        db: Database session
        months: Number of months to include
        
    Returns:
        List of monthly totals
    """
    # Calculate date range
    end_date = date.today()
    start_date = date(end_date.year, end_date.month, 1) - timedelta(days=30 * (months - 1))
    
    # Query monthly totals separately for expenses and income
    expense_query = db.query(
        extract('year', Transaction.posted_date).label('year'),
        extract('month', Transaction.posted_date).label('month'),
        func.sum(func.abs(Transaction.amount)).label('total')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.txn_type == 'expense'
        )
    ).group_by(
        extract('year', Transaction.posted_date),
        extract('month', Transaction.posted_date)
    ).all()
    
    income_query = db.query(
        extract('year', Transaction.posted_date).label('year'),
        extract('month', Transaction.posted_date).label('month'),
        func.sum(Transaction.amount).label('total')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.txn_type == 'income'
        )
    ).group_by(
        extract('year', Transaction.posted_date),
        extract('month', Transaction.posted_date)
    ).all()
    
    # Combine results
    totals = {}
    for row in expense_query:
        key = f"{int(row.year)}-{int(row.month):02d}"
        totals[key] = {"spending": float(row.total or 0), "income": 0}
    
    for row in income_query:
        key = f"{int(row.year)}-{int(row.month):02d}"
        if key not in totals:
            totals[key] = {"spending": 0, "income": 0}
        totals[key]["income"] = float(row.total or 0)
    
    results = []
    for month in sorted(totals.keys()):
        results.append({
            "month": month,
            "total_spending": totals[month]["spending"],
            "total_income": totals[month]["income"],
            "net_savings": totals[month]["income"] - totals[month]["spending"]
        })
    
    return results


def _get_budget_vs_actual(db: Session, month: str, month_start: date, month_end: date) -> Dict[str, Any]:
    """Get budget vs actual for a specific month.
    
    Args:
        db: Database session
        month: Month string (YYYY-MM)
        month_start: Start of month
        month_end: End of month
        
    Returns:
        Budget vs actual summary
    """
    # Get budgets for the month
    budgets = db.query(Budget, Category).join(
        Category, Budget.category_id == Category.id
    ).filter(
        Budget.month == month
    ).all()
    
    # Get actual spending by category for the month
    actual_spending = db.query(
        Transaction.category_id,
        func.sum(func.abs(Transaction.amount)).label('actual_amount')
    ).filter(
        and_(
            Transaction.posted_date >= month_start,
            Transaction.posted_date <= month_end,
            Transaction.amount < 0,  # Only expenses
            Transaction.category_id.isnot(None)
        )
    ).group_by(Transaction.category_id).all()
    
    # Convert to dictionary
    actual_dict = {row.category_id: float(row.actual_amount) for row in actual_spending}
    
    # Build budget vs actual summary
    budget_items = []
    total_budget = Decimal('0')
    total_actual = Decimal('0')
    
    for budget, category in budgets:
        actual = Decimal(str(actual_dict.get(budget.category_id, 0)))
        variance = actual - budget.amount
        variance_percent = float((variance / budget.amount) * 100) if budget.amount > 0 else 0
        
        budget_items.append({
            "category": {
                "id": category.id,
                "name": category.name,
                "color": category.color
            },
            "budget_amount": float(budget.amount),
            "actual_amount": float(actual),
            "variance": float(variance),
            "variance_percent": variance_percent,
            "is_over_budget": actual > budget.amount
        })
        
        total_budget += budget.amount
        total_actual += actual
    
    total_variance = total_actual - total_budget
    
    return {
        "month": month,
        "budget_items": budget_items,
        "total_budget": float(total_budget),
        "total_actual": float(total_actual),
        "total_variance": float(total_variance),
        "total_variance_percent": float((total_variance / total_budget) * 100) if total_budget > 0 else 0
    }


def _get_top_categories(db: Session, start_date: date, end_date: date, limit: int = 10) -> List[Dict[str, Any]]:
    """Get top spending categories for a date range.
    
    Args:
        db: Database session
        start_date: Start date
        end_date: End date
        limit: Number of categories to return
        
    Returns:
        List of top categories
    """
    query = db.query(
        Category.id,
        Category.name,
        Category.color,
        func.sum(func.abs(Transaction.amount)).label('total_amount'),
        func.count(Transaction.id).label('transaction_count')
    ).select_from(Category).join(Transaction, Category.id == Transaction.category_id).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.amount < 0  # Only expenses
        )
    ).group_by(
        Category.id, Category.name, Category.color
    ).order_by(
        desc(func.sum(func.abs(Transaction.amount)))
    ).limit(limit).all()
    
    results = []
    for row in query:
        results.append({
            "category": {
                "id": row.id,
                "name": row.name,
                "color": row.color
            },
            "total_amount": float(row.total_amount),
            "transaction_count": row.transaction_count
        })
    
    return results


def _get_top_merchants(db: Session, start_date: date, end_date: date, limit: int = 10) -> List[Dict[str, Any]]:
    """Get top merchants for a date range.
    
    Args:
        db: Database session
        start_date: Start date
        end_date: End date
        limit: Number of merchants to return
        
    Returns:
        List of top merchants
    """
    query = db.query(
        Transaction.merchant_norm,
        func.sum(func.abs(Transaction.amount)).label('total_amount'),
        func.count(Transaction.id).label('transaction_count')
    ).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date,
            Transaction.amount < 0,  # Only expenses
            Transaction.merchant_norm.isnot(None),
            Transaction.merchant_norm != ""
        )
    ).group_by(
        Transaction.merchant_norm
    ).order_by(
        desc(func.sum(func.abs(Transaction.amount)))
    ).limit(limit).all()
    
    results = []
    for row in query:
        results.append({
            "merchant_norm": row.merchant_norm,
            "total_amount": float(row.total_amount),
            "transaction_count": row.transaction_count
        })
    
    return results


def _get_account_summaries(db: Session, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Get account summaries for a date range.
    
    Args:
        db: Database session
        start_date: Start date
        end_date: End date
        
    Returns:
        List of account summaries
    """
    query = db.query(
        Account.id,
        Account.name,
        Account.mask,
        Account.account_type,
        func.sum(func.abs(Transaction.amount)).label('total_amount'),
        func.count(Transaction.id).label('transaction_count')
    ).select_from(Account).join(Transaction, Account.id == Transaction.account_id).filter(
        and_(
            Transaction.posted_date >= start_date,
            Transaction.posted_date <= end_date
        )
    ).group_by(
        Account.id, Account.name, Account.mask, Account.account_type
    ).order_by(Account.name).all()
    
    results = []
    for row in query:
        results.append({
            "account": {
                "id": row.id,
                "name": row.name,
                "mask": row.mask,
                "account_type": row.account_type
            },
            "total_amount": float(row.total_amount),
            "transaction_count": row.transaction_count
        })
    
    return results















