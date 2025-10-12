"""System and app mode API routes."""
from fastapi import APIRouter
from ..core.config import settings

router = APIRouter(tags=["system"])


@router.get("/mode")
def get_app_mode():
    """Get current application mode and feature flags.
    
    Returns information about whether the app is running in demo or production mode,
    and which features are enabled.
    """
    return {
        "mode": "demo" if settings.is_demo_mode else "production",
        "is_demo": settings.is_demo_mode,
        "features": {
            "plaid_enabled": settings.plaid_enabled,
            "excel_import_enabled": True,
            "excel_export_enabled": True,
            "manual_entry_enabled": True,
            "mapping_studio_enabled": True,
            "category_management_enabled": True,
        },
        "demo_config": {
            "show_banner": settings.is_demo_mode,
            "banner_message": "🎭 Demo Mode - Viewing sample data" if settings.is_demo_mode else None,
        }
    }


@router.get("/health")
def health_check():
    """Simple health check endpoint."""
    return {
        "status": "ok",
        "mode": "demo" if settings.is_demo_mode else "production",
    }

