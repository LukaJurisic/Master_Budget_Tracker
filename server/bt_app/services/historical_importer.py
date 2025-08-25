"""Historical Excel importer for expenses and income."""
import hashlib
import io
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
from decimal import Decimal
import pandas as pd
import re
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from ..models.transaction import Transaction
from ..models.category import Category
from ..models.merchant_rule import MerchantRule, RuleType, RuleFields
from ..models.account import Account
from ..services.mapping_service import MappingService
from ..utils.account_mapping import get_source_from_account_id

# Sentinel value to distinguish between "not provided" vs "empty list"
_UNSET = object()


class HistoricalImporter:
    """Import historical transactions from Excel files."""
    
    def __init__(self, db: Session):
        self.db = db
        # Skip mapping service for now to avoid SQLAlchemy relationship issues
        # self.mapping_service = MappingService(db)
    
    def _exists_hash(self, h: str) -> bool:
        """Check if a transaction with this hash already exists."""
        return self.db.query(Transaction.id)\
                      .filter(Transaction.hash_dedupe == h)\
                      .first() is not None
    
    def _safe_add(self, obj) -> bool:
        """Safely add a transaction using nested transactions to isolate rollbacks."""
        try:
            with self.db.begin_nested():   # creates a SAVEPOINT
                self.db.add(obj)
                self.db.flush()
            return True
        except IntegrityError:
            # This rollback only releases the SAVEPOINT, not the outer tx
            self.db.expunge(obj)           # detach the object from session
            return False
    
    def _get_or_create_income_parent(self) -> Category:
        parent = self.db.query(Category).filter_by(name="Income", parent_id=None).first()
        if not parent:
            parent = Category(name="Income", parent_id=None)
            self.db.add(parent)
            self.db.flush()  # ensure we have an id
        return parent

    def _get_or_create_income_subcat(self, parent: Category, name: str, cache: dict) -> int:
        key = name.lower().strip()
        if not key:
            return None
        if key in cache:
            return cache[key]
        sub = self.db.query(Category).filter_by(parent_id=parent.id, name=name.strip()).first()
        if not sub:
            sub = Category(name=name.strip(), parent_id=parent.id)
            self.db.add(sub)
            self.db.flush()
            print(f"[IMPORT][INCOME] created subcategory: {name.strip()} (id={sub.id})")
        cache[key] = sub.id
        return sub.id
    
    def _resolve_income_mapping(self, income_parent: Category, income_cache: dict,
                                source_text: str, category_text: str) -> tuple[int, int]:
        """
        Decide (category_id, subcategory_id) for an income row. Always returns the Income parent
        as category_id; subcategory_id may be None if nothing matches.
        """
        mapped_cat_id = income_parent.id
        mapped_sub_id = None

        # 1) Prefer explicit category text from the sheet ("Primary Job", "Family Income", ...)
        if category_text and category_text.strip():
            c = category_text.strip()
            mapped_sub_id = self._get_or_create_income_subcat(income_parent, c, income_cache)

        # 2) If none yet, fall back to source heuristics
        if not mapped_sub_id and source_text:
            s = source_text.lower().strip()

            def sub(name: str):
                return self._get_or_create_income_subcat(income_parent, name, income_cache)

            if "climate action incentive" in s or "gst" in s:
                mapped_sub_id = sub("Government")
            elif "insurance" in s:
                mapped_sub_id = sub("Insurance")
            elif "primary job" in s and "bonus" in s:
                mapped_sub_id = sub("Primary Job - Bonus")
            elif "primary job" in s and "refund" in s:
                mapped_sub_id = sub("Primary Job - Refund")
            elif "primary job" in s:
                mapped_sub_id = sub("Primary Job")
            elif "tax refund" in s:
                mapped_sub_id = sub("Tax Refund")
            elif "vigo cad" in s or "vigosoft" in s:
                mapped_sub_id = sub("Family Income")
            elif "ws interest" in s or "interest" in s:
                mapped_sub_id = sub("Interest")

        print(f"[IMPORT][INCOME] resolve -> parent={income_parent.id}, sub={mapped_sub_id}, "
              f"category_text='{category_text}', source='{source_text}'")
        return mapped_cat_id, mapped_sub_id
    
    def load_historical_excel_bytes(
        self, 
        file_bytes: bytes, 
        expense_sheets: Optional[List[str]] = _UNSET,
        income_sheets: Optional[List[str]] = _UNSET,
        autodetect: bool = True
    ) -> Dict[str, int]:
        """Load historical data from Excel file bytes.
        
        Args:
            file_bytes: Excel file content as bytes
            expense_sheets: List of expense sheet names to process
            income_sheets: List of income sheet names to process
            
        Returns:
            Dictionary with counts: {inserted, skipped, income, expenses}
        """
        # Read Excel from bytes
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes))
        
        # Debug logging
        print(f"Importer received expense_sheets: {expense_sheets} (type: {type(expense_sheets)})")
        print(f"Importer received income_sheets: {income_sheets} (type: {type(income_sheets)})")
        print(f"_UNSET sentinel: {_UNSET}")
        print(f"expense_sheets is _UNSET: {expense_sheets is _UNSET}")
        print(f"income_sheets is _UNSET: {income_sheets is _UNSET}")
        
        # Auto-detect sheets only if not provided AND autodetect is allowed
        if expense_sheets is _UNSET and autodetect:
            print("Auto-detecting expense sheets...")
            expense_sheets = []
            for sheet_name in excel_file.sheet_names:
                sheet_lower = sheet_name.lower()
                if any(x in sheet_lower for x in ['expense', 'transaction']):
                    expense_sheets.append(sheet_name)
                    
        if income_sheets is _UNSET and autodetect:
            print("Auto-detecting income sheets...")
            income_sheets = []
            for sheet_name in excel_file.sheet_names:
                sheet_lower = sheet_name.lower()
                if 'income' in sheet_lower:
                    income_sheets.append(sheet_name)
        
        # If user passed explicit arrays, respect them strictly (even if empty)
        if expense_sheets is _UNSET:
            expense_sheets = []    # explicit "none"
        if income_sheets is _UNSET:
            income_sheets = []     # explicit "none"
        
        print(f"Final expense_sheets to process: {expense_sheets}")
        print(f"Final income_sheets to process: {income_sheets}")
                    
        results = {
            "inserted": 0,
            "skipped": 0,
            "income": 0,
            "expenses": 0
        }
        
        # HARD GUARD: if the list is empty, do nothing for that kind
        print(f"[IMPORT] Processing sheets -> expense_sheets: {expense_sheets}, income_sheets: {income_sheets}, autodetect: {autodetect}")
        
        # Process expense sheets - HARD GUARD: only if list has content
        for sheet in (expense_sheets if len(expense_sheets) > 0 else []):
            try:
                print(f"Processing expense sheet: {sheet}")
                df = pd.read_excel(excel_file, sheet_name=sheet)
                if df.empty:
                    print(f"Warning: Expense sheet '{sheet}' is empty")
                    continue
                counts = self._process_expense_sheet(df)
                results["inserted"] += counts["inserted"]
                results["skipped"] += counts["skipped"]
                results["expenses"] += counts["inserted"]
                print(f"Processed expense sheet '{sheet}': {counts}")
            except Exception as e:
                print(f"Error processing expense sheet '{sheet}': {e}")
                continue
            
        # Process income sheets - HARD GUARD: only if list has content
        for sheet in (income_sheets if len(income_sheets) > 0 else []):
            try:
                print(f"Processing income sheet: {sheet}")
                df = pd.read_excel(excel_file, sheet_name=sheet)
                if df.empty:
                    print(f"Warning: Income sheet '{sheet}' is empty")
                    continue
                counts = self._process_income_sheet(df)
                results["inserted"] += counts["inserted"]
                results["skipped"] += counts["skipped"]
                results["income"] += counts["inserted"]
                print(f"Processed income sheet '{sheet}': {counts}")
            except Exception as e:
                print(f"Error processing income sheet '{sheet}': {e}")
                continue
            
        # Commit all transactions at once
        try:
            print(f"About to commit {results['inserted']} transactions...")
            # Force flush before commit to ensure all transactions are in the session
            self.db.flush()
            print(f"Flush completed. Committing...")
            self.db.commit()
            print(f"Import completed successfully: {results}")
            
            # Verify commit worked by checking transaction count
            from sqlalchemy import text
            count_result = self.db.execute(text("SELECT COUNT(*) FROM transactions WHERE txn_type = 'expense'"))
            expense_count = count_result.scalar()
            print(f"Database now contains {expense_count} expense transactions")
            
        except Exception as e:
            print(f"Error during final commit: {e}")
            print(f"Note: Chunked commits may have already persisted some data")
            # Don't reset counts since chunked commits may have succeeded
        
        return results
    
    def load_historical_excel(self, path: str) -> Dict[str, int]:
        """Load historical data from Excel file.
        
        Args:
            path: Path to Excel file
            
        Returns:
            Dictionary with counts: {inserted, skipped, income, expenses}
        """
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {path}")
            
        # Read all sheets
        excel_file = pd.ExcelFile(path)
        
        # Find relevant sheets (case-insensitive)
        expense_sheets = []
        income_sheets = []
        
        for sheet_name in excel_file.sheet_names:
            sheet_lower = sheet_name.lower()
            if any(x in sheet_lower for x in ['expense', 'transaction']):
                expense_sheets.append(sheet_name)
            elif 'income' in sheet_lower:
                income_sheets.append(sheet_name)
                
        results = {
            "inserted": 0,
            "skipped": 0,
            "income": 0,
            "expenses": 0
        }
        
        # Process expense sheets
        for sheet in expense_sheets:
            df = pd.read_excel(path, sheet_name=sheet)
            counts = self._process_expense_sheet(df)
            results["inserted"] += counts["inserted"]
            results["skipped"] += counts["skipped"]
            results["expenses"] += counts["inserted"]
            
        # Process income sheets
        for sheet in income_sheets:
            df = pd.read_excel(path, sheet_name=sheet)
            counts = self._process_income_sheet(df)
            results["inserted"] += counts["inserted"]
            results["skipped"] += counts["skipped"]
            results["income"] += counts["inserted"]
            
        self.db.commit()
        return results
        
    def _get_or_create_expense_parent(self, name: str, cache: dict) -> Category:
        """Get or create expense parent category."""
        key = name.lower().strip()
        if key in cache:
            return cache[key]
        
        cat = self.db.query(Category).filter_by(name=name.strip(), parent_id=None).first()
        if not cat:
            cat = Category(name=name.strip(), parent_id=None)
            self.db.add(cat)
            self.db.flush()  # ensure we have an id
            print(f"[IMPORT][EXP] created parent category: {name.strip()} (id={cat.id})")
        
        cache[key] = cat
        return cat
    
    def _get_or_create_expense_subcat(self, parent: Category, name: str, cache: dict) -> int:
        """Get or create expense subcategory."""
        key = f"{parent.id}:{name.lower().strip()}"
        if key in cache:
            return cache[key]
        
        sub = self.db.query(Category).filter_by(parent_id=parent.id, name=name.strip()).first()
        if not sub:
            sub = Category(name=name.strip(), parent_id=parent.id)
            self.db.add(sub)
            self.db.flush()
            print(f"[IMPORT][EXP] created subcategory: {name.strip()} under {parent.name} (id={sub.id})")
        
        cache[key] = sub.id
        return sub.id
    
    def _resolve_expense_mapping(self, l1_text: str, l2_text: str, merchant_text: str, 
                                description_text: str, parent_cache: dict, sub_cache: dict) -> tuple[int, int]:
        """Resolve expense category mapping from Excel data."""
        category_id = None
        subcategory_id = None
        
        if l1_text and l1_text.strip():
            # Get/create parent category
            parent = self._get_or_create_expense_parent(l1_text.strip(), parent_cache)
            category_id = parent.id
            
            # Get/create subcategory if provided
            if l2_text and l2_text.strip():
                subcategory_id = self._get_or_create_expense_subcat(parent, l2_text.strip(), sub_cache)
        
        print(f"[IMPORT][EXP] resolve -> parent={category_id}, sub={subcategory_id}, "
              f"L1='{l1_text}', L2='{l2_text}', merchant='{merchant_text}', desc='{description_text}'")
        
        return category_id, subcategory_id
    
    def _process_expense_sheet(self, df: pd.DataFrame) -> Dict[str, int]:
        """Process expense transactions from dataframe with 100% mapping from Excel."""
        counts = {"inserted": 0, "skipped": 0}
        COMMIT_EVERY = 1000
        inserted_since_commit = 0
        
        # Normalize column names
        df.columns = [str(col).strip().lower() for col in df.columns]
        
        # Bullet-proof column detection with generous synonyms
        date_col = self._find_column(df, ['date', 'posted', 'post date', 'transaction date', 'date (mm-dd-yyyy)'])
        amount_col = self._find_column(df, ['amount', '$ amount', '$amount', 'debit', 'credit', 'value', 'total'])
        merchant_col = self._find_column(df, ['merchant', 'store', 'vendor', 'name', 'store / vendor'])
        desc_col = self._find_column(df, ['description', 'memo', 'details', 'narration'])
        category_col = self._find_column(df, ['expense category', 'expense grouping', 'category', 'grouping', 'level 1'])
        subcategory_col = self._find_column(df, ['level 2', 'subcategory', 'sub category', 'level2'])
        source_col = self._find_column(df, ['source', 'fi', 'bank', 'account'])
        
        print(f"[IMPORT][EXP] Column detection:")
        print(f"  date_col: '{date_col}'")
        print(f"  amount_col: '{amount_col}'")
        print(f"  merchant_col: '{merchant_col}'")
        print(f"  category_col: '{category_col}'")
        print(f"  subcategory_col: '{subcategory_col}'")
        print(f"  Available columns: {list(df.columns)}")
        
        if not all([date_col, amount_col]):
            print(f"[IMPORT][EXP] ERROR: Missing required columns. Available: {list(df.columns)}")
            return counts
        
        # Initialize caches for category creation
        parent_cache = {}
        sub_cache = {}
        
        print(f"[IMPORT][EXP] Processing {len(df)} expense rows with Excel category mapping...")
            
        for _, row in df.iterrows():
            try:
                # Parse date
                date_val = pd.to_datetime(row[date_col]).date()
                
                # Parse amount (handle $ and commas)
                amount_str = str(row[amount_col]) if pd.notna(row[amount_col]) else "0"
                amount_str = re.sub(r'[$,]', '', amount_str)
                amount = Decimal(amount_str)
                
                # Get text fields
                merchant_raw = str(row[merchant_col]) if merchant_col and pd.notna(row[merchant_col]) else ""
                description_raw = str(row[desc_col]) if desc_col and pd.notna(row[desc_col]) else ""
                
                # Determine source from account or use Excel as fallback
                source_from_file = str(row[source_col]) if source_col and pd.notna(row[source_col]) else "Excel"
                source = get_source_from_account_id(self.db, account_id)
                if source == "Unknown":
                    source = source_from_file if source_from_file != "Excel" else "Excel"
                
                # Extract Excel category data
                l1_text = str(row[category_col]).strip() if category_col and pd.notna(row[category_col]) and str(row[category_col]).strip() != 'nan' else ""
                l2_text = str(row[subcategory_col]).strip() if subcategory_col and pd.notna(row[subcategory_col]) and str(row[subcategory_col]).strip() != 'nan' else ""
                
                # Normalize strings
                merchant_norm = merchant_raw.lower().strip() if merchant_raw else ""
                description_norm = description_raw.lower().strip() if description_raw else ""
                
                # Create hash for deduplication
                hash_input = f"{date_val}|{amount}|{merchant_norm}|{description_norm}|expense"
                hash_dedupe = hashlib.sha256(hash_input.encode()).hexdigest()
                
                # Pre-check: skip if already exists (fast lookup)
                if self._exists_hash(hash_dedupe):
                    counts["skipped"] += 1
                    continue
                
                # Get category mapping from Excel data (single resolver call)
                mapped_category_id, mapped_subcategory_id = self._resolve_expense_mapping(
                    l1_text, l2_text, merchant_raw, description_raw, parent_cache, sub_cache
                )
                
                # Create transaction with Excel-derived categories
                txn = Transaction(
                    posted_date=date_val,
                    amount=-abs(amount),  # Expenses are negative
                    merchant_raw=merchant_raw,
                    description_raw=description_raw,
                    merchant_norm=merchant_norm,
                    description_norm=description_norm,
                    source=source,
                    hash_dedupe=hash_dedupe,
                    txn_type="expense",
                    currency="CAD",
                    account_id=1,  # Use account 1 for historical imports
                    category_id=mapped_category_id,
                    subcategory_id=mapped_subcategory_id
                )
                
                # Safely add transaction using nested transaction
                if self._safe_add(txn):
                    counts["inserted"] += 1
                    inserted_since_commit += 1
                    
                    # Chunked commits for robustness
                    if inserted_since_commit >= COMMIT_EVERY:
                        self.db.commit()
                        inserted_since_commit = 0
                        print(f"[IMPORT][EXP] Chunked commit: {counts['inserted']} inserted so far")
                else:
                    counts["skipped"] += 1
                    
            except Exception as e:
                print(f"[IMPORT][EXP] Error processing row: {e}")
                counts["skipped"] += 1
                continue
        
        # Log post-commit count
        from sqlalchemy import text
        post_count = self.db.execute(text("SELECT COUNT(*) FROM transactions WHERE txn_type = 'expense'")).scalar()
        print(f"[IMPORT][EXP] post-commit count(expense)={post_count}")
        
        return counts
        
    def _process_income_sheet(self, df: pd.DataFrame) -> Dict[str, int]:
        """Process income transactions from dataframe."""
        counts = {"inserted": 0, "skipped": 0}
        COMMIT_EVERY = 1000
        inserted_since_commit = 0
        
        # Robust column detection
        cols = {c.lower().strip(): c for c in df.columns if isinstance(c, str)}
        date_col = next((cols[k] for k in cols if "date" in k), None)
        amount_col = next((cols[k] for k in cols if "amount" in k or "$ amount" in k or "$amount" in k), None)
        source_col = next((cols[k] for k in cols if "source" in k), None)
        # The one we care about for subcategory text:
        cat_text_col = next((cols[k] for k in cols if "income category" in k or k == "category"), None)

        if not date_col or not amount_col:
            print(f"[IMPORT][INCOME] Missing required columns. Found: {list(df.columns)}")
            return counts

        # Create/seed parent + cache
        income_parent = self._get_or_create_income_parent()
        income_cache = {}
        for cat in self.db.query(Category).filter_by(parent_id=income_parent.id).all():
            if cat.name:
                income_cache[cat.name.lower().strip()] = cat.id

        print(f"[IMPORT][INCOME] Processing {len(df)} rows with columns: date={date_col}, amount={amount_col}, source={source_col}, category={cat_text_col}")
            
        for _, row in df.iterrows():
            try:
                # Parse date
                date_val = pd.to_datetime(row[date_col]).date()
                
                # Parse amount
                amount_str = str(row[amount_col]) if pd.notna(row[amount_col]) else "0"
                amount_str = re.sub(r'[$,]', '', amount_str)
                amount = Decimal(amount_str)
                
                # Get text fields
                source_text = str(row[source_col]) if source_col else ""
                category_text = str(row[cat_text_col]) if cat_text_col else ""
                
                # Clean up category text
                if category_text and category_text.strip() and category_text.strip().lower() != 'nan':
                    category_text = category_text.strip()
                else:
                    category_text = ""
                
                # Create hash
                merchant_norm = (source_text or "Income").lower().strip()
                description_norm = (category_text or "").lower().strip()
                hash_input = f"{date_val}|{amount}|{merchant_norm}|{description_norm}|income"
                hash_dedupe = hashlib.sha256(hash_input.encode()).hexdigest()

                # Pre-check: skip if already exists (fast lookup)
                if self._exists_hash(hash_dedupe):
                    counts["skipped"] += 1
                    continue

                # Single resolver call - no overwrites
                mapped_category_id, mapped_subcategory_id = self._resolve_income_mapping(
                    income_parent, income_cache, source_text, category_text
                )

                # Determine source from account
                account_id = 1
                source = get_source_from_account_id(self.db, account_id)
                if source == "Unknown":
                    source = "Excel"  # Fallback for income imports

                txn = Transaction(
                    posted_date=date_val,
                    amount=amount,
                    currency="CAD",
                    merchant_raw=source_text or "Income",
                    description_raw=category_text or "",
                    merchant_norm=merchant_norm,
                    description_norm=description_norm,
                    txn_type="income",
                    account_id=account_id,
                    category_id=mapped_category_id,
                    subcategory_id=mapped_subcategory_id,
                    source=source,
                    hash_dedupe=hash_dedupe,
                )

                # Safely add transaction using nested transaction
                if self._safe_add(txn):
                    counts["inserted"] += 1
                    inserted_since_commit += 1
                    
                    # Chunked commits for robustness
                    if inserted_since_commit >= COMMIT_EVERY:
                        self.db.commit()
                        inserted_since_commit = 0
                        print(f"Chunked commit: {counts['inserted']} inserted so far")
                else:
                    counts["skipped"] += 1
            except Exception as e:
                print(f"Error processing income row: {e}")
                continue
                
        return counts
        
    def _find_column(self, df: pd.DataFrame, candidates: List[str]) -> Optional[str]:
        """Find column by trying multiple candidate names."""
        for candidate in candidates:
            for col in df.columns:
                if candidate.lower() in col.lower():
                    return col
        return None
    
    def derive_rules_from_historical_expenses(self) -> Dict[str, int]:
        """Auto-derive mapping rules from imported historical expense transactions."""
        from sqlalchemy import text
        
        # Query expense transactions with categories
        result = self.db.execute(text("""
            SELECT merchant_norm, description_norm, category_id, subcategory_id, COUNT(*) as freq
            FROM transactions 
            WHERE txn_type = 'expense' AND category_id IS NOT NULL
            GROUP BY merchant_norm, description_norm, category_id, subcategory_id
            ORDER BY freq DESC
        """)).fetchall()
        
        created_count = 0
        
        for row in result:
            merchant_norm, description_norm, category_id, subcategory_id, freq = row
            
            # Skip empty patterns
            if not merchant_norm and not description_norm:
                continue
            
            # Check if rule already exists
            existing = self.db.query(MerchantRule).filter_by(
                fields=RuleFields.PAIR,
                rule_type=RuleType.EXACT,
                pattern=merchant_norm,
                desc_pattern=description_norm,
                category_id=category_id
            ).first()
            
            if existing:
                continue
            
            # Create new rule
            rule = MerchantRule(
                fields=RuleFields.PAIR,
                rule_type=RuleType.EXACT,
                pattern=merchant_norm,
                desc_pattern=description_norm,
                category_id=category_id,
                subcategory_id=subcategory_id,
                priority=100
            )
            
            self.db.add(rule)
            created_count += 1
            
            print(f"[RULE] Created: '{merchant_norm}' + '{description_norm}' -> category {category_id} (freq={freq})")
        
        # Commit rules
        self.db.commit()
        
        print(f"[RULE] Created {created_count} mapping rules from historical expenses")
        
        return {"created": created_count}