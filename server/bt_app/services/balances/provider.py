"""Balance provider abstraction and Plaid implementation."""
from datetime import datetime, date
from typing import List, Optional, Protocol, TypedDict
from dateutil import tz
from decimal import Decimal

from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest

from ...services.plaid_service import get_plaid_client


class AccountBalanceDTO(TypedDict):
    """Data transfer object for account balance information."""
    plaid_account_id: Optional[str]
    plaid_item_id: Optional[str]
    name: str
    official_name: Optional[str]
    mask: Optional[str]
    institution_name: Optional[str]
    type: str  # "asset" | "liability"
    subtype: Optional[str]
    iso_currency_code: str
    available: Optional[float]
    current: Optional[float]
    limit: Optional[float]


LOCAL_TZ = tz.gettz("America/Toronto")


def today_local_date() -> date:
    """Get today's date in the local timezone (America/Toronto)."""
    return datetime.now(LOCAL_TZ).date()


class BalanceProvider(Protocol):
    """Protocol for balance providers."""
    
    def fetch_all_balances(self, access_tokens: List[tuple[str, str]]) -> List[AccountBalanceDTO]:
        """Fetch balances for all accounts across multiple items.
        
        Args:
            access_tokens: List of (item_id, access_token) tuples
            
        Returns:
            List of account balance DTOs
        """
        ...


class PlaidBalanceProvider:
    """Plaid implementation of balance provider."""
    
    def __init__(self):
        self.client = get_plaid_client()
    
    def _map_account_type(self, plaid_type: str, plaid_subtype: str) -> tuple[str, str]:
        """Map Plaid account types to our asset/liability classification.
        
        Args:
            plaid_type: Plaid account type (depository, credit, loan, investment, etc.)
            plaid_subtype: Plaid account subtype (checking, savings, credit card, etc.)
            
        Returns:
            Tuple of (type, subtype) where type is "asset" or "liability"
        """
        # Liability types
        if plaid_type == "credit":
            return "liability", plaid_subtype or "credit card"
        if plaid_type == "loan":
            return "liability", plaid_subtype or "loan"
        
        # Asset types
        if plaid_type in ["depository", "investment", "brokerage"]:
            return "asset", plaid_subtype or plaid_type
        
        # Default to asset for unknown types
        return "asset", plaid_subtype or plaid_type
    
    def fetch_all_balances(self, access_tokens: List[tuple[str, str, str]]) -> List[AccountBalanceDTO]:
        """Fetch balances for all accounts across multiple items.
        
        Args:
            access_tokens: List of (item_id, access_token, institution_name) tuples
            
        Returns:
            List of account balance DTOs
        """
        all_balances = []
        
        for item_id, access_token, institution_name in access_tokens:
            try:
                # Call Plaid /accounts/balance/get endpoint
                request = AccountsBalanceGetRequest(access_token=access_token)
                response = self.client.accounts_balance_get(request)
                
                # Process each account
                for account in response.accounts:
                    account_type, account_subtype = self._map_account_type(
                        account.type.value if hasattr(account.type, 'value') else str(account.type),
                        account.subtype.value if account.subtype and hasattr(account.subtype, 'value') else str(account.subtype) if account.subtype else None
                    )
                    
                    # Extract balance information
                    balances = account.balances
                    
                    balance_dto = AccountBalanceDTO(
                        plaid_account_id=account.account_id,
                        plaid_item_id=item_id,
                        name=account.name,
                        official_name=account.official_name,
                        mask=account.mask,
                        institution_name=institution_name,
                        type=account_type,
                        subtype=account_subtype,
                        iso_currency_code=balances.iso_currency_code or "USD",
                        available=float(balances.available) if balances.available is not None else None,
                        current=float(balances.current) if balances.current is not None else None,
                        limit=float(balances.limit) if balances.limit is not None else None,
                    )
                    
                    all_balances.append(balance_dto)
                    
            except Exception as e:
                print(f"Error fetching balances for item {item_id}: {e}")
                continue
        
        return all_balances