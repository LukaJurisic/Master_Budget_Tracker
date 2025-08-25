"""Merchant name cleaning utilities implementing Excel logic."""
import re
from typing import Optional


# Generic merchants that should use description instead of merchant_raw
GENERIC_MERCHANTS = {
    "OTHER",
    "SERVICE", 
    "SERVICE TRANSACTION",
    "T E TRANSACTION",
    "STRIPE",
    "ONLINE PAYMENTS BY STRIPE",
    "RETAIL",
    "RETAIL TRANSACTION",
    "RESTAURANT",
    "RESTAURANT TRANSACTION",
    "HEALTHCARE",
    "SERVICES PROFESSIONAL",
    "B2B WHOLESALE"
}


def normalize_merchant_name(merchant: str) -> str:
    """Normalize merchant name by removing common suffixes and variations."""
    if not merchant:
        return merchant
        
    # Convert to uppercase for consistent processing
    merchant = merchant.upper().strip()
    
    # Remove commas and extra spaces
    merchant = re.sub(r',', '', merchant)
    merchant = re.sub(r'\s+', ' ', merchant)
    
    # Remove common location/branch indicators
    merchant = re.sub(r'\s+#?\d{3,6}$', '', merchant)  # Remove trailing numbers like #1234, 1234
    merchant = re.sub(r'\s+\d{3,6}$', '', merchant)    # Remove trailing numbers
    
    # Remove common suffixes
    suffixes_to_remove = [
        r'\s+INC\.?$',
        r'\s+LLC\.?$', 
        r'\s+LTD\.?$',
        r'\s+CORP\.?$',
        r'\s+CO\.?$',
        r'\s+COMPANY$',
        r'\s+TORONTO.*$',      # Remove city suffixes
        r'\s+MONTREAL.*$',
        r'\s+VANCOUVER.*$',
        r'\s+ON$',            # Province codes
        r'\s+QC$',
        r'\s+BC$',
        r'\s+CA$',            # Country code
    ]
    
    for suffix in suffixes_to_remove:
        merchant = re.sub(suffix, '', merchant)
    
    # Specific merchant consolidations
    merchant_mappings = {
        # Tim Hortons variations
        r'TIM HORTONS.*': 'TIM HORTONS',
        r'TIM HORTON.*': 'TIM HORTONS',
        
        # McDonald's variations
        r'MCDONALDS.*': 'MCDONALDS',
        r'MCDONALD.*': 'MCDONALDS',
        
        # Starbucks variations
        r'STARBUCKS.*': 'STARBUCKS',
        
        # Subway variations
        r'SUBWAY.*': 'SUBWAY',
        
        # Second Cup variations
        r'SECOND CUP.*': 'SECOND CUP',
        r'LES CAFES SECOND CUP.*': 'SECOND CUP',
        
        # A&W variations
        r'A&W.*': 'A&W',
        
        # 7-Eleven variations
        r'7-ELEVEN.*': '7-ELEVEN',
        
        # Pizza chains
        r'PIZZA PIZZA.*': 'PIZZA PIZZA',
        r'DOMINOS.*': 'DOMINOS',
        
        # Chipotle variations
        r'CHIPOTLE.*': 'CHIPOTLE',
        
        # Popeyes variations  
        r'POPEYES.*': 'POPEYES',
        
        # MOS MOS Coffee variations
        r'MOS MOS.*': 'MOS MOS COFFEE',
        r'MOSMOS.*': 'MOS MOS COFFEE',
        
        # Generic retail/restaurant patterns
        r'FPOS (.+?)(?:\s+TORON|\s+MONTR|\s+VANCOU|\s+\d).*': r'\1',  # Remove FPOS prefix and location
        r'SQ \*(.+)': r'\1',  # Remove Square payment prefix
        
        # Common payment processors - extract actual merchant
        r'CHECKOUT\.COM.*': 'CHECKOUT.COM PAYMENT',      # Keep as generic for description lookup
    }
    
    # Apply merchant mappings
    for pattern, replacement in merchant_mappings.items():
        if re.match(pattern, merchant):
            merchant = re.sub(pattern, replacement, merchant)
            break
    
    return merchant.strip()


def clean_final_merchant(merchant_raw: Optional[str], description_raw: Optional[str]) -> Optional[str]:
    """
    Clean merchant name using Excel logic.
    
    If merchant_raw is in GENERIC_MERCHANTS, use description_raw instead.
    Otherwise, use normalized merchant_raw.
    
    Args:
        merchant_raw: Raw merchant name from transaction
        description_raw: Raw description from transaction
        
    Returns:
        Cleaned final merchant name for analysis
    """
    if not merchant_raw and not description_raw:
        return None
    
    # Normalize inputs
    merchant_normalized = (merchant_raw or '').upper().strip()
    description_normalized = (description_raw or '').upper().strip()
    
    # Check if merchant is generic - if so, use description
    if merchant_normalized in GENERIC_MERCHANTS:
        if description_normalized:
            # Clean the description and use it as the merchant
            return normalize_merchant_name(description_normalized)
        else:
            # Fallback to generic merchant name if no description
            return merchant_normalized
    
    # For non-generic merchants, normalize the merchant name
    if merchant_raw:
        return normalize_merchant_name(merchant_raw)
    
    # Fallback to description if no merchant_raw
    if description_raw:
        return normalize_merchant_name(description_raw)
    
    return None


def populate_cleaned_final_merchant(session, batch_size: int = 1000) -> int:
    """
    Populate the cleaned_final_merchant column for all transactions.
    
    Args:
        session: SQLAlchemy session
        batch_size: Number of transactions to process per batch
        
    Returns:
        Number of transactions updated
    """
    from bt_app.models.transaction import Transaction
    
    # Get count of transactions to update
    total_count = session.query(Transaction).filter(
        Transaction.cleaned_final_merchant.is_(None)
    ).count()
    
    if total_count == 0:
        return 0
    
    print(f"Updating {total_count} transactions with cleaned merchant names...")
    
    updated_count = 0
    offset = 0
    
    while True:
        # Get next batch of transactions
        transactions = session.query(Transaction).filter(
            Transaction.cleaned_final_merchant.is_(None)
        ).offset(offset).limit(batch_size).all()
        
        if not transactions:
            break
        
        # Update each transaction in the batch
        for txn in transactions:
            cleaned_merchant = clean_final_merchant(txn.merchant_raw, txn.description_raw)
            txn.cleaned_final_merchant = cleaned_merchant
            updated_count += 1
        
        # Commit the batch
        session.commit()
        print(f"Updated {min(updated_count, total_count)} / {total_count} transactions...")
        
        offset += batch_size
    
    print(f"Successfully updated {updated_count} transactions")
    return updated_count