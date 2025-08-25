"""Service for importing CSV files from various banks."""
import csv
import io
import re
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from dataclasses import dataclass
from sqlalchemy.orm import Session

from ..models.account import Account
from ..models.transaction import Transaction
from ..models.institution_item import InstitutionItem
from .mapping_service import MappingService
from ..utils.account_mapping import get_source_from_account_name


@dataclass
class ColumnMapping:
    """Column mapping configuration."""
    date: str
    description: str
    amount: Optional[str] = None
    debit: Optional[str] = None
    credit: Optional[str] = None
    balance: Optional[str] = None


class BankDetector:
    """Detect bank type from CSV headers."""
    
    BANK_PATTERNS = {
        'rbc': [
            ['date', 'description', 'debit', 'credit'],
            ['transaction date', 'description', 'debit', 'credit'],
            ['account number', 'transaction date', 'cheque number', 'description 1', 'description 2', 'cad$', 'usd$']
        ],
        'scotia': [
            ['date', 'amount', 'description'],
            ['transaction date', 'amount', 'description'],
            ['date', 'description', 'funds out', 'funds in', 'balance']
        ],
        'td': [
            ['date', 'description', 'debit', 'credit', 'balance'],
            ['transaction date', 'description', 'debit', 'credit', 'balance']
        ],
        'bmo': [
            ['posted date', 'description', 'amount'],
            ['date', 'description', 'amount']
        ]
    }
    
    @classmethod
    def detect_bank(cls, headers: List[str]) -> Optional[str]:
        """Detect bank from CSV headers.
        
        Args:
            headers: List of column headers
            
        Returns:
            Bank name or None if not detected
        """
        headers_lower = [h.lower().strip() for h in headers]
        
        for bank, patterns in cls.BANK_PATTERNS.items():
            for pattern in patterns:
                if all(col in headers_lower for col in pattern):
                    return bank
        
        return None
    
    @classmethod
    def get_default_mapping(cls, bank: str, headers: List[str]) -> Optional[ColumnMapping]:
        """Get default column mapping for a detected bank.
        
        Args:
            bank: Bank name
            headers: List of column headers
            
        Returns:
            ColumnMapping or None
        """
        headers_lower = [h.lower().strip() for h in headers]
        
        if bank == 'rbc':
            return ColumnMapping(
                date=cls._find_header(headers_lower, ['date', 'transaction date']),
                description=cls._find_header(headers_lower, ['description', 'description 1']),
                debit=cls._find_header(headers_lower, ['debit', 'funds out']),
                credit=cls._find_header(headers_lower, ['credit', 'funds in'])
            )
        elif bank == 'scotia':
            return ColumnMapping(
                date=cls._find_header(headers_lower, ['date', 'transaction date']),
                description=cls._find_header(headers_lower, ['description']),
                amount=cls._find_header(headers_lower, ['amount']),
                debit=cls._find_header(headers_lower, ['funds out']),
                credit=cls._find_header(headers_lower, ['funds in'])
            )
        elif bank == 'td':
            return ColumnMapping(
                date=cls._find_header(headers_lower, ['date', 'transaction date']),
                description=cls._find_header(headers_lower, ['description']),
                debit=cls._find_header(headers_lower, ['debit']),
                credit=cls._find_header(headers_lower, ['credit'])
            )
        elif bank == 'bmo':
            return ColumnMapping(
                date=cls._find_header(headers_lower, ['posted date', 'date']),
                description=cls._find_header(headers_lower, ['description']),
                amount=cls._find_header(headers_lower, ['amount'])
            )
        
        return None
    
    @classmethod
    def _find_header(cls, headers: List[str], candidates: List[str]) -> Optional[str]:
        """Find the first matching header from candidates.
        
        Args:
            headers: Available headers
            candidates: Candidate header names
            
        Returns:
            Matching header or None
        """
        for candidate in candidates:
            if candidate in headers:
                return candidate
        return None


class CSVImporter:
    """Service for importing CSV transaction files."""
    
    def __init__(self, db: Session):
        self.db = db
        self.mapping_service = MappingService(db)
    
    def preview_csv(self, file_content: str, delimiter: str = ',', 
                   encoding: str = 'utf-8') -> Dict[str, Any]:
        """Preview CSV file and detect structure.
        
        Args:
            file_content: CSV file content as string
            delimiter: CSV delimiter
            encoding: File encoding
            
        Returns:
            Dictionary with preview information
        """
        try:
            # Parse CSV
            csv_reader = csv.reader(io.StringIO(file_content), delimiter=delimiter)
            rows = list(csv_reader)
            
            if not rows:
                raise ValueError("CSV file is empty")
            
            headers = rows[0]
            sample_rows = rows[1:6]  # First 5 data rows
            
            # Detect bank
            detected_bank = BankDetector.detect_bank(headers)
            suggested_mapping = None
            
            if detected_bank:
                suggested_mapping = BankDetector.get_default_mapping(detected_bank, headers)
            
            return {
                "headers": headers,
                "sample_rows": sample_rows,
                "total_rows": len(rows) - 1,
                "detected_bank": detected_bank,
                "suggested_mapping": suggested_mapping.__dict__ if suggested_mapping else None
            }
            
        except Exception as e:
            raise ValueError(f"Error parsing CSV: {str(e)}")
    
    def import_csv(self, file_content: str, account_id: int, column_mapping: Dict[str, str],
                  delimiter: str = ',', encoding: str = 'utf-8', 
                  skip_header: bool = True) -> Dict[str, Any]:
        """Import transactions from CSV file.
        
        Args:
            file_content: CSV file content as string
            account_id: Target account ID
            column_mapping: Column mapping configuration
            delimiter: CSV delimiter
            encoding: File encoding
            skip_header: Whether to skip the first row
            
        Returns:
            Dictionary with import results
        """
        try:
            # Validate account exists
            account = self.db.query(Account).filter(Account.id == account_id).first()
            if not account:
                raise ValueError(f"Account {account_id} not found")
            
            # Parse CSV
            csv_reader = csv.DictReader(io.StringIO(file_content), delimiter=delimiter)
            
            imported_count = 0
            skipped_count = 0
            errors = []
            
            for row_num, row in enumerate(csv_reader, start=2 if skip_header else 1):
                try:
                    transaction_data = self._parse_csv_row(row, column_mapping)
                    
                    if transaction_data:
                        # Create transaction
                        transaction = self._create_transaction_from_data(
                            account, transaction_data, row_num
                        )
                        
                        if transaction:
                            self.db.add(transaction)
                            imported_count += 1
                        else:
                            skipped_count += 1
                    else:
                        skipped_count += 1
                        
                except Exception as e:
                    errors.append({
                        "row": row_num,
                        "error": str(e)
                    })
                    skipped_count += 1
            
            # Commit all transactions
            if imported_count > 0:
                self.db.commit()
                
                # Apply normalization and mapping
                mapping_results = self.mapping_service.apply_rules_to_unmapped()
            else:
                mapping_results = {"normalized_count": 0, "mapped_count": 0}
            
            return {
                "imported_count": imported_count,
                "skipped_count": skipped_count,
                "errors": errors,
                "mapping_results": mapping_results
            }
            
        except Exception as e:
            self.db.rollback()
            raise ValueError(f"Error importing CSV: {str(e)}")
    
    def _parse_csv_row(self, row: Dict[str, str], column_mapping: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Parse a single CSV row into transaction data.
        
        Args:
            row: CSV row as dictionary
            column_mapping: Column mapping configuration
            
        Returns:
            Transaction data dictionary or None if invalid
        """
        try:
            # Extract date
            date_str = row.get(column_mapping.get('date', ''), '').strip()
            if not date_str:
                return None
            
            posted_date = self._parse_date(date_str)
            if not posted_date:
                return None
            
            # Extract description
            description = row.get(column_mapping.get('description', ''), '').strip()
            if not description:
                return None
            
            # Extract amount
            amount = self._parse_amount(row, column_mapping)
            if amount is None:
                return None
            
            return {
                "posted_date": posted_date,
                "amount": amount,
                "description_raw": description,
                "merchant_raw": None  # Will be extracted from description during normalization
            }
            
        except Exception:
            return None
    
    def _parse_date(self, date_str: str) -> Optional[date]:
        """Parse date string into date object.
        
        Args:
            date_str: Date string
            
        Returns:
            Date object or None if parsing fails
        """
        # Common date formats
        date_formats = [
            '%Y-%m-%d',
            '%m/%d/%Y',
            '%d/%m/%Y',
            '%Y/%m/%d',
            '%m-%d-%Y',
            '%d-%m-%Y',
            '%b %d, %Y',
            '%B %d, %Y',
            '%d %b %Y',
            '%d %B %Y'
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        return None
    
    def _parse_amount(self, row: Dict[str, str], column_mapping: Dict[str, str]) -> Optional[Decimal]:
        """Parse amount from CSV row.
        
        Args:
            row: CSV row data
            column_mapping: Column mapping configuration
            
        Returns:
            Decimal amount or None if parsing fails
        """
        try:
            # Check if there's a single amount column
            if column_mapping.get('amount'):
                amount_str = row.get(column_mapping['amount'], '').strip()
                return self._clean_and_parse_decimal(amount_str)
            
            # Check for separate debit/credit columns
            debit_col = column_mapping.get('debit')
            credit_col = column_mapping.get('credit')
            
            if debit_col and credit_col:
                debit_str = row.get(debit_col, '').strip()
                credit_str = row.get(credit_col, '').strip()
                
                debit_amount = self._clean_and_parse_decimal(debit_str) if debit_str else Decimal('0')
                credit_amount = self._clean_and_parse_decimal(credit_str) if credit_str else Decimal('0')
                
                # Debit is negative, credit is positive
                return credit_amount - debit_amount
            
            return None
            
        except (InvalidOperation, ValueError):
            return None
    
    def _clean_and_parse_decimal(self, amount_str: str) -> Decimal:
        """Clean and parse amount string to Decimal.
        
        Args:
            amount_str: Amount string
            
        Returns:
            Decimal amount
        """
        if not amount_str:
            return Decimal('0')
        
        # Remove currency symbols, commas, and extra spaces
        cleaned = re.sub(r'[^\d\-\.\,]', '', amount_str.strip())
        
        # Handle different decimal separators
        if ',' in cleaned and '.' in cleaned:
            # Assume comma is thousands separator
            cleaned = cleaned.replace(',', '')
        elif ',' in cleaned and cleaned.count(',') == 1 and len(cleaned.split(',')[1]) == 2:
            # Comma is decimal separator
            cleaned = cleaned.replace(',', '.')
        
        return Decimal(cleaned)
    
    def _create_transaction_from_data(self, account: Account, transaction_data: Dict[str, Any], 
                                    row_num: int) -> Optional[Transaction]:
        """Create a Transaction object from parsed data.
        
        Args:
            account: Account object
            transaction_data: Parsed transaction data
            row_num: Row number for error tracking
            
        Returns:
            Transaction object or None if duplicate
        """
        # Normalize merchant
        merchant_norm = self.mapping_service.normalize_merchant(
            transaction_data.get('merchant_raw'),
            transaction_data.get('description_raw')
        )
        
        # Generate hash for deduplication
        hash_dedupe = self.mapping_service.generate_transaction_hash(
            account.id,
            str(transaction_data['posted_date']),
            transaction_data['amount'],
            merchant_norm,
            transaction_data['description_raw']
        )
        
        # Check for existing transaction
        existing = self.db.query(Transaction).filter(
            Transaction.hash_dedupe == hash_dedupe
        ).first()
        
        if existing:
            return None  # Skip duplicate
        
        # Determine source based on account name
        source = get_source_from_account_name(account.name)
        if source == "Unknown":
            source = 'csv'  # Fallback for CSV imports
            
        return Transaction(
            account_id=account.id,
            posted_date=transaction_data['posted_date'],
            amount=transaction_data['amount'],
            currency=account.currency,
            merchant_raw=transaction_data.get('merchant_raw'),
            description_raw=transaction_data['description_raw'],
            merchant_norm=merchant_norm,
            source=source,
            hash_dedupe=hash_dedupe
        )















