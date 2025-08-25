"""FTS5 setup utility for transaction search."""
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def setup_fts5(db_path: str) -> bool:
    """Setup FTS5 virtual table and triggers for transactions."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if FTS table already exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='txn_fts'")
        if cursor.fetchone():
            logger.info("FTS5 table txn_fts already exists")
            conn.close()
            return True
        
        logger.info("Creating FTS5 virtual table for transactions...")
        
        # Create FTS5 virtual table
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS txn_fts USING fts5(
                description, 
                merchant, 
                content='transactions', 
                content_rowid='id'
            )
        """)
        
        # Populate initial data
        cursor.execute("""
            INSERT INTO txn_fts(rowid, description, merchant) 
            SELECT id, description_raw, merchant_raw 
            FROM transactions 
            WHERE description_raw IS NOT NULL OR merchant_raw IS NOT NULL
        """)
        
        # Create triggers to maintain FTS sync
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS txn_ai AFTER INSERT ON transactions BEGIN
                INSERT INTO txn_fts(rowid, description, merchant) 
                VALUES (new.id, new.description_raw, new.merchant_raw);
            END
        """)
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS txn_ad AFTER DELETE ON transactions BEGIN
                INSERT INTO txn_fts(txn_fts, rowid, description, merchant) 
                VALUES('delete', old.id, old.description_raw, old.merchant_raw);
            END
        """)
        
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS txn_au AFTER UPDATE ON transactions BEGIN
                INSERT INTO txn_fts(txn_fts, rowid, description, merchant) 
                VALUES('delete', old.id, old.description_raw, old.merchant_raw);
                INSERT INTO txn_fts(rowid, description, merchant) 
                VALUES (new.id, new.description_raw, new.merchant_raw);
            END
        """)
        
        conn.commit()
        conn.close()
        
        logger.info("FTS5 setup completed successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to setup FTS5: {e}")
        return False


def search_transactions_fts(db_path: str, query: str, limit: int = 100) -> list:
    """Search transactions using FTS5."""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Use FTS5 MATCH query
        cursor.execute("""
            SELECT t.id, t.posted_date, t.merchant_raw, t.description_raw, t.amount, t.source
            FROM txn_fts f
            JOIN transactions t ON t.id = f.rowid
            WHERE txn_fts MATCH ?
            ORDER BY t.posted_date DESC
            LIMIT ?
        """, (query, limit))
        
        results = cursor.fetchall()
        conn.close()
        return results
        
    except Exception as e:
        logger.error(f"FTS search failed: {e}")
        return []