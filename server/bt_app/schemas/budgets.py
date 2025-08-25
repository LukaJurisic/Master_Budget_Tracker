"""Budget-related schemas."""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, validator
from .common import BaseSchema, TimestampSchema, Category


class BudgetBase(BaseSchema):
    """Base budget schema."""
    
    category_id: int
    month: str  # Format: YYYY-MM
    amount: Decimal
    
    @validator('month')
    def validate_month_format(cls, v):
        """Validate month format."""
        try:
            year, month = v.split('-')
            if len(year) != 4 or len(month) != 2:
                raise ValueError
            int(year)
            month_int = int(month)
            if not 1 <= month_int <= 12:
                raise ValueError
        except (ValueError, IndexError):
            raise ValueError('Month must be in YYYY-MM format')
        return v


class Budget(BudgetBase, TimestampSchema):
    """Budget schema with ID."""
    
    id: int
    category: Optional[Category] = None


class BudgetCreate(BudgetBase):
    """Budget creation schema."""
    pass


class BudgetUpdate(BaseSchema):
    """Budget update schema."""
    
    amount: Optional[Decimal] = None


class BudgetSummary(BaseSchema):
    """Budget vs actual summary."""
    
    category: Category
    budget_amount: Decimal
    actual_amount: Decimal
    variance: Decimal
    variance_percent: float
    
    @property
    def is_over_budget(self) -> bool:
        """Check if over budget."""
        return self.actual_amount > self.budget_amount


class MonthlyBudgetSummary(BaseSchema):
    """Summary for a specific month."""
    
    month: str
    budgets: List[BudgetSummary]
    total_budget: Decimal
    total_actual: Decimal
    total_variance: Decimal










