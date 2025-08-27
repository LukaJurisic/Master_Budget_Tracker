"""NDAX exchange client using ccxt."""
import ccxt
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import json
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class NDAXClient:
    """Client for NDAX cryptocurrency exchange."""
    
    def __init__(self, api_key: str, api_secret: str, uid: str, login: Optional[str] = None, password: Optional[str] = None):
        """Initialize NDAX client.
        
        Args:
            api_key: NDAX API key
            api_secret: NDAX API secret
            uid: NDAX user ID (required for private calls)
            login: NDAX login email (required for private calls)
            password: NDAX account password (required for private calls)
        """
        config = {
            'apiKey': api_key,
            'secret': api_secret,
            'uid': uid,
            'enableRateLimit': True,
            'rateLimit': 1000,  # 1 request per second
            'options': {
                'defaultType': 'spot',
            }
        }
        
        if login:
            config['login'] = login
        if password:
            config['password'] = password
            
        self.exchange = ccxt.ndax(config)
        
        # Store credentials for debugging
        self.uid = uid
        self.login = login
        self.password = password
        
        # Cache settings
        self._balance_cache = None
        self._cache_time = None
        self._cache_ttl = 30  # 30 seconds cache
    
    def test_connection(self) -> Dict[str, Any]:
        """Test the API connection.
        
        Returns:
            Dictionary with success status and message
        """
        try:
            # Try to fetch account info or balance as a test
            balance = self.exchange.fetch_balance()
            return {
                "success": True,
                "message": "Connection successful",
                "has_balances": len(balance.get('info', {})) > 0
            }
        except ccxt.AuthenticationError as e:
            return {
                "success": False,
                "message": "Invalid API credentials",
                "error": str(e)
            }
        except ccxt.NetworkError as e:
            return {
                "success": False,
                "message": "Network error",
                "error": str(e)
            }
        except Exception as e:
            return {
                "success": False,
                "message": "Connection failed",
                "error": str(e)
            }
    
    def fetch_balances(self, use_cache: bool = True) -> List[Dict[str, Any]]:
        """Fetch account balances.
        
        Args:
            use_cache: Whether to use cached data if available
            
        Returns:
            List of balance dictionaries with format:
            [
                {
                    "asset": "BTC",
                    "free": 0.123,
                    "used": 0.0,
                    "total": 0.123,
                    "value_cad": 8500.50  # Optional, if price available
                },
                ...
            ]
        """
        # Check cache
        if use_cache and self._balance_cache and self._cache_time:
            if datetime.now() - self._cache_time < timedelta(seconds=self._cache_ttl):
                logger.debug("Using cached balance data")
                return self._balance_cache
        
        try:
            # Fetch balances from exchange
            balance_data = self.exchange.fetch_balance()
            
            # Extract and normalize balances
            balances = []
            
            # Process each currency balance
            for currency, info in balance_data.items():
                # Skip meta fields
                if currency in ['info', 'free', 'used', 'total', 'timestamp', 'datetime']:
                    continue
                
                # Only include non-zero balances
                if isinstance(info, dict) and info.get('total', 0) > 0:
                    balance = {
                        "asset": currency,
                        "free": float(info.get('free', 0)),
                        "used": float(info.get('used', 0)),
                        "total": float(info.get('total', 0))
                    }
                    
                    # Try to get CAD value (optional)
                    cad_value = self._get_cad_value(currency, balance['total'])
                    if cad_value:
                        balance['value_cad'] = cad_value
                    
                    balances.append(balance)
            
            # Update cache
            self._balance_cache = balances
            self._cache_time = datetime.now()
            
            return balances
            
        except Exception as e:
            logger.error(f"Failed to fetch NDAX balances: {e}")
            raise
    
    def _get_cad_value(self, asset: str, amount: float) -> Optional[float]:
        """Get CAD value for an asset amount.
        
        Args:
            asset: Asset symbol (BTC, ETH, etc)
            amount: Amount of the asset
            
        Returns:
            CAD value or None if price unavailable
        """
        # Skip stablecoins and CAD itself
        if asset in ['CAD', 'USDC', 'USDT', 'DAI']:
            if asset == 'CAD':
                return amount
            # Assume 1:1 for USD stablecoins (simplified)
            return amount * 1.35  # Rough USD to CAD conversion
        
        try:
            # Try to fetch ticker for asset/CAD pair
            ticker = None
            pairs_to_try = [
                f"{asset}/CAD",
                f"{asset}/USDT",  # Fallback to USDT if no CAD pair
                f"{asset}/USD"
            ]
            
            for pair in pairs_to_try:
                try:
                    ticker = self.exchange.fetch_ticker(pair)
                    break
                except:
                    continue
            
            if ticker and 'last' in ticker:
                price = ticker['last']
                
                # If we got a USDT or USD price, convert to CAD
                if 'USDT' in pair or 'USD' in pair:
                    price *= 1.35  # Rough conversion rate
                
                return amount * price
                
        except Exception as e:
            logger.debug(f"Could not get CAD value for {asset}: {e}")
        
        return None
    
    def get_account_info(self) -> Dict[str, Any]:
        """Get account information.
        
        Returns:
            Dictionary with account details
        """
        try:
            # NDAX might not have a specific account info endpoint
            # Return basic info from balance call
            balance = self.exchange.fetch_balance()
            
            return {
                "exchange": "NDAX",
                "has_data": len(balance.get('info', {})) > 0,
                "timestamp": balance.get('timestamp', datetime.now().timestamp())
            }
        except Exception as e:
            logger.error(f"Failed to get NDAX account info: {e}")
            return {
                "exchange": "NDAX",
                "error": str(e)
            }