#!/usr/bin/env python3
"""Quick test to see what database URL is being resolved."""

import os
import sys
from pathlib import Path

# Add the bt_app to the path
sys.path.insert(0, str(Path(__file__).parent))

# Set the environment variable like the start script does
os.environ["DATABASE_URL"] = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/app.db"

# Import and test the config
from bt_app.core.config import settings

print(f"Environment DATABASE_URL: {os.getenv('DATABASE_URL')}")
print(f"Settings database_url: {settings.database_url}")
print(f"Settings absolute_database_url: {settings.absolute_database_url}")

# Test if the file exists
abs_url = settings.absolute_database_url
if abs_url.startswith("sqlite:///"):
    db_path = abs_url.replace("sqlite:///", "")
    print(f"Database file path: {db_path}")
    print(f"File exists: {os.path.exists(db_path)}")
    
    # Test both forward and backslash versions
    print(f"Forward slash path exists: {os.path.exists(db_path.replace('\\', '/'))}")
    print(f"Backslash path exists: {os.path.exists(db_path.replace('/', '\\'))}")

# Try to create a SQLAlchemy engine
try:
    from sqlalchemy import create_engine
    engine = create_engine(abs_url, connect_args={"check_same_thread": False})
    print("Engine created successfully!")
    
    # Try to connect
    with engine.connect() as conn:
        print("Database connection successful!")
        result = conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 5;")
        tables = [row[0] for row in result]
        print(f"Tables found: {tables}")
        
except Exception as e:
    print(f"Database error: {e}")