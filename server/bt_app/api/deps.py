"""API dependencies."""
import hmac
from typing import Generator
from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session
from ..core.db import get_db
from ..core.config import settings


def get_database() -> Generator[Session, None, None]:
    """Get database session dependency."""
    yield from get_db()


def require_app_key(x_app_key: str | None = Header(default=None, alias="x-app-key")) -> None:
    """Require a shared app key for personal-alpha API access."""
    expected = (settings.app_shared_key or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Server misconfigured: APP_SHARED_KEY is missing",
        )
    if not x_app_key or not hmac.compare_digest(x_app_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid app key",
        )















