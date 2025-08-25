"""Tests for merchant normalization."""
import pytest
from app.services.mapping_service import MappingService
from unittest.mock import Mock


def test_normalize_merchant():
    """Test merchant name normalization."""
    db_mock = Mock()
    service = MappingService(db_mock)
    
    # Test basic normalization
    assert service.normalize_merchant("WALMART SUPERCENTER #123", None) == "walmart supercenter"
    assert service.normalize_merchant("Tim Hortons #4567 Toronto ON", None) == "tim hortons"
    assert service.normalize_merchant("McDonald's Restaurant", None) == "mcdonalds restaurant"
    
    # Test with special characters and numbers
    assert service.normalize_merchant("COSTCO WHOLESALE #456", None) == "costco wholesale"
    assert service.normalize_merchant("7-ELEVEN STORE #12345", None) == "eleven store"
    
    # Test with description fallback
    assert service.normalize_merchant(None, "PURCHASE AT STARBUCKS COFFEE") == "purchase at starbucks coffee"
    
    # Test empty/None inputs
    assert service.normalize_merchant(None, None) is None
    assert service.normalize_merchant("", "") is None


def test_generate_transaction_hash():
    """Test transaction hash generation."""
    db_mock = Mock()
    service = MappingService(db_mock)
    
    # Test consistent hashing
    hash1 = service.generate_transaction_hash(1, "2024-01-01", -50.00, "walmart", "Walmart purchase")
    hash2 = service.generate_transaction_hash(1, "2024-01-01", -50.00, "walmart", "Walmart purchase")
    assert hash1 == hash2
    
    # Test different inputs produce different hashes
    hash3 = service.generate_transaction_hash(1, "2024-01-01", -51.00, "walmart", "Walmart purchase")
    assert hash1 != hash3


def test_merchant_normalization_edge_cases():
    """Test edge cases in merchant normalization."""
    db_mock = Mock()
    service = MappingService(db_mock)
    
    # Test Unicode and accents
    assert service.normalize_merchant("Café Starbüçks", None) == "cafe starbucks"
    
    # Test multiple spaces
    assert service.normalize_merchant("   MULTIPLE    SPACES   ", None) == "multiple spaces"
    
    # Test all punctuation
    assert service.normalize_merchant("!@#$%^&*()", None) == ""
    
    # Test only numbers
    assert service.normalize_merchant("12345", None) == ""

















