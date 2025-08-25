"""Budget API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from ..models.budget import Budget
from ..models.category import Category
from ..schemas.budgets import (
    Budget as BudgetSchema,
    BudgetCreate,
    BudgetUpdate,
    MonthlyBudgetSummary
)
from .deps import get_database

router = APIRouter()


@router.get("", response_model=List[BudgetSchema])
async def get_budgets(
    month: Optional[str] = Query(None, description="Filter by month (YYYY-MM)"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    db: Session = Depends(get_database)
) -> List[BudgetSchema]:
    """Get budgets with optional filtering.
    
    Args:
        month: Filter by month (YYYY-MM format)
        category_id: Filter by category ID
        
    Returns:
        List of budgets
    """
    try:
        query = db.query(Budget).join(Category)
        
        if month:
            query = query.filter(Budget.month == month)
        if category_id:
            query = query.filter(Budget.category_id == category_id)
        
        budgets = query.order_by(Budget.month.desc(), Category.name).all()
        return budgets
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=BudgetSchema)
async def create_budget(
    budget_data: BudgetCreate,
    db: Session = Depends(get_database)
) -> BudgetSchema:
    """Create a new budget.
    
    Args:
        budget_data: Budget creation data
        
    Returns:
        Created budget
    """
    try:
        # Check if budget already exists for this category and month
        existing = db.query(Budget).filter(
            and_(
                Budget.category_id == budget_data.category_id,
                Budget.month == budget_data.month
            )
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Budget already exists for category {budget_data.category_id} in {budget_data.month}"
            )
        
        # Verify category exists
        category = db.query(Category).filter(Category.id == budget_data.category_id).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        budget = Budget(**budget_data.dict())
        db.add(budget)
        db.commit()
        db.refresh(budget)
        
        return budget
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{budget_id}", response_model=BudgetSchema)
async def update_budget(
    budget_id: int,
    budget_data: BudgetUpdate,
    db: Session = Depends(get_database)
) -> BudgetSchema:
    """Update a budget.
    
    Args:
        budget_id: Budget ID
        budget_data: Budget update data
        
    Returns:
        Updated budget
    """
    try:
        budget = db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        
        # Update fields
        if budget_data.amount is not None:
            budget.amount = budget_data.amount
        
        db.commit()
        db.refresh(budget)
        
        return budget
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{budget_id}")
async def delete_budget(
    budget_id: int,
    db: Session = Depends(get_database)
) -> dict:
    """Delete a budget.
    
    Args:
        budget_id: Budget ID
        
    Returns:
        Success message
    """
    try:
        budget = db.query(Budget).filter(Budget.id == budget_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        
        db.delete(budget)
        db.commit()
        
        return {"message": "Budget deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{month}", response_model=MonthlyBudgetSummary)
async def get_monthly_summary(
    month: str,
    db: Session = Depends(get_database)
) -> MonthlyBudgetSummary:
    """Get budget summary for a specific month.
    
    Args:
        month: Month in YYYY-MM format
        
    Returns:
        Monthly budget summary
    """
    try:
        from ..api.routes_summary import _get_budget_vs_actual
        from datetime import datetime
        
        # Parse month
        year, month_num = map(int, month.split("-"))
        month_start = datetime(year, month_num, 1).date()
        
        # Calculate month end
        if month_num == 12:
            month_end = datetime(year + 1, 1, 1).date()
        else:
            month_end = datetime(year, month_num + 1, 1).date()
        
        # Get budget vs actual data
        budget_data = _get_budget_vs_actual(db, month, month_start, month_end)
        
        return MonthlyBudgetSummary(
            month=month,
            budgets=budget_data["budget_items"],
            total_budget=budget_data["total_budget"],
            total_actual=budget_data["total_actual"],
            total_variance=budget_data["total_variance"]
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))















