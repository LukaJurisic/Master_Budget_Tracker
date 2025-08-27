"""Root API router that includes all other routers."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
# from .routes_plaid import router as plaid_router  # DISABLED - using enhanced router
from .routes_plaid_enhanced import router as plaid_enhanced_router
from .routes_sync import router as sync_router
from .routes_transactions import router as transactions_router
from .routes_rules import router as rules_router
from .routes_uploads import router as uploads_router
from .routes_summary import router as summary_router
from .routes_budgets import router as budgets_router
from .routes_import import router as import_router
from .routes_income import router as income_router
from .routes_analytics import router as analytics_router
from .routes_analytics_simple import router as analytics_simple_router
from .routes_analytics_freq import router as analytics_freq_router
from .routes_dashboard import router as dashboard_router
from .routes_search import router as search_router
from .routes_balances import router as balances_router
from .routes_integrations import router as integrations_router
from .deps import get_database

api_router = APIRouter()

# Include all routers with their prefixes
# api_router.include_router(plaid_router, prefix="/plaid", tags=["plaid"])  # Disabled in favor of enhanced
api_router.include_router(plaid_enhanced_router, prefix="/plaid", tags=["plaid-enhanced"])
api_router.include_router(sync_router, prefix="/sync", tags=["sync"])
api_router.include_router(transactions_router, prefix="/transactions", tags=["transactions"])
api_router.include_router(rules_router, prefix="/rules", tags=["rules"])
api_router.include_router(uploads_router, prefix="/upload", tags=["uploads"])
api_router.include_router(summary_router, prefix="/summary", tags=["summary"])
api_router.include_router(budgets_router, prefix="/budgets", tags=["budgets"])
api_router.include_router(import_router, prefix="/import", tags=["import"])
api_router.include_router(income_router, prefix="/income", tags=["income"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(analytics_freq_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(analytics_simple_router, prefix="/analytics", tags=["analytics-simple"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(search_router, prefix="/transactions", tags=["search"])
api_router.include_router(balances_router, prefix="/balances", tags=["balances"])  # Account balances endpoints
api_router.include_router(integrations_router, prefix="/integrations", tags=["integrations"])  # External integrations (NDAX, etc)


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@api_router.get("/__db")
def db_debug(session: Session = Depends(get_database)):
    """Show the database file SQLite actually opened in this process."""
    from sqlalchemy import text
    from ..core.config import settings
    
    # Show the database file SQLite actually opened in this process
    pragma = session.execute(text("PRAGMA database_list;")).fetchall()
    tables = session.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")
    ).fetchall()
    return {
        "resolved_url": settings.absolute_database_url,
        "database_list": [tuple(r) for r in pragma],
        "tables": [t[0] for t in tables],
    }


# Convenience refresh endpoint
@api_router.post("/refresh")
async def refresh_data():
    """Alias for /summary/refresh for convenience."""
    from .routes_summary import refresh_data as summary_refresh
    from .deps import get_database
    from fastapi import Depends
    from sqlalchemy.orm import Session
    
    # Get a database session
    db = next(get_database())
    try:
        return await summary_refresh(db)
    finally:
        db.close()















