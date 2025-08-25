"""Balance service for orchestrating balance refresh and calculations."""
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from .provider import PlaidBalanceProvider, AccountBalanceDTO, today_local_date
from ...models.account import Account
from ...models.account_balance import AccountBalance
from ...models.institution_item import InstitutionItem


class RefreshResult:
    """Result of a balance refresh operation."""
    
    def __init__(self):
        self.assets_total: Decimal = Decimal(0)
        self.liabilities_total: Decimal = Decimal(0)
        self.net_worth: Decimal = Decimal(0)
        self.accounts: List[Dict[str, Any]] = []
        self.accounts_updated: int = 0
        self.errors: List[str] = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "assets_total": float(self.assets_total),
            "liabilities_total": float(self.liabilities_total),
            "net_worth": float(self.net_worth),
            "accounts": self.accounts,
            "accounts_updated": self.accounts_updated,
            "errors": self.errors,
            "timestamp": today_local_date().isoformat(),
        }


class BalanceService:
    """Service for managing account balances."""
    
    def __init__(self, db: Session):
        self.db = db
        self.provider = PlaidBalanceProvider()
    
    def refresh_all_balances(self, user_id: Optional[str] = None) -> RefreshResult:
        """Refresh balances for all linked accounts.
        
        Args:
            user_id: Optional user ID for filtering (not used in current implementation)
            
        Returns:
            RefreshResult with totals and account details
        """
        result = RefreshResult()
        
        # Get all institution items with their access tokens
        items = self.db.query(InstitutionItem).filter(
            InstitutionItem.access_token_encrypted.isnot(None)
        ).all()
        
        if not items:
            result.errors.append("No linked accounts found")
            return result
        
        # Prepare access tokens for the provider
        access_tokens = [
            (item.plaid_item_id, item.access_token_encrypted, item.institution_name or "Unknown")
            for item in items
        ]
        
        # Fetch balances from Plaid
        balance_dtos = self.provider.fetch_all_balances(access_tokens)
        
        # Process each balance
        today = today_local_date()
        
        for dto in balance_dtos:
            try:
                # Find or create the account
                account = self._upsert_account(dto)
                
                # Upsert the daily balance snapshot
                balance = self._upsert_balance(account, dto, today)
                
                # Add to totals
                current_balance = Decimal(str(dto["current"] or 0))
                if dto["type"] == "asset":
                    result.assets_total += current_balance
                else:  # liability
                    result.liabilities_total += current_balance
                
                # Add to account list
                result.accounts.append({
                    "id": account.id,
                    "name": account.name,
                    "official_name": account.official_name,
                    "mask": account.mask,
                    "institution": dto["institution_name"],
                    "type": account.account_type,
                    "subtype": account.account_subtype,
                    "currency": account.iso_currency_code,
                    "available": dto["available"],
                    "current": dto["current"],
                    "limit": dto["limit"],
                    "last_updated": today.isoformat(),
                })
                
                result.accounts_updated += 1
                
            except Exception as e:
                result.errors.append(f"Error processing account {dto.get('name', 'unknown')}: {str(e)}")
                continue
        
        # Calculate net worth
        result.net_worth = result.assets_total - result.liabilities_total
        
        # Commit all changes
        self.db.commit()
        
        return result
    
    def _upsert_account(self, dto: AccountBalanceDTO) -> Account:
        """Upsert an account based on balance DTO.
        
        Args:
            dto: Account balance DTO from provider
            
        Returns:
            Account model instance
        """
        # Find existing account by plaid_account_id
        account = self.db.query(Account).filter(
            Account.plaid_account_id == dto["plaid_account_id"]
        ).first()
        
        if account:
            # Update existing account
            account.name = dto["name"]
            account.official_name = dto["official_name"]
            account.mask = dto["mask"]
            account.account_type = dto["type"]
            account.account_subtype = dto["subtype"]
            account.iso_currency_code = dto["iso_currency_code"]
            account.limit = Decimal(str(dto["limit"])) if dto["limit"] is not None else None
        else:
            # Find the institution item
            item = self.db.query(InstitutionItem).filter(
                InstitutionItem.plaid_item_id == dto["plaid_item_id"]
            ).first()
            
            if not item:
                raise ValueError(f"Institution item not found for plaid_item_id: {dto['plaid_item_id']}")
            
            # Create new account
            account = Account(
                institution_item_id=item.id,
                plaid_account_id=dto["plaid_account_id"],
                name=dto["name"],
                official_name=dto["official_name"],
                mask=dto["mask"],
                account_type=dto["type"],
                account_subtype=dto["subtype"],
                currency=dto["iso_currency_code"],
                iso_currency_code=dto["iso_currency_code"],
                limit=Decimal(str(dto["limit"])) if dto["limit"] is not None else None,
            )
            self.db.add(account)
            self.db.flush()
        
        return account
    
    def _upsert_balance(self, account: Account, dto: AccountBalanceDTO, as_of: date) -> AccountBalance:
        """Upsert a daily balance snapshot.
        
        Args:
            account: Account model instance
            dto: Account balance DTO from provider
            as_of: Date for the snapshot
            
        Returns:
            AccountBalance model instance
        """
        # Find existing balance for today
        balance = self.db.query(AccountBalance).filter(
            and_(
                AccountBalance.account_id == account.id,
                AccountBalance.as_of == as_of
            )
        ).first()
        
        if balance:
            # Update existing balance
            balance.available = Decimal(str(dto["available"])) if dto["available"] is not None else None
            balance.current = Decimal(str(dto["current"])) if dto["current"] is not None else None
            balance.iso_currency_code = dto["iso_currency_code"]
        else:
            # Create new balance snapshot
            balance = AccountBalance(
                account_id=account.id,
                as_of=as_of,
                available=Decimal(str(dto["available"])) if dto["available"] is not None else None,
                current=Decimal(str(dto["current"])) if dto["current"] is not None else None,
                iso_currency_code=dto["iso_currency_code"],
            )
            self.db.add(balance)
        
        return balance
    
    def get_latest_balances(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get the latest balance snapshot for all accounts.
        
        Args:
            user_id: Optional user ID for filtering (not used in current implementation)
            
        Returns:
            Dictionary with accounts and totals
        """
        # Get all accounts with their latest balance
        accounts_data = []
        assets_total = Decimal(0)
        liabilities_total = Decimal(0)
        
        accounts = self.db.query(Account).join(
            Account.institution_item
        ).all()
        
        for account in accounts:
            # Get the latest balance for this account
            latest_balance = self.db.query(AccountBalance).filter(
                AccountBalance.account_id == account.id
            ).order_by(AccountBalance.as_of.desc()).first()
            
            if latest_balance:
                current = latest_balance.current or Decimal(0)
                
                if account.account_type == "asset":
                    assets_total += current
                else:
                    liabilities_total += current
                
                accounts_data.append({
                    "id": account.id,
                    "name": account.name,
                    "official_name": account.official_name,
                    "mask": account.mask,
                    "institution": account.institution_item.institution_name,
                    "type": account.account_type,
                    "subtype": account.account_subtype,
                    "currency": account.iso_currency_code,
                    "available": float(latest_balance.available) if latest_balance.available else None,
                    "current": float(current),
                    "limit": float(account.limit) if account.limit else None,
                    "last_updated": latest_balance.as_of.isoformat(),
                })
        
        return {
            "accounts": accounts_data,
            "totals": {
                "assets": float(assets_total),
                "liabilities": float(liabilities_total),
                "net_worth": float(assets_total - liabilities_total),
            },
            "timestamp": today_local_date().isoformat(),
        }
    
    def get_balance_history(self, account_id: int, days: int = 30) -> List[Dict[str, Any]]:
        """Get balance history for a specific account.
        
        Args:
            account_id: Account ID
            days: Number of days of history to retrieve
            
        Returns:
            List of balance snapshots
        """
        from datetime import timedelta
        
        cutoff_date = today_local_date() - timedelta(days=days)
        
        balances = self.db.query(AccountBalance).filter(
            and_(
                AccountBalance.account_id == account_id,
                AccountBalance.as_of >= cutoff_date
            )
        ).order_by(AccountBalance.as_of).all()
        
        return [
            {
                "date": balance.as_of.isoformat(),
                "available": float(balance.available) if balance.available else None,
                "current": float(balance.current) if balance.current else None,
                "currency": balance.iso_currency_code,
            }
            for balance in balances
        ]