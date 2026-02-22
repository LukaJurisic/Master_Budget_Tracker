"""Database configuration and session management."""
import logging
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

logger = logging.getLogger(__name__)
DB_URL = settings.absolute_database_url

# If it's sqlite, make sure the directory exists, verify file exists and has data
if DB_URL.startswith("sqlite:///"):
    assert DB_URL.startswith("sqlite:///"), f"Unexpected DB_URL: {DB_URL}"
    db_path = Path(DB_URL.replace("sqlite:///", ""))  # absolute now
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise RuntimeError(
            f"SQLite directory is not writable: {db_path.parent}. "
            "On Render, either mount a disk at /var/data or use a writable path "
            "(e.g. sqlite:////tmp/signalledger_alpha.db)."
        ) from exc

    if not db_path.exists():
        logger.warning("SQLite file does not exist yet; will initialize on first run: %s", db_path)
    elif db_path.stat().st_size == 0:
        logger.warning("SQLite file exists but is empty; schema initialization may be required: %s", db_path)
    else:
        logger.info("Opening SQLite: %s (size=%s)", db_path, db_path.stat().st_size)

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def initialize_database_schema() -> None:
    """Initialize DB schema for fresh SQLite deployments."""
    from ..models import account  # noqa: F401
    from ..models import account_balance  # noqa: F401
    from ..models import audit_log  # noqa: F401
    from ..models import budget  # noqa: F401
    from ..models import category  # noqa: F401
    from ..models import external_integration  # noqa: F401
    from ..models import institution_item  # noqa: F401
    from ..models import merchant_rule  # noqa: F401
    from ..models import plaid_import  # noqa: F401
    from ..models import staging_transaction  # noqa: F401
    from ..models import transaction  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()















