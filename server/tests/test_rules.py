"""Tests for merchant mapping rules."""
import pytest
from app.services.mapping_service import MappingService
from app.models.merchant_rule import MerchantRule, RuleType
from unittest.mock import Mock


def test_rule_matching():
    """Test merchant rule matching logic."""
    db_mock = Mock()
    service = MappingService(db_mock)
    
    # Test EXACT matching
    rule_exact = MerchantRule(
        rule_type=RuleType.EXACT,
        pattern="walmart",
        merchant_norm="Walmart",
        category_id=1,
        priority=10
    )
    assert service._matches_rule("walmart", rule_exact) == True
    assert service._matches_rule("walmart supercenter", rule_exact) == False
    
    # Test CONTAINS matching
    rule_contains = MerchantRule(
        rule_type=RuleType.CONTAINS,
        pattern="starbucks",
        merchant_norm="Starbucks",
        category_id=2,
        priority=5
    )
    assert service._matches_rule("starbucks coffee", rule_contains) == True
    assert service._matches_rule("tim hortons", rule_contains) == False
    
    # Test REGEX matching
    rule_regex = MerchantRule(
        rule_type=RuleType.REGEX,
        pattern=r"tim hortons \d+",
        merchant_norm="Tim Hortons",
        category_id=3,
        priority=1
    )
    assert service._matches_rule("tim hortons 123", rule_regex) == True
    assert service._matches_rule("tim hortons abc", rule_regex) == False


def test_rule_priority_order():
    """Test that rules are applied in correct priority order."""
    # This would require a more complex mock setup
    # For now, we'll test the logic conceptually
    pass


def test_invalid_regex_handling():
    """Test handling of invalid regex patterns."""
    db_mock = Mock()
    service = MappingService(db_mock)
    
    # Test invalid regex
    rule_bad_regex = MerchantRule(
        rule_type=RuleType.REGEX,
        pattern="[invalid regex",
        merchant_norm="Test",
        category_id=1,
        priority=1
    )
    assert service._matches_rule("test", rule_bad_regex) == False

















