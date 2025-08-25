"""Service for transaction normalization and merchant mapping."""
import re
import hashlib
import unicodedata
from typing import Optional, Tuple, Dict, Any
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from ..models.transaction import Transaction
from ..models.merchant_rule import MerchantRule, RuleType
from ..models.account import Account


class MappingService:
    """Service for normalizing merchants and applying mapping rules."""
    
    # Generic merchant patterns that should prioritize description-based matching
    GENERIC_MERCHANT_PATTERNS = {
        "retail transaction", "service", "service transaction",
        "online payments by stripe", "restaurant transaction", "restaurant",
        "healthcare", "b2b wholesale", "other", "pos", "payment",
        "transfer", "interac", "credit card", "debit", "card"
    }
    
    def __init__(self, db: Session):
        self.db = db
    
    def _normalize_merchant_variants(self, text: str) -> str:
        """Normalize merchant variants to canonical forms using regex patterns."""
        import re
        
        # Define patterns with their canonical forms
        MERCHANT_PATTERNS = [
            # Longo's / Longos - must come before general patterns
            (r"LONGO'?S( MLS)?[\s#0-9]*", "longos"),
            
            # Amazon variants
            (r"AMAZON(\.COM|\.CA)?( PAYMENTS| MKTPLACE| PRIME| DIGITAL)?[\sA-Z0-9-]*", "amazon"),
            (r"AMZN( MKTP| MKTPLACE)?[\sA-Z0-9-]*", "amazon"),
            
            # Uber Eats (specific first)
            (r"UBER\s*EATS[\sA-Z0-9/-]*", "uber eats"),
            
            # Other Uber variants
            (r"UBER( RIDES| TRIP| TECHNOLOGIES| CANADA| BV)?[\sA-Z0-9/-]*", "uber"),
            
            # Tim Hortons
            (r"TIM HORTON'?S?[\s#0-9]*", "tim hortons"),
            
            # Dollarama
            (r"DOLLAR(AMA)?[\s#0-9]*", "dollarama"),
            
            # Netflix
            (r"NETFLIX[\s.A-Z0-9-]*", "netflix"),
            
            # Rexall
            (r"REXALL( PHARMACY)?[\s#0-9]*", "rexall"),
            
            # Farm Boy
            (r"FARM BOY[\s#0-9]*", "farm boy"),
            
            # Kitchen Market
            (r"KITCHEN MARKET[\s#0-9]*", "kitchen market"),
            
            # Nature's Emporium
            (r"NATURE'?S EMPORIUM[\s#0-9]*", "natures emporium"),
            
            # McDonald's
            (r"MC ?DONALD'?S?[\s#0-9]*", "mcdonalds"),
            
            # Starbucks
            (r"STARBUCKS?[\s#0-9]*", "starbucks"),
            (r"SBUX[\s#0-9]*", "starbucks"),
            
            # Walmart
            (r"WAL ?MART( SUPERCENTER| STORE)?[\s#0-9]*", "walmart"),
            
            # Canadian Tire
            (r"(CANADIAN TIRE|CDN TIRE|CT )[\s#0-9]*", "canadian tire"),
            
            # Metro
            (r"METRO( ONTARIO| INC| STORE)?[\s#0-9]*", "metro"),
            
            # Loblaws
            (r"(LOBLAWS?|REAL CANADIAN SUPERSTORE|SUPERSTORE)[\s#0-9]*", "loblaws"),
            
            # Shoppers Drug Mart
            (r"(SHOPPERS( DRUG MART)?|SDM)[\s#0-9]*", "shoppers drug mart"),
            
            # Telecom
            (r"(ROGERS|BELL|TELUS|FIDO)( COMMUNICATIONS| WIRELESS| MOBILITY| CABLE| CANADA)?[\s#0-9]*", None),
        ]
        
        # Apply patterns
        text_upper = text.upper()
        for pattern, replacement in MERCHANT_PATTERNS:
            if re.search(pattern, text_upper):
                if replacement:
                    return replacement
                # For telecom, return the base company name
                match = re.search(r"(ROGERS|BELL|TELUS|FIDO)", text_upper)
                if match:
                    return match.group(1).lower()
        
        
        return text
    
    def normalize_merchant(self, merchant_raw: Optional[str], description_raw: Optional[str]) -> Optional[str]:
        """Normalize merchant name for consistent mapping.
        
        Args:
            merchant_raw: Raw merchant name from transaction
            description_raw: Raw description from transaction
            
        Returns:
            Normalized merchant name or None
        """
        # Use merchant_raw if available, otherwise description_raw
        text = merchant_raw or description_raw
        if not text:
            return None
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove accents and normalize unicode (with error handling)
        try:
            text = unicodedata.normalize('NFD', text)
            text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
        except (UnicodeError, ValueError) as e:
            # Fallback: skip Unicode normalization if it fails
            print(f"[WARNING] Unicode normalization failed for text: {repr(text[:50])}, error: {e}", flush=True)
            # Continue without Unicode normalization
        
        # Apply merchant variant normalization patterns first
        text = self._normalize_merchant_variants(text)
        
        # Remove common patterns
        patterns_to_remove = [
            r'\*+',  # Asterisks
            r'#\d+',  # Reference numbers
            r'\b\d{2}/\d{2}\b',  # Dates
            r'\b\d{4}\b',  # 4-digit numbers (years, card numbers)
            r'\bpayment\b',  # Payment keywords
            r'\bthank you\b',
            r'\bmerci\b',
            r'\bpos\b',
            r'\bdebit\b',
            r'\bcredit\b',
            r'\btransfer\b',
            r'\bvirement\b',
            r'\binterac\b',
        ]
        
        for pattern in patterns_to_remove:
            text = re.sub(pattern, ' ', text, flags=re.IGNORECASE)
        
        # Remove punctuation and special characters
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove trailing digits and city codes (e.g., "walmart 123 toronto on")
        text = re.sub(r'\s+\d+\s*$', '', text)
        text = re.sub(r'\s+[a-z]{2}\s*$', '', text)  # Province/state codes
        
        # Collapse multiple spaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        return text if text else None
    
    def normalize_description(self, description_raw: Optional[str]) -> Optional[str]:
        """Normalize description for consistent mapping.
        
        Args:
            description_raw: Raw description from transaction
            
        Returns:
            Normalized description or None
        """
        if not description_raw:
            return None
        
        # Use the same normalization logic as merchant
        text = description_raw.lower()
        
        # Remove accents and normalize unicode (with error handling)
        try:
            text = unicodedata.normalize('NFD', text)
            text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
        except (UnicodeError, ValueError) as e:
            # Fallback: skip Unicode normalization if it fails
            print(f"[WARNING] Unicode normalization failed for text: {repr(text[:50])}, error: {e}", flush=True)
            # Continue without Unicode normalization
        
        # Remove common patterns (same as merchant)
        patterns_to_remove = [
            r'\*+',  # Asterisks
            r'#\d+',  # Reference numbers
            r'\b\d{2}/\d{2}\b',  # Dates
            r'\b\d{4}\b',  # 4-digit numbers (years, card numbers)
            r'\bpayment\b',  # Payment keywords
            r'\bthank you\b',
            r'\bmerci\b',
            r'\bpos\b',
            r'\bdebit\b',
            r'\bcredit\b',
            r'\btransfer\b',
            r'\bvirement\b',
            r'\binterac\b',
        ]
        
        for pattern in patterns_to_remove:
            text = re.sub(pattern, ' ', text, flags=re.IGNORECASE)
        
        # Remove punctuation and special characters
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Remove trailing digits and city codes
        text = re.sub(r'\s+\d+\s*$', '', text)
        text = re.sub(r'\s+[a-z]{2}\s*$', '', text)  # Province/state codes
        
        # Collapse multiple spaces
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text if text else None
    
    def normalize_text(self, text: Optional[str]) -> Optional[str]:
        """General text normalization (alias for normalize_description)."""
        return self.normalize_description(text)
    
    def is_generic_merchant(self, merchant_norm: Optional[str]) -> bool:
        """Check if a merchant name is generic and should prioritize description matching."""
        if not merchant_norm:
            return True
        
        merchant_lower = merchant_norm.lower()
        return any(pattern in merchant_lower for pattern in self.GENERIC_MERCHANT_PATTERNS)
    
    def generate_transaction_hash(self, account_id: int, posted_date: str, amount: Decimal, 
                                merchant_norm: Optional[str], description_raw: Optional[str]) -> str:
        """Generate a hash for transaction deduplication.
        
        Args:
            account_id: Account ID
            posted_date: Posted date
            amount: Transaction amount
            merchant_norm: Normalized merchant name
            description_raw: Raw description
            
        Returns:
            SHA256 hash for deduplication
        """
        # Use normalized merchant or raw description for hash
        identifier = merchant_norm or description_raw or ""
        hash_input = f"{account_id}|{posted_date}|{amount:.2f}|{identifier}"
        return hashlib.sha256(hash_input.encode()).hexdigest()
    
    def apply_rules_to_transaction(self, merchant_norm: str, description_norm: str = None) -> Tuple[Optional[int], Optional[int]]:
        """Apply mapping rules to resolve category and subcategory.
        
        Args:
            merchant_norm: Normalized merchant name
            description_norm: Normalized description
            
        Returns:
            Tuple of (category_id, subcategory_id) or (None, None)
        """
        if not merchant_norm:
            return None, None
        
        # Get rules ordered by priority (EXACT > CONTAINS > REGEX), then by priority field
        rules = self.db.query(MerchantRule).order_by(
            MerchantRule.rule_type == RuleType.EXACT.value,
            MerchantRule.rule_type == RuleType.CONTAINS.value,
            MerchantRule.rule_type == RuleType.REGEX.value,
            MerchantRule.priority.desc()
        ).all()
        
        for rule in rules:
            if self._matches_rule_with_fields(merchant_norm, description_norm, rule):
                return rule.category_id, rule.subcategory_id
        
        return None, None
    
    def _matches_rule_with_fields(self, merchant_norm: str, description_norm: str, rule: MerchantRule) -> bool:
        """Check if transaction matches a rule based on the rule's field type.
        
        Args:
            merchant_norm: Normalized merchant name
            description_norm: Normalized description
            rule: Rule to check
            
        Returns:
            True if transaction matches rule
        """
        from ..models.merchant_rule import RuleFields
        
        # Helper function to check pattern match
        def matches_pattern(text: str, pattern: str, rule_type) -> bool:
            if not text or not pattern:
                return False
            
            text_lower = text.lower()
            pattern_lower = pattern.lower()
            
            if rule_type == RuleType.EXACT:
                return text_lower == pattern_lower
            elif rule_type == RuleType.CONTAINS:
                return pattern_lower in text_lower
            elif rule_type == RuleType.REGEX:
                try:
                    return bool(re.search(pattern_lower, text_lower))
                except re.error:
                    return False
            return False
        
        # Check based on rule fields
        if hasattr(rule, 'fields') and rule.fields:
            if rule.fields == RuleFields.MERCHANT:
                return matches_pattern(merchant_norm, rule.pattern, rule.rule_type)
            elif rule.fields == RuleFields.DESCRIPTION:
                return matches_pattern(description_norm, rule.desc_pattern, rule.rule_type)
            elif rule.fields == RuleFields.PAIR:
                merchant_match = matches_pattern(merchant_norm, rule.pattern, rule.rule_type)
                desc_match = matches_pattern(description_norm, rule.desc_pattern, rule.rule_type)
                return merchant_match and desc_match
        
        # Fallback for old rules without fields - match on merchant only
        return matches_pattern(merchant_norm, rule.pattern, rule.rule_type)
    
    def normalize_unmapped_transactions(self, since_date: Optional[str] = None) -> int:
        """Normalize merchant names for transactions that haven't been normalized.
        
        Args:
            since_date: Only process transactions after this date (YYYY-MM-DD)
            
        Returns:
            Number of transactions normalized
        """
        query = self.db.query(Transaction).filter(
            or_(
                Transaction.merchant_norm.is_(None),
                Transaction.merchant_norm == ""
            )
        )
        
        if since_date:
            query = query.filter(Transaction.posted_date >= since_date)
        
        transactions = query.all()
        updated_count = 0
        
        for transaction in transactions:
            merchant_norm = self.normalize_merchant(
                transaction.merchant_raw, 
                transaction.description_raw
            )
            
            if merchant_norm and merchant_norm != transaction.merchant_norm:
                transaction.merchant_norm = merchant_norm
                updated_count += 1
        
        if updated_count > 0:
            self.db.commit()
        
        return updated_count
    
    def normalize_all_descriptions(self) -> Dict[str, int]:
        """Normalize description_norm for all transactions that have null values.
        
        Returns:
            Dictionary with update counts
        """
        # Update transactions with null description_norm
        query = self.db.query(Transaction).filter(
            Transaction.description_norm.is_(None)
        )
        
        transactions = query.all()
        updated_count = 0
        
        for transaction in transactions:
            description_norm = self.normalize_description(transaction.description_raw)
            transaction.description_norm = description_norm
            updated_count += 1
        
        if updated_count > 0:
            self.db.commit()
        
        return {"updated_count": updated_count}
    
    def apply_rules_to_unmapped(self, since_date: Optional[str] = None) -> Dict[str, Any]:
        """Apply mapping rules to unmapped transactions.
        
        Args:
            since_date: Only process transactions after this date (YYYY-MM-DD)
            
        Returns:
            Dictionary with application results
        """
        # First normalize any unnormalized transactions
        normalized_count = self.normalize_unmapped_transactions(since_date)
        
        # Find transactions without category mapping
        query = self.db.query(Transaction).filter(
            and_(
                Transaction.merchant_norm.isnot(None),
                Transaction.merchant_norm != "",
                Transaction.category_id.is_(None)
            )
        )
        
        if since_date:
            query = query.filter(Transaction.posted_date >= since_date)
        
        transactions = query.all()
        mapped_count = 0
        updated_transactions = []
        
        for transaction in transactions:
            category_id, subcategory_id = self.apply_rules_to_transaction(
                transaction.merchant_norm, 
                transaction.description_norm
            )
            
            if category_id:
                transaction.category_id = category_id
                if subcategory_id:
                    transaction.subcategory_id = subcategory_id
                mapped_count += 1
                updated_transactions.append(transaction.id)
        
        if mapped_count > 0:
            self.db.commit()
        
        return {
            "normalized_count": normalized_count,
            "mapped_count": mapped_count,
            "updated_transactions": updated_transactions
        }
    
    def apply_rule_to_history(self, rule_id: int) -> Dict[str, Any]:
        """Apply a specific rule to all historical transactions.
        
        Args:
            rule_id: ID of the rule to apply
            
        Returns:
            Dictionary with application results
        """
        rule = self.db.query(MerchantRule).filter(MerchantRule.id == rule_id).first()
        if not rule:
            return {"error": "Rule not found", "updated_count": 0}
        
        # Find transactions that match this rule pattern but don't have the category
        query = self.db.query(Transaction).filter(
            and_(
                Transaction.merchant_norm.isnot(None),
                Transaction.merchant_norm != "",
                or_(
                    Transaction.category_id.is_(None),
                    Transaction.category_id != rule.category_id
                )
            )
        )
        
        transactions = query.all()
        updated_count = 0
        updated_transactions = []
        
        for transaction in transactions:
            if self._matches_rule_with_fields(transaction.merchant_norm, transaction.description_norm, rule):
                transaction.category_id = rule.category_id
                if rule.subcategory_id:
                    transaction.subcategory_id = rule.subcategory_id
                updated_count += 1
                updated_transactions.append(transaction.id)
        
        if updated_count > 0:
            self.db.commit()
        
        return {
            "updated_count": updated_count,
            "updated_transactions": updated_transactions,
            "rule_id": rule_id
        }
    
    def get_unmapped_merchants(self, limit: int = 100) -> list:
        """Get summary of unmapped merchants for the mapping studio.
        
        Args:
            limit: Maximum number of merchants to return
            
        Returns:
            List of unmapped merchant summaries
        """
        query = self.db.query(
            Transaction.merchant_norm,
            func.count(Transaction.id).label('count'),
            func.sum(func.abs(Transaction.amount)).label('total_amount'),
            func.min(Transaction.posted_date).label('first_seen'),
            func.max(Transaction.posted_date).label('last_seen')
        ).filter(
            and_(
                Transaction.merchant_norm.isnot(None),
                Transaction.merchant_norm != "",
                Transaction.category_id.is_(None)
            )
        ).group_by(
            Transaction.merchant_norm
        ).order_by(
            func.count(Transaction.id).desc()
        ).limit(limit)
        
        results = []
        for row in query.all():
            results.append({
                "merchant_norm": row.merchant_norm,
                "count": row.count,
                "total_amount": float(row.total_amount),
                "first_seen": row.first_seen,
                "last_seen": row.last_seen
            })
        
        return results















