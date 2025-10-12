"""Seed comprehensive demo data for presentations and testing.

This script generates 12 months of realistic transaction data with:
- Real merchant names
- Fake but realistic amounts
- Patterns that showcase the Mapping Studio automation
- Unmapped transactions to demonstrate categorization
- Various transaction types and frequencies
"""
import sys
import os
from pathlib import Path
from datetime import datetime, date, timedelta
from decimal import Decimal
import random

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from bt_app.models.institution_item import InstitutionItem
from bt_app.models.account import Account
from bt_app.models.transaction import Transaction
from bt_app.models.category import Category
from bt_app.models.merchant_rule import MerchantRule, RuleType
from bt_app.models.budget import Budget
from bt_app.services.mapping_service import MappingService


def seed_demo_institutions_and_accounts(session):
    """Create fake bank institutions and accounts."""
    print("\n📦 Seeding demo institutions and accounts...")
    
    # Institution 1: Demo Chase Bank
    chase = InstitutionItem(
        institution_name="Demo Chase Bank",
        plaid_item_id="demo_chase_prod_123456",
        access_token_encrypted="demo_fake_token_not_functional_chase"
    )
    session.add(chase)
    session.flush()
    
    # Institution 2: Demo Capital One
    capital_one = InstitutionItem(
        institution_name="Demo Capital One",
        plaid_item_id="demo_capone_prod_789012",
        access_token_encrypted="demo_fake_token_not_functional_capone"
    )
    session.add(capital_one)
    session.flush()
    
    # Institution 3: Demo TD Bank
    td_bank = InstitutionItem(
        institution_name="Demo TD Bank",
        plaid_item_id="demo_td_prod_345678",
        access_token_encrypted="demo_fake_token_not_functional_td"
    )
    session.add(td_bank)
    session.flush()
    
    # Accounts
    accounts = [
        Account(
            institution_item_id=chase.id,
            plaid_account_id="demo_acct_chase_checking",
            name="Personal Checking",
            mask="4891",
            official_name="Chase Total Checking®",
            currency="USD",
            account_type="depository",
            is_enabled_for_import=True
        ),
        Account(
            institution_item_id=capital_one.id,
            plaid_account_id="demo_acct_capone_credit",
            name="Quicksilver Credit Card",
            mask="3201",
            official_name="Capital One Quicksilver Cash Rewards",
            currency="USD",
            account_type="credit",
            is_enabled_for_import=True
        ),
        Account(
            institution_item_id=td_bank.id,
            plaid_account_id="demo_acct_td_savings",
            name="High-Yield Savings",
            mask="7654",
            official_name="TD Bank High-Yield Savings Account",
            currency="USD",
            account_type="depository",
            is_enabled_for_import=True
        ),
        Account(
            institution_item_id=chase.id,
            plaid_account_id="demo_acct_chase_credit",
            name="Freedom Unlimited®",
            mask="9102",
            official_name="Chase Freedom Unlimited",
            currency="USD",
            account_type="credit",
            is_enabled_for_import=True
        ),
    ]
    
    for account in accounts:
        session.add(account)
    
    session.commit()
    print(f"✓ Created {len(accounts)} demo accounts across 3 institutions")
    return accounts


def generate_demo_transactions(session, accounts):
    """Generate 12 months of realistic demo transactions."""
    print("\n💳 Generating 12 months of demo transactions...")
    
    # Merchant templates with realistic pricing
    merchants = {
        # Groceries (weekly, varying amounts)
        "groceries": [
            ("Whole Foods Market", (45, 150)),
            ("Trader Joe's", (35, 95)),
            ("Walmart Supercenter", (50, 180)),
            ("Costco Wholesale", (80, 250)),
            ("Target", (30, 120)),
            ("Kroger", (40, 110)),
        ],
        # Coffee & Dining (frequent, small amounts)
        "coffee": [
            ("Starbucks", (4, 8)),
            ("Dunkin'", (3, 7)),
            ("Local Coffee Shop", (5, 10)),
            ("Peet's Coffee", (4, 9)),
        ],
        # Restaurants (weekly, medium amounts)
        "dining": [
            ("Chipotle Mexican Grill", (12, 18)),
            ("Panera Bread", (10, 16)),
            ("Olive Garden", (25, 50)),
            ("The Cheesecake Factory", (35, 75)),
            ("Local Restaurant", (20, 60)),
            ("Subway", (8, 14)),
            ("Five Guys", (15, 22)),
        ],
        # Gas (weekly, consistent)
        "gas": [
            ("Shell", (35, 65)),
            ("Chevron", (38, 68)),
            ("BP", (33, 60)),
            ("Exxon", (36, 66)),
        ],
        # Subscriptions (monthly, exact amounts)
        "subscriptions": [
            ("Netflix", (15.49,)),
            ("Spotify Premium", (10.99,)),
            ("Amazon Prime", (14.99,)),
            ("Disney+", (7.99,)),
            ("Apple iCloud", (2.99,)),
            ("YouTube Premium", (11.99,)),
            ("HBO Max", (15.99,)),
        ],
        # Utilities (monthly, varying)
        "utilities": [
            ("Electric Company", (80, 160)),
            ("Water Utility", (30, 70)),
            ("Internet Provider", (60, 90)),
            ("Gas Company", (50, 120)),
        ],
        # Transportation
        "transportation": [
            ("Uber", (12, 35)),
            ("Lyft", (15, 40)),
            ("City Parking", (5, 25)),
            ("Gas Station", (40, 70)),
        ],
        # Shopping (occasional, varying)
        "shopping": [
            ("Amazon.com", (15, 200)),
            ("Best Buy", (50, 500)),
            ("Home Depot", (30, 250)),
            ("Macy's", (40, 180)),
            ("IKEA", (60, 350)),
        ],
        # Health & Fitness
        "health": [
            ("CVS Pharmacy", (15, 60)),
            ("Planet Fitness", (10,)),
            ("Massage Envy", (70, 100)),
        ],
    }
    
    # Generate transactions for the last 12 months
    end_date = date.today()
    start_date = end_date - timedelta(days=365)
    
    transactions = []
    transaction_count = 0
    
    # Generate bi-weekly income (salary)
    current_date = start_date
    while current_date <= end_date:
        # Check if it's a payday (every other Friday)
        if current_date.weekday() == 4 and (current_date.day <= 15 or current_date.day > 15):
            account = random.choice([acc for acc in accounts if acc.account_type == "depository"])
            amount = Decimal("2250.00")  # Bi-weekly salary
            merchant = "Direct Deposit - Employer"
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"DIRECT DEP {merchant.upper()}",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_income_{current_date}_{account.id}"
            ))
            transaction_count += 1
        
        current_date += timedelta(days=1)
    
    # Generate recurring subscriptions (monthly on specific days)
    for i, (service, price_range) in enumerate(merchants["subscriptions"]):
        subscription_day = (i * 3 + 5) % 28 + 1  # Spread across month
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.day == subscription_day:
                account = random.choice([acc for acc in accounts if acc.account_type == "credit"])
                amount = -Decimal(str(price_range[0]))
                
                transactions.append(Transaction(
                    account_id=account.id,
                    posted_date=current_date,
                    amount=amount,
                    currency="USD",
                    merchant_raw=service,
                    description_raw=f"{service.upper()} MEMBERSHIP",
                    merchant_norm=service,
                    source="demo",
                    hash_dedupe=f"demo_sub_{service}_{current_date}_{account.id}"
                ))
                transaction_count += 1
            
            current_date += timedelta(days=1)
    
    # Generate weekly/frequent transactions
    current_date = start_date
    while current_date <= end_date:
        day_of_week = current_date.weekday()
        
        # Groceries (twice a week: Saturday and Wednesday)
        if day_of_week in [2, 5]:
            merchant, price_range = random.choice(merchants["groceries"])
            account = random.choice(accounts)
            amount = -Decimal(str(round(random.uniform(*price_range), 2)))
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"{merchant.upper()} #{random.randint(1000, 9999)}",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_{merchant}_{current_date}_{account.id}_{abs(amount)}"
            ))
            transaction_count += 1
        
        # Coffee (weekdays, 60% chance)
        if day_of_week < 5 and random.random() < 0.6:
            merchant, price_range = random.choice(merchants["coffee"])
            account = random.choice([acc for acc in accounts if acc.account_type == "credit"])
            amount = -Decimal(str(round(random.uniform(*price_range), 2)))
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"{merchant.upper()} #{random.randint(100, 999)}",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_{merchant}_{current_date}_{account.id}_{abs(amount)}_{ random.randint(1,999)}"
            ))
            transaction_count += 1
        
        # Dining out (3-4 times per week)
        if random.random() < 0.5:
            merchant, price_range = random.choice(merchants["dining"])
            account = random.choice(accounts)
            amount = -Decimal(str(round(random.uniform(*price_range), 2)))
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"{merchant.upper()} RESTAURANT",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_{merchant}_{current_date}_{account.id}_{abs(amount)}"
            ))
            transaction_count += 1
        
        # Gas (once a week on Sunday)
        if day_of_week == 6:
            merchant, price_range = random.choice(merchants["gas"])
            account = random.choice(accounts)
            amount = -Decimal(str(round(random.uniform(*price_range), 2)))
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"{merchant.upper()} #{random.randint(1, 999)}",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_{merchant}_{current_date}_{account.id}_{abs(amount)}"
            ))
            transaction_count += 1
        
        current_date += timedelta(days=1)
    
    # Generate monthly utilities (on 1st, 10th, 15th, 20th)
    for utility, price_range in merchants["utilities"]:
        payment_day = random.choice([1, 10, 15, 20])
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.day == payment_day:
                account = random.choice([acc for acc in accounts if acc.account_type == "depository"])
                amount = -Decimal(str(round(random.uniform(*price_range), 2)))
                
                transactions.append(Transaction(
                    account_id=account.id,
                    posted_date=current_date,
                    amount=amount,
                    currency="USD",
                    merchant_raw=utility,
                    description_raw=f"AUTO PAY {utility.upper()}",
                    merchant_norm=utility,
                    source="demo",
                    hash_dedupe=f"demo_{utility}_{current_date}_{account.id}"
                ))
                transaction_count += 1
            
            current_date += timedelta(days=1)
    
    # Add occasional shopping transactions
    current_date = start_date
    while current_date <= end_date:
        if random.random() < 0.15:  # 15% chance per day
            merchant, price_range = random.choice(merchants["shopping"])
            account = random.choice(accounts)
            amount = -Decimal(str(round(random.uniform(*price_range), 2)))
            
            transactions.append(Transaction(
                account_id=account.id,
                posted_date=current_date,
                amount=amount,
                currency="USD",
                merchant_raw=merchant,
                description_raw=f"{merchant.upper()} PURCHASE",
                merchant_norm=merchant,
                source="demo",
                hash_dedupe=f"demo_{merchant}_{current_date}_{account.id}_{abs(amount)}"
            ))
            transaction_count += 1
        
        current_date += timedelta(days=1)
    
    # Add all transactions to session
    for txn in transactions:
        session.add(txn)
    
    session.commit()
    print(f"✓ Generated {transaction_count} demo transactions over 12 months")
    return transactions


def seed_mapping_rules(session):
    """Create merchant mapping rules to showcase automation."""
    print("\n📋 Seeding mapping rules for demo...")
    
    # Get categories
    categories = {cat.name: cat for cat in session.query(Category).all()}
    
    rules = [
        # Groceries
        MerchantRule(
            pattern="Whole Foods",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Groceries").id if categories.get("Groceries") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Trader Joe",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Groceries").id if categories.get("Groceries") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Walmart",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Groceries").id if categories.get("Groceries") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Costco",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Groceries").id if categories.get("Groceries") else None,
            is_active=True
        ),
        # Coffee
        MerchantRule(
            pattern="Starbucks",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Coffee & Beverages").id if categories.get("Coffee & Beverages") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Dunkin",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Coffee & Beverages").id if categories.get("Coffee & Beverages") else None,
            is_active=True
        ),
        # Dining
        MerchantRule(
            pattern="Chipotle",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Dining Out").id if categories.get("Dining Out") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Restaurant",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Dining Out").id if categories.get("Dining Out") else None,
            is_active=True
        ),
        # Gas
        MerchantRule(
            pattern="Shell",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Gas").id if categories.get("Gas") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Chevron",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Gas").id if categories.get("Gas") else None,
            is_active=True
        ),
        # Subscriptions
        MerchantRule(
            pattern="Netflix",
            rule_type=RuleType.EXACT,
            category_id=categories.get("Subscriptions").id if categories.get("Subscriptions") else None,
            is_active=True
        ),
        MerchantRule(
            pattern="Spotify",
            rule_type=RuleType.CONTAINS,
            category_id=categories.get("Subscriptions").id if categories.get("Subscriptions") else None,
            is_active=True
        ),
        # Leave some unmapped to demonstrate the Mapping Studio!
        # Don't map: Panera, Olive Garden, Target, Best Buy, etc.
    ]
    
    for rule in rules:
        session.add(rule)
    
    session.commit()
    print(f"✓ Created {len(rules)} mapping rules (leaving some merchants unmapped for demo)")
    return rules


def apply_rules_to_transactions(session):
    """Apply mapping rules to categorize transactions."""
    print("\n🔄 Applying mapping rules to transactions...")
    
    mapping_service = MappingService(session)
    results = mapping_service.apply_rules_to_unmapped()
    
    print(f"✓ Mapped {results['mapped_count']} transactions")
    print(f"✓ Remaining unmapped: {results['unmapped_count']} (for Mapping Studio demo)")
    return results


def seed_budgets(session):
    """Create sample budgets for current and recent months."""
    print("\n💰 Seeding demo budgets...")
    
    # Get categories
    categories = {cat.name: cat for cat in session.query(Category).all()}
    
    # Create budgets for last 3 months
    current_date = date.today()
    months = [
        (current_date - timedelta(days=60)).strftime("%Y-%m"),
        (current_date - timedelta(days=30)).strftime("%Y-%m"),
        current_date.strftime("%Y-%m"),
    ]
    
    budget_amounts = {
        "Groceries": 600,
        "Dining Out": 350,
        "Gas": 180,
        "Coffee & Beverages": 80,
        "Shopping": 400,
        "Utilities": 300,
        "Subscriptions": 100,
        "Transportation": 150,
        "Health & Medical": 120,
    }
    
    budget_count = 0
    for month in months:
        for category_name, amount in budget_amounts.items():
            category = categories.get(category_name)
            if category:
                budget = Budget(
                    category_id=category.id,
                    month=month,
                    amount=Decimal(str(amount))
                )
                session.add(budget)
                budget_count += 1
    
    session.commit()
    print(f"✓ Created {budget_count} budgets across {len(months)} months")


def main():
    """Run demo data seeding."""
    print("🌱 Starting Demo Data Seeding...")
    print("=" * 60)
    
    # Connect to demo database
    db_path = Path(__file__).parent / "bt_app" / "demo.db"
    db_url = f"sqlite:///{db_path.as_posix()}"
    
    engine = create_engine(db_url, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Seed in order
        accounts = seed_demo_institutions_and_accounts(session)
        transactions = generate_demo_transactions(session, accounts)
        rules = seed_mapping_rules(session)
        apply_results = apply_rules_to_transactions(session)
        seed_budgets(session)
        
        print("\n" + "=" * 60)
        print("🎉 Demo Data Seeding Completed!")
        print(f"📍 Database: {db_path}")
        print(f"📊 Ready for demo mode with realistic data!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()

