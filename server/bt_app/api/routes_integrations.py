"""API routes for external integrations (crypto exchanges, etc)."""
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import json

from ..models.external_integration import ExternalIntegration, ProviderType
from ..services.crypto import NDAXClient, CryptoBalanceProvider
from ..utils.encryption import encrypt_value, decrypt_value, mask_api_key
from .deps import get_database

router = APIRouter(tags=["integrations"])


@router.post("/ndax/connect")
async def connect_ndax(
    api_key: str = Body(..., description="NDAX API Key"),
    api_secret: str = Body(..., description="NDAX API Secret"),
    uid: str = Body(..., description="NDAX UID (user id)"),
    login: Optional[str] = Body(None, description="Optional NDAX login/username"),
    password: Optional[str] = Body(None, description="Optional NDAX password"),
    db: Session = Depends(get_database),
):
    """Create/overwrite NDAX integration after verifying credentials via NDAXClient."""
    try:
        client = NDAXClient(api_key, api_secret, uid, login, password)
        test_result = client.test_connection()

        if not test_result.get("success"):
            # include exchange error details to front-end
            detail = test_result.get("message") or test_result.get("error") or "Connection test failed"
            raise HTTPException(status_code=400, detail=detail)

        # Upsert integration
        integration = (
            db.query(ExternalIntegration)
              .filter(ExternalIntegration.provider == ProviderType.NDAX)
              .first()
        )
        payload = {
            "provider": ProviderType.NDAX,
            "api_key_encrypted": encrypt_value(api_key),
            "api_secret_encrypted": encrypt_value(api_secret),
            "uid_encrypted": encrypt_value(uid),
            "is_active": True,
        }
        # Persist optional fields only if model has them
        if hasattr(ExternalIntegration, "login_encrypted") and login:
            payload["login_encrypted"] = encrypt_value(login)
        if hasattr(ExternalIntegration, "password_encrypted") and password:
            payload["password_encrypted"] = encrypt_value(password)

        if integration:
            for k, v in payload.items():
                setattr(integration, k, v)
            integration.updated_at = datetime.utcnow()
        else:
            integration = ExternalIntegration(**payload)
            db.add(integration)

        db.commit()
        return {"success": True, "message": "NDAX connected"}
    except HTTPException:
        raise
    except Exception as e:
        # bubble up meaningful server errors
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@router.post("/ndax/test")
async def test_ndax_connection(db: Session = Depends(get_database)):
    """Test existing NDAX connection.
    
    Returns:
        Test result
    """
    try:
        # Get active NDAX integration
        integration = db.query(ExternalIntegration).filter(
            ExternalIntegration.provider == ProviderType.NDAX,
            ExternalIntegration.is_active == True
        ).first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="NDAX integration not found")
        
        # Test connection
        provider = CryptoBalanceProvider(integration)
        result = provider.test_connection()
        
        # Update last error if test failed
        if not result.get("success"):
            integration.last_error = result.get("error", "Unknown error")
            db.commit()
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ndax/refresh")
async def refresh_ndax_balances(db: Session = Depends(get_database)):
    """Refresh NDAX balances.
    
    Returns:
        Refresh result with balance data
    """
    try:
        # Get active NDAX integration
        integration = db.query(ExternalIntegration).filter(
            ExternalIntegration.provider == ProviderType.NDAX,
            ExternalIntegration.is_active == True
        ).first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="NDAX integration not found")
        
        # Fetch balances
        provider = CryptoBalanceProvider(integration)
        balances = provider.fetch_all_balances()
        
        # Calculate totals
        total_cad = 0.0
        crypto_assets = []
        
        for balance in balances:
            # Convert balance DTO to dict for storage/display
            balance_dict = {
                "name": balance.get("name"),
                "currency": balance.get("iso_currency_code"),
                "available": balance.get("available", 0),
                "total": balance.get("current", 0),
                "type": balance.get("subtype", "crypto")
            }
            
            # Add CAD value if available
            if "value_cad" in balance:
                balance_dict["value_cad"] = balance["value_cad"]
                total_cad += balance["value_cad"]
            elif balance.get("iso_currency_code") == "CAD":
                balance_dict["value_cad"] = balance.get("current", 0)
                total_cad += balance.get("current", 0)
            
            crypto_assets.append(balance_dict)
        
        # Cache the balances
        integration.cached_balances = json.dumps(crypto_assets)
        integration.cache_expires_at = datetime.utcnow() + timedelta(minutes=5)
        integration.last_refresh = datetime.utcnow()
        integration.last_error = None
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Refreshed {len(crypto_assets)} assets",
            "timestamp": datetime.utcnow().isoformat(),
            "totals": {
                "assets_count": len(crypto_assets),
                "total_value_cad": total_cad
            },
            "balances": crypto_assets
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Log error
        if integration:
            integration.last_error = str(e)
            db.commit()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ndax/balances")
async def get_ndax_balances(db: Session = Depends(get_database)):
    """Return NDAX balances if connected; otherwise return an empty payload (200)."""
    try:
        # Get active NDAX integration
        integration = db.query(ExternalIntegration).filter(
            ExternalIntegration.provider == ProviderType.NDAX,
            ExternalIntegration.is_active == True
        ).first()
        
        if not integration:
            return {
                "source": "none",
                "timestamp": None,
                "expires_at": None,
                "totals": {"assets_count": 0, "total_value_cad": 0.0},
                "balances": []
            }
        
        # Check cache
        if (integration.cached_balances and 
            integration.cache_expires_at and 
            integration.cache_expires_at > datetime.utcnow()):
            
            # Return cached data
            balances = json.loads(integration.cached_balances)
            
            total_cad = sum(
                b.get("value_cad", 0) for b in balances
            )
            
            return {
                "source": "cache",
                "timestamp": integration.last_refresh.isoformat() if integration.last_refresh else None,
                "expires_at": integration.cache_expires_at.isoformat(),
                "totals": {
                    "assets_count": len(balances),
                    "total_value_cad": total_cad
                },
                "balances": balances
            }
        
        # Cache expired, refresh
        return await refresh_ndax_balances(db)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ndax")
async def disconnect_ndax(db: Session = Depends(get_database)):
    """Disconnect NDAX integration.
    
    Returns:
        Disconnection result
    """
    try:
        # Get active NDAX integration
        integration = db.query(ExternalIntegration).filter(
            ExternalIntegration.provider == ProviderType.NDAX,
            ExternalIntegration.is_active == True
        ).first()
        
        if not integration:
            raise HTTPException(status_code=404, detail="NDAX integration not found")
        
        # Soft delete - just mark as inactive
        integration.is_active = False
        integration.updated_at = datetime.utcnow()
        
        db.commit()
        
        return {
            "success": True,
            "message": "NDAX disconnected successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_integrations_status(db: Session = Depends(get_database)):
    """Get status of all external integrations.
    
    Returns:
        List of integration statuses
    """
    try:
        integrations = db.query(ExternalIntegration).filter(
            ExternalIntegration.is_active == True
        ).all()
        
        status_list = []
        
        for integration in integrations:
            status_list.append({
                "id": integration.id,
                "provider": integration.provider.value,
                "label": integration.label,
                "is_active": integration.is_active,
                "last_refresh": integration.last_refresh.isoformat() if integration.last_refresh else None,
                "has_error": bool(integration.last_error),
                "error_message": integration.last_error
            })
        
        return {
            "integrations": status_list,
            "count": len(status_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))