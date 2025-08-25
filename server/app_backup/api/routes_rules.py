"""Merchant rule API routes."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..models.merchant_rule import MerchantRule
from ..schemas.rules import (
    MerchantRule as MerchantRuleSchema,
    MerchantRuleCreate,
    MerchantRuleUpdate,
    RuleApplicationResult
)
from ..services.mapping_service import MappingService
from .deps import get_database

router = APIRouter()


@router.get("", response_model=List[MerchantRuleSchema])
async def get_rules(
    db: Session = Depends(get_database)
) -> List[MerchantRuleSchema]:
    """Get all merchant mapping rules.
    
    Returns:
        List of merchant rules
    """
    try:
        rules = db.query(MerchantRule).order_by(
            MerchantRule.rule_type,
            MerchantRule.priority.desc(),
            MerchantRule.created_at
        ).all()
        return rules
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=RuleApplicationResult)
async def create_rule(
    rule_data: MerchantRuleCreate,
    db: Session = Depends(get_database)
) -> RuleApplicationResult:
    """Create a new merchant mapping rule and apply it to history.
    
    Args:
        rule_data: Rule creation data
        
    Returns:
        Rule application results
    """
    try:
        # Create the rule
        rule = MerchantRule(**rule_data.dict())
        db.add(rule)
        db.commit()
        db.refresh(rule)
        
        # Apply rule to historical transactions
        mapping_service = MappingService(db)
        result = mapping_service.apply_rule_to_history(rule.id)
        
        return RuleApplicationResult(
            updated_count=result["updated_count"],
            rule_id=rule.id,
            affected_transactions=result.get("updated_transactions", [])
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{rule_id}", response_model=RuleApplicationResult)
async def update_rule(
    rule_id: int,
    rule_data: MerchantRuleUpdate,
    db: Session = Depends(get_database)
) -> RuleApplicationResult:
    """Update a merchant mapping rule and re-apply to history.
    
    Args:
        rule_id: Rule ID
        rule_data: Rule update data
        
    Returns:
        Rule application results
    """
    try:
        rule = db.query(MerchantRule).filter(MerchantRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        # Update rule fields
        update_dict = rule_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(rule, field, value)
        
        db.commit()
        
        # Re-apply rule to historical transactions
        mapping_service = MappingService(db)
        result = mapping_service.apply_rule_to_history(rule.id)
        
        return RuleApplicationResult(
            updated_count=result["updated_count"],
            rule_id=rule.id,
            affected_transactions=result.get("updated_transactions", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: Session = Depends(get_database)
) -> dict:
    """Delete a merchant mapping rule.
    
    Args:
        rule_id: Rule ID
        
    Returns:
        Success message
    """
    try:
        rule = db.query(MerchantRule).filter(MerchantRule.id == rule_id).first()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        
        db.delete(rule)
        db.commit()
        
        return {"message": "Rule deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{rule_id}/apply", response_model=RuleApplicationResult)
async def apply_rule_to_history(
    rule_id: int,
    db: Session = Depends(get_database)
) -> RuleApplicationResult:
    """Apply a specific rule to all historical transactions.
    
    Args:
        rule_id: Rule ID
        
    Returns:
        Rule application results
    """
    try:
        mapping_service = MappingService(db)
        result = mapping_service.apply_rule_to_history(rule_id)
        
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        
        return RuleApplicationResult(
            updated_count=result["updated_count"],
            rule_id=rule_id,
            affected_transactions=result.get("updated_transactions", [])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-assign")
async def bulk_assign_rules(
    rules_data: List[dict],
    db: Session = Depends(get_database)
):
    """Create multiple rules from bulk assignment and apply them.
    
    Args:
        rules_data: List of rule creation data
        
    Returns:
        Bulk assignment results
    """
    try:
        from ..models.merchant_rule import RuleFields, RuleType
        
        created_rules = []
        total_affected = 0
        
        for rule_data in rules_data:
            # Create the rule
            rule = MerchantRule(
                rule_type=RuleType(rule_data.get("rule_type", "EXACT")),
                fields=RuleFields(rule_data.get("fields", "PAIR")),
                pattern=rule_data["merchant_pattern"],
                desc_pattern=rule_data.get("desc_pattern"),
                merchant_norm=rule_data["merchant_pattern"],  # Use the same value as pattern for normalization
                category_id=rule_data["category_id"],
                subcategory_id=rule_data.get("subcategory_id"),
                priority=rule_data.get("priority", 100)
            )
            db.add(rule)
            db.flush()  # Get the ID
            created_rules.append(rule.id)
        
        db.commit()
        
        # Apply all rules to unmapped transactions
        mapping_service = MappingService(db)
        apply_result = mapping_service.apply_rules_to_unmapped()
        total_affected = apply_result.get("mapped_count", 0)
        
        return {
            "created": len(created_rules),
            "affected": total_affected,
            "rule_ids": created_rules
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))















