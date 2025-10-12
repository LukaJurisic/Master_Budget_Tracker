# server/app/services/plaid_service.py
import os
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from plaid import ApiClient, Configuration, Environment
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.transactions_sync_request_options import TransactionsSyncRequestOptions

# Import settings to get environment variables
from ..core.config import settings
from ..utils.account_mapping import get_source_from_account_name

PLAID_ENV = settings.plaid_env.lower()
PLAID_CLIENT_ID = settings.plaid_client_id
PLAID_SECRET = settings.plaid_secret

_ENV_MAP = {
    "sandbox": Environment.Sandbox,
    "development": Environment.Development,
    "production": Environment.Production,
}

def _build_client() -> plaid_api.PlaidApi:
    configuration = Configuration(
        host=_ENV_MAP.get(PLAID_ENV, Environment.Sandbox),
        api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET},
    )
    api_client = ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)

# Global client instance - lazy loaded to ensure proper environment
_plaid_client: Optional[plaid_api.PlaidApi] = None

def get_plaid_client() -> plaid_api.PlaidApi:
    """Get or create the global Plaid client with current environment settings."""
    global _plaid_client
    if _plaid_client is None:
        _plaid_client = _build_client()
    return _plaid_client

class PlaidService:
    """Service class for Plaid API integration."""
    
    def __init__(self, db: Session):
        self.db = db
        self.client = get_plaid_client()  # Use the lazy-loaded client with correct environment
    
    def create_link_token(self, user_id: str = "user-1", access_token: Optional[str] = None) -> Dict[str, str]:
        """Create a one-time Link token for the frontend.
        
        Args:
            user_id: Unique user identifier
            access_token: If provided, creates an update-mode token for re-authentication
        """
        import json
        from uuid import uuid4
        from plaid.exceptions import ApiException
        
        # Debug what we're actually using
        env = os.environ.get("PLAID_ENV", "unknown")
        cid = os.environ.get("PLAID_CLIENT_ID", "")
        sec = os.environ.get("PLAID_SECRET", "")
        print(f"[PLAID CLASS DEBUG] env={env}, cid={cid[:4]}...{cid[-4:]} (len={len(cid)}), sec={sec[:4]}...{sec[-4:]} (len={len(sec)})")
        
        # Required by Plaid: a stable, unique ID per end user
        client_user_id = os.environ.get("LINK_CLIENT_USER_ID") or user_id or str(uuid4())
        redirect_uri = os.environ.get("PLAID_REDIRECT_URI") or None  # REQUIRED for some OAuth institutions in prod
        
        # Build request parameters
        req_params = {
            "user": LinkTokenCreateRequestUser(client_user_id=client_user_id),
            "client_name": "Budget Tracker",
            "country_codes": [CountryCode("CA"), CountryCode("US")],
            "language": "en",
        }
        
        # If access_token provided, this is an update-mode token for re-authentication
        if access_token:
            req_params["access_token"] = access_token
            print(f"[PLAID] Creating update-mode link token for re-authentication")
        else:
            # New connection - include products
            req_params["products"] = [Products("transactions")]
        
        if redirect_uri:
            req_params["redirect_uri"] = redirect_uri
            
        req = LinkTokenCreateRequest(**req_params)
        
        try:
            res = self.client.link_token_create(req)
            return {"link_token": res.link_token}
        except ApiException as e:
            # Surface the real Plaid error in our 400 to make debugging trivial
            try:
                body = json.loads(e.body)
            except Exception:
                body = {"error": str(e)}
            # include a slim hint about which env we used
            body["hint_env"] = os.environ.get("PLAID_ENV")
            raise Exception(json.dumps(body))

    def exchange_public_token(self, public_token: str) -> Dict[str, str]:
        """Exchange the Link public_token for an access_token and item_id."""
        res = self.client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=public_token)
        )
        # TODO: Persist res.access_token (encrypted) and res.item_id in your DB.
        return {"access_token": res.access_token, "item_id": res.item_id}

    def sync_transactions(self, access_token: str, cursor: Optional[str] = None, count: int = 500) -> Dict[str, Any]:
        """Call /transactions/sync and return added/modified/removed + next_cursor."""
        added: List[dict] = []
        modified: List[dict] = []
        removed: List[dict] = []
        next_cursor: Optional[str] = cursor

        while True:
            kwargs = dict(
                access_token=access_token,
                count=count,
                options=TransactionsSyncRequestOptions(include_original_description=True),
            )
            if next_cursor:  # only include when truthy
                kwargs["cursor"] = next_cursor

            req = TransactionsSyncRequest(**kwargs)
            res = self.client.transactions_sync(req)
            added.extend([t.to_dict() for t in res.added])
            modified.extend([t.to_dict() for t in res.modified])
            removed.extend([r.to_dict() for r in res.removed])
            next_cursor = res.next_cursor
            if not res.has_more:
                break

        return {
            "added": added,
            "modified": modified,
            "removed": removed,
            "next_cursor": next_cursor,
        }

    def sync_all_items(self) -> Dict[str, Any]:
        """Sync transactions for all institution items."""
        from ..models.institution_item import InstitutionItem
        from ..models.transaction import Transaction
        from ..models.account import Account
        
        total_added = 0
        total_modified = 0
        total_removed = 0
        
        # Get all institution items
        items = self.db.query(InstitutionItem).all()
        
        for item in items:
            try:
                # Sync transactions for this item
                print(f"Syncing item {item.id} with cursor: {repr(item.next_cursor)}")
                sync_result = self.sync_transactions(
                    access_token=item.access_token_encrypted,  # Using plain text for now
                    cursor=item.next_cursor
                )
            except Exception as e:
                print(f"Sync error for item {item.id}: {e}")
                continue
            
            # Process the sync results
            for tx_data in sync_result["added"]:
                # Create or update accounts first
                account_id = tx_data.get("account_id")
                if account_id:
                    existing_account = self.db.query(Account).filter(
                        Account.plaid_account_id == account_id
                    ).first()
                    
                    if not existing_account:
                        # Create new account (basic info - would normally get from /accounts/get)
                        account = Account(
                            institution_item_id=item.id,
                            plaid_account_id=account_id,
                            name=f"Account {account_id[-4:]}",
                            mask=account_id[-4:] if len(account_id) > 4 else account_id,
                            official_name=f"Account {account_id[-4:]}",
                            currency="USD",
                            account_type="depository"
                        )
                        self.db.add(account)
                        self.db.flush()
                        account_db_id = account.id
                    else:
                        account_db_id = existing_account.id
                
                # Get the account for source determination
                account = existing_account if 'existing_account' in locals() else account
                
                # Create transaction
                import hashlib
                from datetime import datetime
                
                # Create hash for deduplication
                hash_string = f"{account_db_id}_{tx_data.get('date')}_{tx_data.get('amount')}_{tx_data.get('name', '')}"
                hash_dedupe = hashlib.md5(hash_string.encode()).hexdigest()
                
                # Parse date
                date_str = tx_data.get("date")
                if isinstance(date_str, str):
                    posted_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                else:
                    posted_date = date_str
                
                # Normalize merchant and description
                from ..services.mapping_service import MappingService
                mapping_service = MappingService(self.db)
                
                merchant_raw = tx_data.get("merchant_name", "")
                description_raw = tx_data.get("name", "")
                merchant_norm = mapping_service.normalize_merchant(merchant_raw, description_raw)
                description_norm = mapping_service.normalize_description(description_raw)
                
                # Determine source based on account name
                source = get_source_from_account_name(account.name)
                if source == "Unknown":
                    source = "plaid"  # Fallback for Plaid transactions
                
                transaction = Transaction(
                    account_id=account_db_id,
                    plaid_transaction_id=tx_data.get("transaction_id"),
                    amount=float(tx_data.get("amount", 0)),
                    posted_date=posted_date,
                    merchant_raw=merchant_raw,
                    description_raw=description_raw,
                    merchant_norm=merchant_norm,
                    description_norm=description_norm,
                    hash_dedupe=hash_dedupe,
                    source=source
                )
                self.db.add(transaction)
                total_added += 1
            
            # Update cursor for next sync
            item.next_cursor = sync_result["next_cursor"]
            
            total_modified += len(sync_result["modified"])
            total_removed += len(sync_result["removed"])
            
            # Commit after each item to save cursor progress
            self.db.commit()
        
        return {
            "added": total_added,
            "modified": total_modified,
            "removed": total_removed
        }

# LEGACY: Standalone functions - DEPRECATED, use PlaidService class instead
def _legacy_create_link_token() -> Dict[str, str]:
    """Create a one-time Link token for the frontend."""
    import json
    from uuid import uuid4
    from plaid.exceptions import ApiException
    import hashlib
    
    # Debug what we're actually using
    env = os.environ.get("PLAID_ENV", "unknown")
    cid = os.environ.get("PLAID_CLIENT_ID", "")
    sec = os.environ.get("PLAID_SECRET", "")
    print(f"[PLAID DEBUG] env={env}, cid={cid[:4]}...{cid[-4:]} (len={len(cid)}), sec={sec[:4]}...{sec[-4:]} (len={len(sec)})")
    
    # Required by Plaid: a stable, unique ID per end user
    client_user_id = os.environ.get("LINK_CLIENT_USER_ID") or str(uuid4())
    redirect_uri = os.environ.get("PLAID_REDIRECT_URI") or None  # REQUIRED for some OAuth institutions in prod

    # Only include redirect_uri if it's set
    req_params = {
        "user": LinkTokenCreateRequestUser(client_user_id=client_user_id),
        "client_name": "Budget Tracker",
        "products": [Products("transactions")],
        "country_codes": [CountryCode("CA"), CountryCode("US")],
        "language": "en",
    }
    
    if redirect_uri:
        req_params["redirect_uri"] = redirect_uri
        
    req = LinkTokenCreateRequest(**req_params)
    
    try:
        client = get_plaid_client()
        res = client.link_token_create(req)
        return {"link_token": res.link_token}
    except ApiException as e:
        # Surface the real Plaid error in our 400 to make debugging trivial
        try:
            body = json.loads(e.body)
        except Exception:
            body = {"error": str(e)}
        # include a slim hint about which env we used
        body["hint_env"] = os.environ.get("PLAID_ENV")
        raise Exception(json.dumps(body))

# Export control - only export the class, not legacy functions
__all__ = ["PlaidService"]

def _legacy_exchange_public_token(public_token: str) -> Dict[str, str]:
    """Exchange the Link public_token for an access_token and item_id."""
    import json
    from plaid.exceptions import ApiException
    
    try:
        client = get_plaid_client()
        res = client.item_public_token_exchange(
            ItemPublicTokenExchangeRequest(public_token=public_token)
        )
        # TODO: Persist res.access_token (encrypted) and res.item_id in your DB.
        return {"access_token": res.access_token, "item_id": res.item_id}
    except ApiException as e:
        # Surface the real Plaid error
        try:
            body = json.loads(e.body)
        except Exception:
            body = {"error": str(e)}
        body["hint_env"] = os.environ.get("PLAID_ENV")
        raise Exception(json.dumps(body))

# Export control - only export the class, not legacy functions
__all__ = ["PlaidService"]