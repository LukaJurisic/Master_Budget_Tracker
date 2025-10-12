"""Quick SQL-based demo seeder - bypasses ORM relationship issues."""
import sqlite3
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal
import random

def seed_demo_sql():
    """Seed demo data using raw SQL."""
    db_path = Path(__file__).parent / "bt_app" / "demo.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🌱 Seeding demo data with SQL...")
        
        # Insert institutions
        cursor.execute("""
            INSERT INTO institution_items (institution_name, plaid_item_id, access_token_encrypted, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
        """, ("Demo Chase Bank", "demo_chase_123", "demo_token_chase"))
        chase_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO institution_items (institution_name, plaid_item_id, access_token_encrypted, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
        """, ("Demo Capital One", "demo_capital_456", "demo_token_capital"))
        capital_id = cursor.lastrowid
        
        print(f"✓ Created 2 demo institutions")
        
        # Insert accounts
        cursor.execute("""
            INSERT INTO accounts (institution_item_id, plaid_account_id, name, mask, official_name, currency, account_type, is_enabled_for_import, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (chase_id, "demo_checking", "Personal Checking", "4891", "Chase Total Checking", "USD", "depository", 1))
        checking_id = cursor.lastrowid
        
        cursor.execute("""
            INSERT INTO accounts (institution_item_id, plaid_account_id, name, mask, official_name, currency, account_type, is_enabled_for_import, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """, (capital_id, "demo_credit", "Quicksilver Credit", "3201", "Capital One Quicksilver", "USD", "credit", 1))
        credit_id = cursor.lastrowid
        
        print(f"✓ Created 2 demo accounts")
        
        # Generate transactions
        end_date = date.today()
        start_date = end_date - timedelta(days=365)
        txn_count = 0
        
        # Helper to insert transaction
        def insert_txn(account_id, posted_date, amount, merchant, description, txn_type=None):
            # Auto-detect txn_type based on amount if not specified
            if txn_type is None:
                txn_type = 'income' if amount > 0 else 'expense'
            
            cursor.execute("""
                INSERT INTO transactions (account_id, posted_date, amount, currency, merchant_raw, description_raw, merchant_norm, source, hash_dedupe, txn_type, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            """, (account_id, posted_date.isoformat(), float(amount), "USD", merchant, description, merchant, "demo", f"demo_{merchant}_{posted_date}_{random.randint(1, 9999)}", txn_type))
        
        # Generate transactions
        current = start_date
        while current <= end_date:
            # Bi-weekly income
            if current.weekday() == 4 and (current.day <= 15 or current.day > 15):
                insert_txn(checking_id, current, 2250.00, "Direct Deposit - Employer", "DIRECT DEP PAYROLL")
                txn_count += 1
            
            # Weekly groceries (Saturdays)
            if current.weekday() == 5 and random.random() < 0.8:
                amount = -round(random.uniform(45, 150), 2)
                insert_txn(checking_id, current, amount, "Whole Foods Market", f"WHOLE FOODS MARKET #{random.randint(1000, 9999)}")
                txn_count += 1
            
            # Daily coffee (weekdays, 60% chance)
            if current.weekday() < 5 and random.random() < 0.6:
                amount = -round(random.uniform(4, 8), 2)
                insert_txn(credit_id, current, amount, "Starbucks", f"STARBUCKS #{random.randint(100, 999)}")
                txn_count += 1
            
            # Dining (3-4x/week)
            if random.random() < 0.5:
                amount = -round(random.uniform(12, 45), 2)
                merchants = ["Chipotle Mexican Grill", "Panera Bread", "Five Guys"]
                merchant = random.choice(merchants)
                insert_txn(credit_id, current, amount, merchant, f"{merchant.upper()} RESTAURANT")
                txn_count += 1
            
            # Gas (Sundays)
            if current.weekday() == 6:
                amount = -round(random.uniform(35, 65), 2)
                insert_txn(checking_id, current, amount, "Shell Gas Station", f"SHELL GAS #{random.randint(1, 999)}")
                txn_count += 1
            
            current += timedelta(days=1)
        
        # Monthly subscriptions
        current = start_date
        while current <= end_date:
            if current.day == 5:
                insert_txn(credit_id, current, -15.49, "Netflix", "NETFLIX MEMBERSHIP")
                txn_count += 1
            if current.day == 15:
                insert_txn(credit_id, current, -10.99, "Spotify Premium", "SPOTIFY PREMIUM MEMBERSHIP")
                txn_count += 1
            current += timedelta(days=1)
        
        conn.commit()
        print(f"✓ Created {txn_count} demo transactions")
        
        print("\n✅ Demo database ready!")
        print(f"📍 Location: {db_path}")
        print("🚀 Start with: .\\start_demo.ps1")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    seed_demo_sql()

