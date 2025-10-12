"""Enhance demo data with categorization and staging imports."""
import sqlite3
from pathlib import Path
from datetime import date, timedelta
import random

def enhance_demo_data():
    """Add categories to transactions and create staging imports."""
    db_path = Path(__file__).parent / "bt_app" / "demo.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("🔧 Enhancing demo data...")
        
        # Get category IDs
        cursor.execute("SELECT id, name FROM categories")
        categories = {name: id for id, name in cursor.fetchall()}
        
        print(f"✓ Found {len(categories)} categories")
        
        # Categorize 90% of transactions
        cursor.execute("SELECT id, merchant_norm FROM transactions WHERE amount < 0")
        expense_transactions = cursor.fetchall()
        
        # Define merchant -> category mapping
        merchant_category_map = {
            "Whole Foods Market": "Groceries",
            "Starbucks": "Coffee & Beverages",
            "Shell Gas Station": "Gas",
            "Netflix": "Subscriptions",
            "Spotify Premium": "Subscriptions",
            # Leave these uncategorized for demo:
            # "Chipotle Mexican Grill", "Panera Bread", "Five Guys"
        }
        
        categorized_count = 0
        for txn_id, merchant in expense_transactions:
            # 90% chance to categorize
            if random.random() < 0.9:
                category_name = merchant_category_map.get(merchant)
                if category_name and category_name in categories:
                    cursor.execute(
                        "UPDATE transactions SET category_id = ?, cleaned_final_merchant = ? WHERE id = ?",
                        (categories[category_name], merchant, txn_id)
                    )
                    categorized_count += 1
        
        # Categorize all income
        if "Income" in categories:
            cursor.execute(
                "UPDATE transactions SET category_id = ?, cleaned_final_merchant = ? WHERE amount > 0",
                (categories["Income"], "Payroll Deposit")
            )
        
        conn.commit()
        print(f"✓ Categorized {categorized_count} expense transactions")
        
        # Create staging imports with unique transactions
        print("\n📦 Creating staging imports...")
        
        # Get account IDs
        cursor.execute("SELECT id FROM accounts LIMIT 2")
        account_ids = [row[0] for row in cursor.fetchall()]
        
        staging_merchants = [
            ("Target", "TARGET #", (25, 120), "Shopping"),
            ("Amazon.com", "AMZN MKTP US*", (15, 250), "Shopping"),
            ("McDonald's", "MCDONALD'S #", (8, 15), "Dining Out"),
            ("Walmart", "WALMART SUPERCENTER #", (30, 180), "Groceries"),
            ("CVS Pharmacy", "CVS/PHARMACY #", (15, 75), "Health & Medical"),
            ("Uber", "UBER *TRIP", (12, 45), "Transportation"),
            ("Home Depot", "THE HOME DEPOT #", (40, 300), "Home & Garden"),
            ("Best Buy", "BEST BUY #", (50, 500), "Electronics"),
            ("Costco", "COSTCO WHSE #", (80, 250), "Groceries"),
            ("Dunkin'", "DUNKIN #", (3, 8), "Coffee & Beverages"),
        ]
        
        import_count = random.randint(5, 10)
        total_staging_txns = 0
        
        # Create different time periods for imports
        end_date = date.today()
        import_dates = [end_date - timedelta(days=d) for d in [5, 12, 18, 25, 35, 42, 50, 58, 65, 72]]
        
        for import_idx in range(import_count):
            import_date = import_dates[import_idx]
            txn_count = random.randint(20, 30)
            
            for txn_idx in range(txn_count):
                # Pick random merchant
                merchant, desc_prefix, price_range, hint_category = random.choice(staging_merchants)
                
                # Generate unique transaction date within 30 days before import
                txn_date = import_date - timedelta(days=random.randint(0, 30))
                
                # Random amount
                amount = -round(random.uniform(*price_range), 2)
                
                # Unique identifier to avoid deduplication
                unique_id = f"{import_idx}_{txn_idx}_{random.randint(1000, 9999)}"
                description = f"{desc_prefix}{random.randint(1000, 9999)}"
                hash_dedupe = f"staging_{merchant}_{txn_date}_{unique_id}"
                
                # Random account
                account_id = random.choice(account_ids)
                
                # Determine status (ready/needs_category/excluded)
                status_roll = random.random()
                if status_roll < 0.6:  # 60% ready
                    status = "ready"
                    category_id = categories.get(hint_category)
                    cleaned_merchant = merchant
                elif status_roll < 0.85:  # 25% needs_category
                    status = "needs_category"
                    category_id = None
                    cleaned_merchant = None
                else:  # 15% excluded
                    status = "excluded"
                    category_id = None
                    cleaned_merchant = None
                
                # Insert staging transaction with correct schema
                # import_id will be the import batch number
                import_batch_id = import_idx + 1
                
                cursor.execute("""
                    INSERT INTO staging_transactions 
                    (import_id, plaid_transaction_id, account_id, date, name, merchant_name, 
                     amount, currency, suggested_category_id, status, hash_key, 
                     created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                """, (
                    import_batch_id, 
                    f"staging_{unique_id}",  # plaid_transaction_id
                    account_id, 
                    txn_date.isoformat(),  # date
                    description,  # name
                    merchant,  # merchant_name
                    amount, 
                    "USD",
                    category_id,  # suggested_category_id
                    status, 
                    hash_dedupe  # hash_key
                ))
                
                total_staging_txns += 1
        
        conn.commit()
        print(f"✓ Created {import_count} staging imports with {total_staging_txns} transactions")
        
        # Show breakdown
        cursor.execute("SELECT status, COUNT(*) FROM staging_transactions GROUP BY status")
        status_breakdown = cursor.fetchall()
        for status, count in status_breakdown:
            print(f"  - {status}: {count} transactions")
        
        print("\n✅ Demo data enhancement complete!")
        print("🎭 Demo features now available:")
        print("  ✓ 90% of transactions are categorized")
        print("  ✓ 10% uncategorized for manual mapping demo")
        print(f"  ✓ {import_count} staging imports ready")
        print("  ✓ Income transactions visible in Income page")
        print("  ✓ Mapping Studio shows unmapped merchants")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    enhance_demo_data()

