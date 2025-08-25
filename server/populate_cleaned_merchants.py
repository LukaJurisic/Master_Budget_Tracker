#!/usr/bin/env python3
"""Script to populate cleaned_final_merchant column for all existing transactions."""

import os
import sys
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Load environment variables
from dotenv import load_dotenv
load_dotenv(project_root / ".env", override=True)

from bt_app.core.db import SessionLocal
from bt_app.utils.merchant_cleaner import populate_cleaned_final_merchant


def main():
    """Populate cleaned_final_merchant for all transactions."""
    print("Starting merchant name cleaning process...")
    
    # Create database session
    session = SessionLocal()
    
    try:
        # Populate the cleaned merchant names
        updated_count = populate_cleaned_final_merchant(session)
        print(f"✅ Successfully updated {updated_count} transactions")
        
    except Exception as e:
        print(f"❌ Error updating merchant names: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()