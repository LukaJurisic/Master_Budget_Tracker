"""API dependencies."""
from typing import Generator
from sqlalchemy.orm import Session
from ..core.db import get_db


def get_database() -> Generator[Session, None, None]:
    """Get database session dependency."""
    yield from get_db()















