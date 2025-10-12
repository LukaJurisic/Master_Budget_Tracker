"""Create a clean demo database template with schema only (no data)."""
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from bt_app.models.base import Base

def create_demo_template():
    """Create demo_template.db with schema only."""
    # Path to demo template database
    db_path = Path(__file__).parent / "bt_app" / "demo_template.db"
    
    # Remove if exists
    if db_path.exists():
        db_path.unlink()
        print(f"✓ Removed existing {db_path}")
    
    # Create engine
    db_url = f"sqlite:///{db_path.as_posix()}"
    engine = create_engine(db_url, echo=False)
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print(f"✓ Created demo template database at {db_path}")
    print(f"✓ Schema created with {len(Base.metadata.tables)} tables")
    print("✓ Ready for seeding with seed_demo_data.py")

if __name__ == "__main__":
    create_demo_template()

