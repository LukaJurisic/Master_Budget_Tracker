"""Account name to source mapping utility."""
from typing import Optional


def get_source_from_account_name(account_name: str) -> str:
    """
    Map account name to source based on the provided mapping rules.
    
    Args:
        account_name: The account name to map
        
    Returns:
        The corresponding source string
    """
    if not account_name:
        return "Unknown"
    
    # Convert to lowercase for case-insensitive matching
    name_lower = account_name.lower()
    
    # LUKA JUIRISIC accounts → Amex
    if "luka juri" in name_lower or "luka jurisi" in name_lower:
        return "Amex"
    
    # RBC accounts → RBC
    if any(rbc_term in name_lower for rbc_term in [
        "rbc staff banking",
        "rbc day to day savings", 
        "rbc rewards",
        "credit line"
    ]):
        return "RBC"
    
    # Scotia accounts → Scotia  
    if any(scotia_term in name_lower for scotia_term in [
        "money master",
        "moneymaster", 
        "scene+ visa card",
        "scene visa",
        "preferred package"
    ]):
        return "Scotia"
    
    # Default fallback - preserve existing source if it doesn't match patterns
    return "Unknown"


def normalize_account_name(account_name: str) -> str:
    """
    Normalize account name for consistent matching.
    
    Args:
        account_name: The raw account name
        
    Returns:
        Normalized account name
    """
    if not account_name:
        return ""
    
    # Basic normalization
    normalized = account_name.strip().lower()
    
    # Handle common variations
    normalized = normalized.replace("mastercard", "master card")
    normalized = normalized.replace("visa card", "visa")
    
    return normalized


def validate_account_mapping() -> dict:
    """
    Test function to validate the mapping works correctly.
    
    Returns:
        Dictionary with test results
    """
    test_cases = [
        ("LUKA JURISIC -73003", "Amex"),
        ("Credit Line", "RBC"), 
        ("credit line 0001", "RBC"),
        ("RBC Staff Banking", "RBC"),
        ("RBC Day to Day Savings", "RBC"),
        ("RBC Rewards+ Visa", "RBC"),
        ("Money Master", "Scotia"),
        ("MoneyMaster", "Scotia"),
        ("Scene+ Visa Card", "Scotia"),
        ("Scene+ Visa card", "Scotia"),
        ("Preferred Package", "Scotia"),
        ("Unknown Account", "Unknown")
    ]
    
    results = {}
    for account_name, expected_source in test_cases:
        actual_source = get_source_from_account_name(account_name)
        results[account_name] = {
            "expected": expected_source,
            "actual": actual_source,
            "passed": actual_source == expected_source
        }
    
    return results


def get_source_from_account_id(db, account_id: int) -> str:
    """
    Get the source for a transaction based on the account ID.
    
    Args:
        db: Database session
        account_id: The account ID to look up
        
    Returns:
        The corresponding source string, defaults to "Unknown" if account not found
    """
    try:
        # Use direct SQL to avoid SQLAlchemy relationship issues
        from sqlalchemy import text
        
        result = db.execute(text("SELECT name FROM accounts WHERE id = :account_id"), 
                          {"account_id": account_id}).fetchone()
        if result:
            return get_source_from_account_name(result.name)
        return "Unknown"
    except Exception as e:
        print(f"Error in get_source_from_account_id: {e}")
        return "Unknown"