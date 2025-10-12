"""Clear all existing data from demo database before seeding."""
import sys
import os
from pathlib import Path

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def clear_demo_data():
    """Clear all data from demo database."""
    db_path = Path(__file__).parent / "bt_app" / "demo.db"
    db_url = f"sqlite:///{db_path.as_posix()}"
    
    engine = create_engine(db_url, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🗑️  Clearing existing data from demo database...")
        
        # Delete in order to respect foreign key constraints
        tables_to_clear = [
            "staging_transactions",
            "plaid_imports",
            "budgets",
            "merchant_rules",
            "transactions",
            "accounts",
            "institution_items",
            # Don't clear categories - they're needed
        ]
        
        for table in tables_to_clear:
            result = session.execute(text(f"DELETE FROM {table}"))
            print(f"  ✓ Cleared {result.rowcount} rows from {table}")
        
        session.commit()
        print("✓ Demo database cleared successfully!")
        
    except Exception as e:
        print(f"❌ Error clearing data: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    clear_demo_data()

