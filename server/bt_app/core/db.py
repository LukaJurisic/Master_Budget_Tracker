"""Database configuration and session management."""
import logging
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

DB_URL = settings.absolute_database_url

# If it's sqlite, make sure the directory exists, verify file exists and has data
if DB_URL.startswith("sqlite:///"):
    assert DB_URL.startswith("sqlite:///"), f"Unexpected DB_URL: {DB_URL}"
    db_path = Path(DB_URL.replace("sqlite:///", ""))  # absolute now
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    if not db_path.exists() or db_path.stat().st_size == 0:
        raise RuntimeError(f"SQLite file missing or empty: {db_path}")
    
    logging.getLogger(__name__).info("Opening SQLite: %s (size=%s)", 
                                     db_path, db_path.stat().st_size)

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()















