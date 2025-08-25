"""Category model for transaction categorization."""
from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from .base import BaseModel


class Category(BaseModel):
    """Represents a transaction category."""
    
    __tablename__ = "categories"
    
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("categories.id"))
    color = Column(String(7))  # Hex color code
    
    # Relationships  
    parent = relationship("Category", remote_side="Category.id", backref="children")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name})>"
    
    @property
    def full_path(self) -> str:
        """Get the full category path (e.g., 'Food > Dining Out')."""
        if self.parent:
            return f"{self.parent.full_path} > {self.name}"
        return self.name
