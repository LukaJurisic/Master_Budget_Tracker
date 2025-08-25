"""Merchant mapping rules for automatic categorization."""
from sqlalchemy import Column, String, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
from enum import Enum as PyEnum
from .base import BaseModel


class RuleType(PyEnum):
    """Types of merchant matching rules."""
    EXACT = "EXACT"
    CONTAINS = "CONTAINS"
    REGEX = "REGEX"


class RuleFields(PyEnum):
    """Which fields to match against."""
    MERCHANT = "MERCHANT"        # Match against merchant_norm only
    DESCRIPTION = "DESCRIPTION"  # Match against description_norm only  
    PAIR = "PAIR"               # Match against both merchant_norm AND description_norm


class MerchantRule(BaseModel):
    """Rules for automatically categorizing transactions based on merchant."""
    
    __tablename__ = "merchant_rules"
    
    rule_type = Column(Enum(RuleType), nullable=False)
    fields = Column(Enum(RuleFields), nullable=False, default=RuleFields.MERCHANT)  # Which fields to match
    pattern = Column(String(500), nullable=False)  # The pattern to match against merchant_norm
    desc_pattern = Column(String(500), nullable=True)  # The pattern to match against description_norm (for DESCRIPTION/PAIR)
    merchant_norm = Column(String(255), nullable=False)  # The normalized merchant name to map TO
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("categories.id"), nullable=True)  # Optional subcategory
    priority = Column(Integer, default=0)  # Higher priority rules are applied first within type
    
    # Relationships
    category = relationship("Category", foreign_keys=[category_id])  # back_populates temporarily disabled
    subcategory = relationship("Category", foreign_keys=[subcategory_id])
    
    def __repr__(self):
        return f"<MerchantRule(id={self.id}, type={self.rule_type}, pattern={self.pattern})>"















