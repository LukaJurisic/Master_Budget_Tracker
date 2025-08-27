"""Crypto balance provider that integrates with the main balance system."""
from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import logging

from .ndax_client import NDAXClient
from ...models.external_integration import ExternalIntegration, ProviderType
from ...utils.encryption import decrypt_value
from ..balances.provider import AccountBalanceDTO, BalanceProvider

logger = logging.getLogger(__name__)


class CryptoBalanceProvider:
    """Provider for cryptocurrency exchange balances."""
    
    def __init__(self, integration: ExternalIntegration):
        """Initialize with an external integration.
        
        Args:
            integration: ExternalIntegration model instance
        """
        self.integration = integration
        self.client = self._create_client()
    
    def _create_client(self) -> Optional[NDAXClient]:
        """Create the appropriate exchange client.
        
        Returns:
            Exchange client instance or None if unsupported
        """
        if self.integration.provider == ProviderType.NDAX:
            api_key = decrypt_value(self.integration.api_key_encrypted)
            api_secret = decrypt_value(self.integration.api_secret_encrypted)
            uid = decrypt_value(self.integration.uid_encrypted) if self.integration.uid_encrypted else None
            login = decrypt_value(self.integration.login_encrypted) if self.integration.login_encrypted else None
            password = decrypt_value(self.integration.password_encrypted) if self.integration.password_encrypted else None
            
            if not api_key or not api_secret:
                logger.error(f"Failed to decrypt credentials for {self.integration.provider}")
                return None
            
            return NDAXClient(api_key, api_secret, uid, login, password)
        
        # Add other exchanges here in future
        logger.warning(f"Unsupported provider: {self.integration.provider}")
        return None
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the exchange connection.
        
        Returns:
            Test result dictionary
        """
        if not self.client:
            return {
                "success": False,
                "message": "Client not initialized"
            }
        
        return self.client.test_connection()
    
    def fetch_all_balances(self) -> List[AccountBalanceDTO]:
        """Fetch balances in the standard format.
        
        Returns:
            List of AccountBalanceDTO compatible dictionaries
        """
        if not self.client:
            logger.error("No client available for balance fetch")
            return []
        
        try:
            # Get raw balances from exchange
            raw_balances = self.client.fetch_balances()
            
            # Convert to our standard format
            balance_dtos = []
            
            for balance in raw_balances:
                # Create a DTO for each crypto asset
                dto = AccountBalanceDTO(
                    plaid_account_id=None,  # Not a Plaid account
                    plaid_item_id=None,
                    name=f"{balance['asset']} Balance",
                    official_name=f"{self.integration.provider.value.upper()} {balance['asset']}",
                    mask=None,
                    institution_name=self.integration.provider.value.upper(),
                    type="asset",  # Crypto is an asset
                    subtype="crypto",
                    iso_currency_code=balance['asset'],  # Use asset symbol as currency
                    available=balance.get('free', 0),
                    current=balance.get('total', 0),
                    limit=None
                )
                
                # Add CAD value if available (for display purposes)
                if 'value_cad' in balance:
                    dto['value_cad'] = balance['value_cad']
                
                balance_dtos.append(dto)
            
            # Add a CAD cash balance if present
            # (Some exchanges hold fiat balances)
            cad_balance = next((b for b in raw_balances if b['asset'] == 'CAD'), None)
            if cad_balance:
                dto = AccountBalanceDTO(
                    plaid_account_id=None,
                    plaid_item_id=None,
                    name="CAD Balance",
                    official_name=f"{self.integration.provider.value.upper()} CAD",
                    mask=None,
                    institution_name=self.integration.provider.value.upper(),
                    type="asset",
                    subtype="cash",
                    iso_currency_code="CAD",
                    available=cad_balance.get('free', 0),
                    current=cad_balance.get('total', 0),
                    limit=None
                )
                # CAD balance doesn't need conversion
                dto['value_cad'] = cad_balance.get('total', 0)
            
            return balance_dtos
            
        except Exception as e:
            logger.error(f"Failed to fetch crypto balances: {e}")
            return []
    
    def get_total_value_cad(self) -> float:
        """Get total portfolio value in CAD.
        
        Returns:
            Total value in CAD
        """
        balances = self.fetch_all_balances()
        total = 0.0
        
        for balance in balances:
            # Use CAD value if available
            if 'value_cad' in balance:
                total += balance['value_cad']
            elif balance.get('iso_currency_code') == 'CAD':
                total += balance.get('current', 0)
        
        return total