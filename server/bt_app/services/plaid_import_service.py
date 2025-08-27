"""Enhanced Plaid import service with staging pipeline."""
import hashlib
import json
import datetime
import logging
from datetime import date
from typing import Optional, Dict, Any, List
from decimal import Decimal
from uuid import UUID
import re
import unicodedata
import traceback
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

from plaid import ApiClient, Configuration, Environment
from plaid.api import plaid_api
from plaid.model.transactions_get_request import TransactionsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_get_request import AccountsGetRequest

from ..core.config import settings
from ..models.institution_item import InstitutionItem
from ..models.account import Account
from ..models.transaction import Transaction
from ..models.plaid_import import PlaidImport
from ..models.staging_transaction import StagingTransaction
from ..models.category import Category
from ..services.mapping_service import MappingService
from ..utils.account_mapping import get_source_from_account_name

def _safe_text(value) -> str:
    """Robust text sanitizer that ensures valid UTF-8 and never throws."""
    if value is None:
        return None
    
    # Convert to string and drop any unpaired surrogates / invalid code points
    # Ensures string is valid UTF-8 for SQLite binding
    s = str(value)
    s = s.encode("utf-8", "ignore").decode("utf-8", "ignore")
    
    # Gentle normalization (NFKC) but tolerate any weirdness
    try:
        s = unicodedata.normalize("NFKC", s)
    except Exception:
        # If Windows unicode stack complains, keep the safe-encoded string
        pass
    
    return s

def _safe_json_text(value) -> str:
    """Safe text sanitizer for JSON strings (raw_json might already be a JSON string)."""
    return _safe_text(value)

def to_jsonable(obj: Any) -> Any:
    """Recursively convert object to JSON-safe types."""
    # Check date/datetime first (higher priority)
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: to_jsonable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [to_jsonable(v) for v in obj]
    elif isinstance(obj, tuple):
        return tuple(to_jsonable(v) for v in obj)
    elif isinstance(obj, set):
        return {to_jsonable(v) for v in obj}
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, UUID):
        return str(obj)
    else:
        return obj

def _to_date(x):
    """Convert various date formats to date object - tolerant parser."""
    if not x:
        return None
    if isinstance(x, datetime.date):
        return x
    s = str(x).strip()
    # handle 'YYYY-MM-DDTHH:mm:ssZ' and similar
    if 'T' in s:
        s = s.split('T', 1)[0]
    s = s.rstrip('Z')
    return datetime.date.fromisoformat(s)

def _within_window(d: Optional[datetime.date], start: Optional[datetime.date], end: Optional[datetime.date]) -> bool:
    """Check if date is within the specified window."""
    # If a window was requested, require a real date
    if (start or end) and d is None:
        return False
    if start and d < start:
        return False
    if end and d > end:
        return False
    return True

# Default exclusion rules
DEFAULT_EXCLUSION_CATEGORIES = {
    'TRANSFER',
    'LOAN_PAYMENTS',
    'BANK_FEES_ATM_FEES'
}

DEFAULT_EXCLUSION_DETAILED = {
    'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
    'TRANSFER_CREDIT',
    'TRANSFER_DEBIT'
}

class PlaidImportService:
    """Service for managing Plaid imports with staging workflow."""
    
    def __init__(self, db: Session):
        self.db = db
        self.client = self._build_client()
        self.mapping_service = MappingService(db)
    
    def _build_client(self) -> plaid_api.PlaidApi:
        """Build Plaid API client."""
        env_map = {
            "sandbox": Environment.Sandbox,
            "development": Environment.Development,
            "production": Environment.Production,
        }
        
        configuration = Configuration(
            host=env_map.get(settings.plaid_env.lower(), Environment.Sandbox),
            api_key={"clientId": settings.plaid_client_id, "secret": settings.plaid_secret},
        )
        api_client = ApiClient(configuration)
        return plaid_api.PlaidApi(api_client)
    
    def _plaid_with_retry(self, fn, retries=3, backoff=2):
        """Retry Plaid API calls for transient errors."""
        import time
        import json
        import sys
        from fastapi import HTTPException
        from plaid.exceptions import ApiException
        
        for i in range(retries):
            try:
                return fn()
            except ApiException as e:
                error_data = {}
                if hasattr(e, 'body') and e.body:
                    try:
                        error_data = json.loads(e.body)
                    except json.JSONDecodeError:
                        pass
                
                error_code = error_data.get("error_code", "")
                error_message = error_data.get("error_message", str(e))
                
                # Retry for transient errors
                if error_code in {"INTERNAL_SERVER_ERROR", "PRODUCT_NOT_READY", "RATE_LIMIT_EXCEEDED"} and i < retries - 1:
                    wait_time = backoff * (i + 1)
                    logger.warning(f"Plaid {error_code}, retry {i+1}/{retries} in {wait_time}s")
                    time.sleep(wait_time)
                    continue
                
                # If not retryable or exhausted retries, return 502 with clean error
                logger.error(f"Plaid error {error_code}: {error_message}")
                raise HTTPException(
                    status_code=502,
                    detail={
                        "plaid_error": error_code,
                        "message": f"Bank API error: {error_message}",
                        "retry_suggested": error_code in {"INTERNAL_SERVER_ERROR", "RATE_LIMIT_EXCEEDED"}
                    }
                )
            except Exception as e:
                # For non-Plaid exceptions, raise as-is
                raise
    
    def import_transactions(
        self,
        item_id: int,
        mode: str = "sync",
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        account_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Import transactions from Plaid into staging area."""
        
        # Get institution item
        item = self.db.query(InstitutionItem).filter(InstitutionItem.id == item_id).first()
        if not item:
            raise ValueError(f"Institution item {item_id} not found")
        
        # Create import record
        plaid_import = PlaidImport(
            item_id=item_id,
            start_date=start_date,
            end_date=end_date,
            mode=mode,
            created_by="system"
        )
        self.db.add(plaid_import)
        self.db.flush()
        
        # Fetch transactions based on mode
        if mode == "get":
            transactions = self._fetch_transactions_get(
                item.access_token_encrypted,
                start_date,
                end_date,
                account_ids
            )
        else:  # sync
            sync_result = self._fetch_transactions_sync(
                item.access_token_encrypted,
                item.next_cursor,
                account_ids
            )
            transactions = sync_result["added"] + sync_result["modified"]
            
            # Update cursor
            item.next_cursor = sync_result["next_cursor"]
            
            # Handle removed transactions (soft delete)
            for removed_tx in sync_result["removed"]:
                existing = self.db.query(Transaction).filter(
                    Transaction.external_id == removed_tx["transaction_id"]
                ).first()
                if existing:
                    existing.is_deleted = True
        
        # Stage transactions
        summary = self._stage_transactions(plaid_import.id, transactions, account_ids, start_date, end_date)
        
        # Update import summary
        plaid_import.summary_json = json.dumps(to_jsonable(summary))
        self.db.commit()
        
        return {
            "import_id": plaid_import.id,
            "summary": summary,
            "start_date": str(start_date) if start_date else None,
            "end_date": str(end_date) if end_date else None,
            "mode": mode
        }
    
    def _fetch_transactions_get(
        self,
        access_token: str,
        start_date: date,
        end_date: date,
        account_ids: Optional[List[str]] = None
    ) -> List[Dict]:
        """Fetch transactions using /transactions/get endpoint with pagination."""
        from plaid.model.transactions_get_request_options import TransactionsGetRequestOptions
        from datetime import timedelta
        
        # Add grace window to capture end-of-month transactions that are purchased
        # in the target month but posted in the next month (e.g., Jul 31 purchase posted Aug 1)
        grace_days = 5  # 3-5 days is typical for transaction posting
        effective_end = end_date + timedelta(days=grace_days)
        
        print(f"[FETCH DEBUG] User window: {start_date} to {end_date}")
        print(f"[FETCH DEBUG] Plaid fetch window: {start_date} to {effective_end} (added {grace_days} day grace)")
        
        out: List[Dict] = []
        offset = 0
        count = 500  # Plaid max per page

        while True:
            opts = TransactionsGetRequestOptions(count=count, offset=offset)
            if account_ids:
                opts.account_ids = account_ids

            request = TransactionsGetRequest(
                access_token=access_token,
                start_date=start_date,
                end_date=effective_end,  # Use extended end date for Plaid fetch
                options=opts,
            )
            
            # Add logging to debug the issue
            logger.info(f"Plaid request - start: {start_date}, end: {effective_end}, accounts: {account_ids}")
            
            resp = self._plaid_with_retry(lambda: self.client.transactions_get(request))
            page = [to_jsonable(t.to_dict()) for t in resp.transactions]
            out.extend(page)
            offset += len(page)
            if offset >= (resp.total_transactions or len(page)) or not page:
                break

        print(f"[FETCH DEBUG] Fetched {len(out)} transactions from Plaid (before purchase date filtering)")
        return out
    
    def import_transactions_sync(
        self,
        item_id: int,
        account_ids: Optional[List[str]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Import transactions using sync mode with server-side filtering."""
        
        # Get institution item
        item = self.db.query(InstitutionItem).filter(InstitutionItem.id == item_id).first()
        if not item:
            raise ValueError(f"Institution item {item_id} not found")
        
        # Create import record
        plaid_import = PlaidImport(
            item_id=item_id,
            start_date=_to_date(start_date),
            end_date=_to_date(end_date),
            mode="sync",
            created_by="system"
        )
        self.db.add(plaid_import)
        self.db.flush()
        
        # Fetch all transactions with sync
        try:
            print(f"[SYNC DEBUG] Calling Plaid sync API")
            sync_result = self._fetch_transactions_sync(
                item.access_token_encrypted,
                item.next_cursor,
                None  # Don't filter by account_ids in sync API call
            )
            print(f"[SYNC DEBUG] Plaid sync completed, got {len(sync_result.get('added', []))} added transactions")
        except Exception as e:
            print(f"[SYNC ERROR] Error in _fetch_transactions_sync: {str(e)}")
            raise
        
        # Update cursor immediately
        item.next_cursor = sync_result["next_cursor"]
        
        # Server-side filtering
        added_all = sync_result["added"]
        modified_all = sync_result["modified"] 
        removed_all = sync_result["removed"]
        
        def passes_filter(tx):
            # Account filter
            if account_ids and tx.get("account_id") not in account_ids:
                return False
            
            # Date filter with tolerant parsing
            if start_date or end_date:
                tx_date = _to_date(tx.get("date") or tx.get("authorized_date"))
                if start_date and tx_date and tx_date < start_date:
                    return False
                if end_date and tx_date and tx_date > end_date:
                    return False
            
            return True
        
        # Apply filters
        added = [tx for tx in added_all if passes_filter(tx)]
        modified = [tx for tx in modified_all if passes_filter(tx)]
        
        # Stage transactions
        try:
            summary = self._stage_transactions(
                plaid_import.id, 
                added + modified, 
                None, 
                _to_date(start_date), 
                _to_date(end_date)
            )
        except Exception as e:
            print(f"[STAGING ERROR] Error in _stage_transactions: {str(e)}")
            raise
        
        # Handle removed transactions (soft delete)
        for removed_tx in removed_all:
            existing = self.db.query(Transaction).filter(
                Transaction.external_id == removed_tx["transaction_id"]
            ).first()
            if existing:
                existing.is_deleted = True
        
        # Update import summary (ensure JSON serializable)
        try:
            plaid_import.summary_json = json.dumps(to_jsonable(summary))
            print(f"[DB DEBUG] About to commit import record")
            self.db.commit()
            print(f"[DB DEBUG] Database commit successful")
        except Exception as e:
            print(f"[DB ERROR] Database commit failed: {str(e)}")
            raise
        
        result = {
            "import_id": plaid_import.id,
            "counts": summary,
            "window": {
                "mode": "sync", 
                "start": str(start_date) if start_date else None,
                "end": str(end_date) if end_date else None
            }
        }
        return to_jsonable(result)
    
    def _fetch_transactions_sync(
        self,
        access_token: str,
        cursor: Optional[str] = None,
        account_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Fetch transactions using /transactions/sync endpoint."""
        added = []
        modified = []
        removed = []
        next_cursor = cursor
        
        while True:
            request_args = {
                "access_token": access_token,
                "count": 500
            }
            
            # Only include cursor if it's not None
            if next_cursor:
                request_args["cursor"] = next_cursor
            
            if account_ids:
                request_args["options"] = {"account_ids": account_ids}
            
            request = TransactionsSyncRequest(**request_args)
            response = self._plaid_with_retry(lambda: self.client.transactions_sync(request))
            
            added.extend([to_jsonable(t.to_dict()) for t in response.added])
            modified.extend([to_jsonable(t.to_dict()) for t in response.modified])
            removed.extend([to_jsonable(r.to_dict()) for r in response.removed])
            
            next_cursor = response.next_cursor
            
            if not response.has_more:
                break
        
        return {
            "added": added,
            "modified": modified,
            "removed": removed,
            "next_cursor": next_cursor
        }
    
    def _stage_transactions(
        self,
        import_id: int,
        transactions: List[Dict],
        account_filter: Optional[List[str]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Stage transactions and determine status."""
        print(f"[STAGING DEBUG] Date filtering: start_date={start_date}, end_date={end_date}")
        summary = {
            "total": 0,
            "ready": 0,
            "needs_category": 0,
            "excluded": 0,
            "duplicate": 0,
            "superseded": 0
        }
        
        for tx_data in transactions:
            # Skip if account filtering applied
            if account_filter and tx_data["account_id"] not in account_filter:
                continue
            
            # Get or create account
            account = self._ensure_account(tx_data["account_id"])
            
            # Skip if account disabled for import
            if not account.is_enabled_for_import:
                continue
            
            # Create hash key based on actual transaction data for true duplicate detection
            tx_date = _to_date(tx_data.get("date") or tx_data.get("authorized_date"))
            merchant_name = tx_data.get("merchant_name", "")
            name = tx_data.get("name", "")
            amount = str(tx_data["amount"])
            
            # Debug hash key creation
            hash_input = f"{account.id}_{tx_date}_{merchant_name}_{name}_{amount}"
            print(f"[HASH DEBUG] Creating hash for: {hash_input}")
            
            # Use content-based hash for duplicate detection
            hash_key = hashlib.sha256(hash_input.encode()).hexdigest()
            print(f"[HASH DEBUG] Hash result: {hash_key[:16]}...")
            
            # Check for duplicates
            status = self._determine_status(tx_data, account.id, hash_key)
            
            # Get both dates: authorized_date (purchase) and date (posted)
            auth_date = _to_date(tx_data.get("authorized_date"))  # Purchase date (matches Excel)
            posted_date = tx_date  # Posted/cleared date (for reconciliation)
            
            # Use authorized date (purchase) for filtering to match Excel workflow
            # Fallback to posted date if authorized date is missing
            purchase_date = auth_date or posted_date
            
            if not purchase_date:
                # Skip transactions without any valid dates
                continue
            
            # Apply date window filter using purchase date (matches Excel)
            if not _within_window(purchase_date, start_date, end_date):
                print(f"[DATE FILTER] SKIPPING transaction outside window: {purchase_date} not in [{start_date}, {end_date}] - {tx_data.get('name', 'N/A')}")
                continue
                
            staging_tx = StagingTransaction(
                import_id=import_id,
                plaid_transaction_id=tx_data["transaction_id"],
                plaid_pending_transaction_id=tx_data.get("pending_transaction_id"),
                account_id=account.id,
                date=purchase_date,  # Store purchase date for display/sorting (matches Excel)
                authorized_date=auth_date,  # Keep original authorized date
                name=tx_data.get("name", ""),
                merchant_name=tx_data.get("merchant_name", ""),
                amount=Decimal(str(tx_data["amount"])),  # Keep original sign
                currency=tx_data.get("iso_currency_code", "USD"),
                pf_category_primary=tx_data.get("personal_finance_category", {}).get("primary"),
                pf_category_detailed=tx_data.get("personal_finance_category", {}).get("detailed"),
                status=status,
                exclude_reason=self._get_exclude_reason(tx_data) if status == "excluded" else None,
                hash_key=hash_key,
                raw_json=self._safe_serialize_tx_data(tx_data)  # Store as JSON string
            )
            
            # Apply mapping rules for all transactions except excluded
            if status not in ["excluded", "superseded"]:
                self._apply_mapping(staging_tx)
            
            try:
                self.db.add(staging_tx)
                print(f"[STAGING DEBUG] Added staging transaction {staging_tx.plaid_transaction_id}")
            except Exception as e:
                print(f"[STAGING ERROR] Failed to add staging transaction: {str(e)}")
                raise
            summary["total"] += 1
            summary[status] += 1
        
        # Handle pending->posted reconciliation
        self._reconcile_pending_posted(import_id)
        
        self.db.flush()
        return summary
    
    def _ensure_account(self, plaid_account_id: str) -> Account:
        """Get or create account."""
        account = self.db.query(Account).filter(
            Account.plaid_account_id == plaid_account_id
        ).first()
        
        if not account:
            # Get account details from Plaid
            # For now, create with basic info
            account = Account(
                institution_item_id=1,  # Would need to determine proper item
                plaid_account_id=plaid_account_id,
                name=f"Account {plaid_account_id[-4:]}",
                mask=plaid_account_id[-4:],
                currency="USD",
                is_enabled_for_import=True
            )
            self.db.add(account)
            self.db.flush()
        
        return account
    
    def _safe_serialize_tx_data(self, tx_data: Dict) -> str:
        """Safely serialize transaction data with debug logging."""
        print(f"[DEBUG TX DATE TYPE] date: {type(tx_data.get('date'))}, auth_date: {type(tx_data.get('authorized_date'))}")
        
        try:
            return json.dumps(to_jsonable(tx_data))
        except TypeError as ser_err:
            print(f"[SERIALIZATION DEBUG] Failed on tx_data: {type(tx_data)}, keys: {tx_data.keys() if isinstance(tx_data, dict) else 'non-dict'}")
            if isinstance(tx_data, dict):
                print(f"[SERIALIZATION DEBUG] Date field: {tx_data.get('date')}, type: {type(tx_data.get('date'))}")
                print(f"[SERIALIZATION DEBUG] Auth date field: {tx_data.get('authorized_date')}, type: {type(tx_data.get('authorized_date'))}")
                # Log first few keys and their types
                for k, v in list(tx_data.items())[:5]:
                    print(f"[SERIALIZATION DEBUG] {k}: {type(v)} = {repr(v)[:50]}")
            raise ser_err
    
    def _determine_status(self, tx_data: Dict, account_id: int, hash_key: str) -> str:
        """Determine transaction status."""
        # Check exclusion rules first
        if self._should_exclude(tx_data):
            return "excluded"
        
        # Check if it's replacing a pending transaction
        if not tx_data.get("pending", True) and tx_data.get("pending_transaction_id"):
            return "ready"  # Will be handled in reconciliation
        
        # For duplicate detection, check based on actual content in main table
        # A duplicate is same date, amount, and description
        tx_date = _to_date(tx_data.get("date") or tx_data.get("authorized_date"))
        amount = abs(Decimal(str(tx_data["amount"])))
        description = tx_data.get("name", "")
        
        # Normalize description for comparison
        from ..services.mapping_service import MappingService
        mapping_svc = MappingService(self.db)
        description_norm = mapping_svc.normalize_description(description)
        
        # Check for content-based duplicate in main transactions table
        existing = self.db.query(Transaction).filter(
            Transaction.posted_date == tx_date,
            Transaction.amount == amount,
            Transaction.description_norm == description_norm
        ).first()
        
        if existing:
            print(f"[DUPLICATE DEBUG] Found duplicate by content: date={tx_date}, amount={amount}, desc={description}")
            return "duplicate"
        
        return "needs_category"
    
    def _should_exclude(self, tx_data: Dict) -> bool:
        """Check if transaction should be excluded."""
        pf_category = tx_data.get("personal_finance_category", {})
        
        # Check primary category
        if pf_category.get("primary") in DEFAULT_EXCLUSION_CATEGORIES:
            return True
        
        # Check detailed category
        if pf_category.get("detailed") in DEFAULT_EXCLUSION_DETAILED:
            return True
        
        # Check for specific exclusion patterns
        name = tx_data.get("name", "").upper()
        if "PAYMENT RECEIVED - THANK YOU" in name:
            return True
        
        return False
    
    def _get_exclude_reason(self, tx_data: Dict) -> str:
        """Get exclusion reason."""
        pf_category = tx_data.get("personal_finance_category", {})
        
        if pf_category.get("primary") in DEFAULT_EXCLUSION_CATEGORIES:
            return f"category_{pf_category['primary'].lower()}"
        
        if pf_category.get("detailed") in DEFAULT_EXCLUSION_DETAILED:
            return "credit_card_payment"
        
        return "custom_rule"
    
    def _apply_mapping(self, staging_tx: StagingTransaction) -> None:
        """Apply mapping rules to suggest categories using raw exact matching first."""
        # Get the account to determine source
        account = self.db.query(Account).filter(Account.id == staging_tx.account_id).first()
        if account:
            source = get_source_from_account_name(account.name)
            if source == "Unknown":
                source = "Amex"  # Fallback for unknown accounts
        else:
            source = "Amex"  # Default fallback
        # ONLY use transaction name (what's on statement) - do NOT fall back to Plaid's merchant enrichment
        merchant_raw = staging_tx.name or ""
        description_raw = staging_tx.name or ""
        
        category_id = None
        subcategory_id = None
        
        print(f"[MAPPING DEBUG] Trying to map: merchant='{merchant_raw}', description='{description_raw}'")
        
        # 1) Exact raw match on (source + merchant + description)
        if merchant_raw and description_raw:
            hist = (
                self.db.query(Transaction.category_id, Transaction.subcategory_id)
                .filter(
                    Transaction.source == source,
                    Transaction.merchant_raw == merchant_raw,
                    Transaction.description_raw == description_raw,
                    Transaction.category_id.isnot(None)
                )
                .order_by(Transaction.posted_date.desc())
                .first()
            )
            if hist:
                category_id, subcategory_id = hist.category_id, hist.subcategory_id
                print(f"[MAPPING DEBUG] Found exact match (source+merchant+desc): category_id={category_id}")
        
        # 2) Exact raw match on (source + description) if still not found
        if not category_id and description_raw:
            hist = (
                self.db.query(Transaction.category_id, Transaction.subcategory_id)
                .filter(
                    Transaction.source == source,
                    Transaction.description_raw == description_raw,
                    Transaction.category_id.isnot(None)
                )
                .order_by(Transaction.posted_date.desc())
                .first()
            )
            if hist:
                category_id, subcategory_id = hist.category_id, hist.subcategory_id
                print(f"[MAPPING DEBUG] Found exact match (source+desc): category_id={category_id}")
        
        # 3) Exact raw match on (source + merchant) if still not found
        if not category_id and merchant_raw:
            hist = (
                self.db.query(Transaction.category_id, Transaction.subcategory_id)
                .filter(
                    Transaction.source == source,
                    Transaction.merchant_raw == merchant_raw,
                    Transaction.category_id.isnot(None)
                )
                .order_by(Transaction.posted_date.desc())
                .first()
            )
            if hist:
                category_id, subcategory_id = hist.category_id, hist.subcategory_id
                print(f"[MAPPING DEBUG] Found exact match (source+merchant): category_id={category_id}")
        
        # 4) Fallback to normalized matching as safety net
        if not category_id:
            print(f"[MAPPING DEBUG] No exact match found, trying normalized matching")
            merchant_norm = self.mapping_service.normalize_merchant(merchant_raw, description_raw)
            description_norm = self.mapping_service.normalize_description(description_raw)
            
            # Try mapping service rules
            category_id, subcategory_id = self.mapping_service.apply_rules_to_transaction(merchant_norm, description_norm)
            
            # If no rule match, fall back to normalized history search
            if not category_id:
                # First try exact match
                hist = (
                    self.db.query(Transaction.category_id, Transaction.subcategory_id)
                    .filter(Transaction.merchant_norm == merchant_norm)
                    .filter(Transaction.category_id.isnot(None))
                    .order_by(Transaction.posted_date.desc())
                    .first()
                )
                
                # If no exact match, try fuzzy matching for similar merchants
                if not hist and merchant_norm:
                    print(f"[MAPPING DEBUG] No exact match for '{merchant_norm}', trying fuzzy match...")
                    
                    # Try multiple fuzzy matching strategies
                    # 1. Historical contains staging merchant (e.g., "longos mls" contains "longos")
                    hist = (
                        self.db.query(Transaction.category_id, Transaction.subcategory_id)
                        .filter(Transaction.merchant_norm.like(f"%{merchant_norm}%"))
                        .filter(Transaction.category_id.isnot(None))
                        .order_by(Transaction.posted_date.desc())
                        .first()
                    )
                    
                    # 2. Staging merchant contains historical (e.g., "winner studio" contains "winner")
                    if not hist:
                        hist = (
                            self.db.query(Transaction.category_id, Transaction.subcategory_id)
                            .filter(Transaction.merchant_norm.like(f"{merchant_norm}%"))
                            .filter(Transaction.category_id.isnot(None))
                            .order_by(Transaction.posted_date.desc())
                            .first()
                        )
                    
                    # 3. Try matching individual words (e.g., "winner studio" should match "winners")
                    # BUT be much more restrictive - only match if word is very specific (6+ chars and not common words)
                    if not hist and len(merchant_norm.split()) > 1:
                        # Try each word in the merchant name, but be very conservative
                        common_words = {'hotel', 'restaurant', 'cafe', 'shop', 'store', 'market', 'center', 'service', 'company', 'corp', 'ltd', 'inc'}
                        for word in merchant_norm.split():
                            if len(word) >= 6 and word.lower() not in common_words:  # Stricter: 6+ chars and not common
                                hist = (
                                    self.db.query(Transaction.category_id, Transaction.subcategory_id)
                                    .filter(Transaction.merchant_norm.like(f"%{word}%"))
                                    .filter(Transaction.category_id.isnot(None))
                                    .order_by(Transaction.posted_date.desc())
                                    .first()
                                )
                                if hist:
                                    print(f"[MAPPING DEBUG] Found match using word '{word}'")
                                    break
                    
                    # 4. Try reverse word matching (historical words in staging)
                    if not hist:
                        from sqlalchemy import text
                        hist = (
                            self.db.query(Transaction.category_id, Transaction.subcategory_id)
                            .filter(text(f"'{merchant_norm}' LIKE '%' || merchant_norm || '%'"))
                            .filter(Transaction.category_id.isnot(None))
                            .order_by(Transaction.posted_date.desc())
                            .first()
                        )
                        
                if hist:
                    category_id, subcategory_id = hist.category_id, hist.subcategory_id
                    print(f"[MAPPING DEBUG] Found historical match: category_id={category_id}")
        
        # Set result
        if category_id:
            staging_tx.suggested_category_id = category_id
            staging_tx.suggested_subcategory_id = subcategory_id
            staging_tx.status = "ready"
            print(f"[MAPPING DEBUG] SUCCESS: Mapped to category_id={category_id}")
        else:
            print(f"[MAPPING DEBUG] NO MATCH: No mapping found")
    
    def _reconcile_pending_posted(self, import_id: int) -> None:
        """Reconcile pending->posted transactions."""
        # Find posted transactions with pending_transaction_id
        posted_txs = self.db.query(StagingTransaction).filter(
            and_(
                StagingTransaction.import_id == import_id,
                StagingTransaction.plaid_pending_transaction_id.isnot(None)
            )
        ).all()
        
        for posted in posted_txs:
            # Mark pending as superseded
            pending = self.db.query(StagingTransaction).filter(
                StagingTransaction.plaid_transaction_id == posted.plaid_pending_transaction_id
            ).first()
            
            if pending:
                pending.status = "superseded"
                pending.exclude_reason = "replaced_by_posted"
    
    def commit_import(self, import_id: int, row_ids: Optional[List[int]] = None, statuses: Optional[List[str]] = None) -> Dict[str, Any]:
        """Commit staged transactions to main transactions table."""
        # Get transactions to commit
        query = self.db.query(StagingTransaction).filter(
            StagingTransaction.import_id == import_id
        )
        
        if row_ids:
            # Commit specific rows by ID
            query = query.filter(StagingTransaction.id.in_(row_ids))
        else:
            # Commit by status - use provided statuses or default to ready+approved
            commit_statuses = statuses or ["ready", "approved"]
            query = query.filter(
                StagingTransaction.status.in_(commit_statuses)
            )
        
        staged_txs = query.all()
        
        summary = {
            "inserted": 0,
            "skipped_duplicates": 0,
            "excluded": 0,
            "superseded_replacements": 0
        }
        
        for staged in staged_txs:
            # SANITIZE STRINGS SAFELY (only change from original)
            merchant_name_safe = _safe_text(staged.merchant_name or "")
            name_safe = _safe_text(staged.name or "")
            
            # Check for true duplicate based on content (date, description, amount, category)
            # Use the normalized merchant/description for matching
            merchant_norm = self.mapping_service.normalize_merchant(
                merchant_name_safe,
                name_safe
            )
            description_norm = self.mapping_service.normalize_description(
                name_safe
            )
            
            # Check for duplicate by external_id (Plaid transaction ID) first
            external_id = _safe_text(staged.plaid_transaction_id)
            existing_by_id = self.db.query(Transaction).filter(
                Transaction.external_id == external_id
            ).first()
            
            if existing_by_id:
                summary["skipped_duplicates"] += 1
                continue
                
            # Also check for content-based duplicate: same date, amount, description, and category
            existing_by_content = self.db.query(Transaction).filter(
                Transaction.posted_date == staged.date,
                Transaction.amount == abs(staged.amount),
                Transaction.description_norm == description_norm,
                Transaction.category_id == staged.suggested_category_id
            ).first()
            
            if existing_by_content:
                summary["skipped_duplicates"] += 1
                continue
            
            # Use Plaid's consistent sign convention:
            # amount > 0 → outflow (money leaves account) → expense
            # amount < 0 → inflow (money enters account) → income
            from decimal import Decimal
            
            plaid_amount = float(staged.amount or 0)
            
            # Debug logging to verify sign logic
            print(f"[COMMIT DEBUG] Staging amount: {staged.amount}, plaid_amount: {plaid_amount}")
            
            if plaid_amount > 0:
                # Outflow -> expense
                txn_type = "expense"
                amount_db = -abs(plaid_amount)  # store expenses as negatives in the ledger
                print(f"[COMMIT DEBUG] Positive amount -> txn_type: {txn_type}, amount_db: {amount_db}")
            else:
                # Inflow -> income
                txn_type = "income"
                amount_db = abs(plaid_amount)   # store income as positives
                print(f"[COMMIT DEBUG] Negative amount -> txn_type: {txn_type}, amount_db: {amount_db}")
            
            # Determine source based on account
            account = self.db.query(Account).filter(Account.id == staged.account_id).first()
            if account:
                source = get_source_from_account_name(account.name)
                if source == "Unknown":
                    source = "Plaid"  # Fallback for Plaid transactions
            else:
                source = "Plaid"  # Default fallback
            
            transaction = Transaction(
                account_id=staged.account_id,
                plaid_transaction_id=_safe_text(staged.plaid_transaction_id),
                external_id=_safe_text(staged.plaid_transaction_id),
                posted_date=staged.date,
                amount=float(amount_db),  # Use normalized amount
                currency=_safe_text(staged.currency) or "CAD",
                merchant_raw=_safe_text(merchant_name_safe or name_safe),
                description_raw=_safe_text(name_safe),
                merchant_norm=_safe_text(merchant_norm),
                description_norm=_safe_text(description_norm),
                category_id=staged.suggested_category_id,
                subcategory_id=staged.suggested_subcategory_id,
                source=_safe_text(source),  # Use determined source
                txn_type=_safe_text(txn_type),  # Use normalized type
                import_id=import_id,
                raw_json=_safe_json_text(staged.raw_json),
                hash_dedupe=_safe_text(staged.hash_key)
            )
            
            self.db.add(transaction)
            summary["inserted"] += 1
        
        self.db.commit()
        return summary
    
    def get_staging_transactions(
        self,
        import_id: int,
        status: Optional[List[str]] = None,
        mapped_state: Optional[str] = None,
        account_ids: Optional[List[int]] = None,
        search: Optional[str] = None
    ) -> List[StagingTransaction]:
        """Get staging transactions with filters."""
        query = self.db.query(StagingTransaction).filter(
            StagingTransaction.import_id == import_id
        )
        
        if status:
            query = query.filter(StagingTransaction.status.in_(status))
        
        if mapped_state == "mapped":
            query = query.filter(StagingTransaction.suggested_category_id.isnot(None))
        elif mapped_state == "unmapped":
            query = query.filter(StagingTransaction.suggested_category_id.is_(None))
        
        if account_ids:
            query = query.filter(StagingTransaction.account_id.in_(account_ids))
        
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    StagingTransaction.name.ilike(search_pattern),
                    StagingTransaction.merchant_name.ilike(search_pattern)
                )
            )
        
        # Order by status (excluded first), then date
        from sqlalchemy import case
        status_order = case(
            (StagingTransaction.status == "excluded", 1),
            (StagingTransaction.status == "ready", 2),
            (StagingTransaction.status == "needs_category", 3),
            (StagingTransaction.status == "duplicate", 4),
            else_=5
        )
        
        # Eager load category relationships to get names
        from sqlalchemy.orm import joinedload
        query = query.options(
            joinedload(StagingTransaction.suggested_category),
            joinedload(StagingTransaction.suggested_subcategory),
            joinedload(StagingTransaction.account)
        )
        
        # Order by date descending (purchase date stored in date field)
        return query.order_by(status_order, StagingTransaction.date.desc()).all()