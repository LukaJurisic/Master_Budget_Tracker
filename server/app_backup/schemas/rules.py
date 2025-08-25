"""Merchant rule schemas."""
from typing import Optional
from pydantic import BaseModel
from ..models.merchant_rule import RuleType
from .common import BaseSchema, TimestampSchema, Category


class MerchantRuleBase(BaseSchema):
    """Base merchant rule schema."""
    
    rule_type: RuleType
    pattern: str
    merchant_norm: str
    category_id: int
    priority: int = 0


class MerchantRule(MerchantRuleBase, TimestampSchema):
    """Merchant rule schema with ID."""
    
    id: int
    category: Optional[Category] = None


class MerchantRuleCreate(MerchantRuleBase):
    """Merchant rule creation schema."""
    pass


class MerchantRuleUpdate(BaseSchema):
    """Merchant rule update schema."""
    
    rule_type: Optional[RuleType] = None
    pattern: Optional[str] = None
    merchant_norm: Optional[str] = None
    category_id: Optional[int] = None
    priority: Optional[int] = None


class RuleApplicationResult(BaseSchema):
    """Result of applying rules to transactions."""
    
    updated_count: int
    rule_id: int
    affected_transactions: list[int] = []










