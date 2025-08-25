"""Budget model for monthly spending targets."""
from sqlalchemy import Column, String, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from .base import BaseModel


class Budget(BaseModel):
    """Represents a monthly budget for a category."""
    
    __tablename__ = "budgets"
    
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    month = Column(String(7), nullable=False)  # Format: YYYY-MM
    amount = Column(Numeric(10, 2), nullable=False)
    
    # Relationships
    category = relationship("Category")
    
    # Unique constraint: one budget per category per month
    __table_args__ = (
        UniqueConstraint('category_id', 'month', name='_budget_category_month_uc'),
    )
    
    def __repr__(self):
        return f"<Budget(id={self.id}, category_id={self.category_id}, month={self.month}, amount={self.amount})>"















