"""Seed script for development data."""
import os
import sys
from datetime import datetime, date, timedelta
from decimal import Decimal
import random

# Add the app directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.core.db import SessionLocal
from app.models.category import Category
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.merchant_rule import MerchantRule, RuleType
from app.models.institution_item import InstitutionItem
from app.services.mapping_service import MappingService


def seed_accounts():
    """Seed demo accounts."""
    db = SessionLocal()
    try:
        # Create a demo institution item
        institution = InstitutionItem(
            institution_name="Demo Bank",
            plaid_item_id="demo_item_123",
            access_token_encrypted="demo_encrypted_token"
        )
        db.add(institution)
        db.flush()
        
        # Create demo accounts
        accounts = [
            Account(
                institution_item_id=institution.id,
                name="Checking Account",
                mask="1234",
                official_name="Personal Checking",
                currency="CAD",
                account_type="depository"
            ),
            Account(
                institution_item_id=institution.id,
                name="Credit Card",
                mask="5678",
                official_name="Cashback Mastercard",
                currency="CAD",
                account_type="credit"
            ),
            Account(
                institution_item_id=institution.id,
                name="Savings Account",
                mask="9012",
                official_name="High Interest Savings",
                currency="CAD",
                account_type="depository"
            )
        ]
        
        for account in accounts:
            db.add(account)
        
        db.commit()
        print(f"✓ Seeded {len(accounts)} accounts")
        return accounts
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding accounts: {e}")
        return []
    finally:
        db.close()


def seed_sample_transactions(accounts):
    """Seed sample transactions."""
    if not accounts:
        print("✗ No accounts available for transactions")
        return
    
    db = SessionLocal()
    mapping_service = MappingService(db)
    
    try:
        # Sample merchant data
        merchants = [
            ("Walmart Supercenter #1234", "Groceries"),
            ("Starbucks Coffee #567", "Coffee"),
            ("Shell Gas Station", "Gas"),
            ("McDonald's Restaurant", "Dining"),
            ("Amazon.ca Purchase", "Shopping"),
            ("Tim Hortons #890", "Coffee"),
            ("Metro Grocery Store", "Groceries"),
            ("Canadian Tire Store", "Shopping"),
            ("Shoppers Drug Mart", "Health"),
            ("Boston Pizza", "Dining"),
            ("Costco Wholesale", "Groceries"),
            ("Home Depot", "Home"),
            ("Best Buy Electronics", "Shopping"),
            ("Subway Restaurant", "Dining"),
            ("Petro Canada", "Gas")
        ]
        
        # Generate transactions for the last 3 months
        end_date = date.today()
        start_date = end_date - timedelta(days=90)
        
        transactions = []
        for i in range(200):  # Generate 200 sample transactions
            # Random date in the last 3 months
            days_back = random.randint(0, 90)
            transaction_date = end_date - timedelta(days=days_back)
            
            # Random merchant
            merchant_raw, category_hint = random.choice(merchants)
            
            # Random amount based on category hint
            if category_hint in ["Coffee"]:
                amount = -random.uniform(3, 8)
            elif category_hint in ["Gas"]:
                amount = -random.uniform(30, 80)
            elif category_hint in ["Groceries"]:
                amount = -random.uniform(20, 150)
            elif category_hint in ["Dining"]:
                amount = -random.uniform(15, 60)
            elif category_hint in ["Shopping"]:
                amount = -random.uniform(25, 300)
            else:
                amount = -random.uniform(10, 100)
            
            # Normalize merchant
            merchant_norm = mapping_service.normalize_merchant(merchant_raw, None)
            
            # Generate hash
            account = random.choice(accounts)
            hash_dedupe = mapping_service.generate_transaction_hash(
                account.id, str(transaction_date), Decimal(str(amount)), merchant_norm, merchant_raw
            )
            
            transaction = Transaction(
                account_id=account.id,
                posted_date=transaction_date,
                amount=Decimal(str(amount)),
                currency="CAD",
                merchant_raw=merchant_raw,
                description_raw=merchant_raw,
                merchant_norm=merchant_norm,
                source="demo",
                hash_dedupe=hash_dedupe
            )
            transactions.append(transaction)
        
        # Add some income transactions
        for i in range(3):  # 3 salary payments
            salary_date = date.today().replace(day=1) - timedelta(days=30*i)
            transaction = Transaction(
                account_id=accounts[0].id,  # Checking account
                posted_date=salary_date,
                amount=Decimal("4500.00"),  # Salary
                currency="CAD",
                merchant_raw="ACME Corp Direct Deposit",
                description_raw="Salary Payment",
                merchant_norm="acme corp direct deposit",
                source="demo",
                hash_dedupe=mapping_service.generate_transaction_hash(
                    accounts[0].id, str(salary_date), Decimal("4500.00"), "acme corp direct deposit", "Salary Payment"
                )
            )
            transactions.append(transaction)
        
        for transaction in transactions:
            db.add(transaction)
        
        db.commit()
        print(f"✓ Seeded {len(transactions)} transactions")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding transactions: {e}")
    finally:
        db.close()


def seed_sample_rules():
    """Seed sample merchant mapping rules."""
    db = SessionLocal()
    try:
        # Get some categories for mapping
        groceries_cat = db.query(Category).filter(Category.name == "Groceries").first()
        coffee_cat = db.query(Category).filter(Category.name == "Coffee & Beverages").first()
        gas_cat = db.query(Category).filter(Category.name == "Gas").first()
        dining_cat = db.query(Category).filter(Category.name == "Dining Out").first()
        shopping_cat = db.query(Category).filter(Category.name == "Shopping").first()
        
        if not all([groceries_cat, coffee_cat, gas_cat, dining_cat, shopping_cat]):
            print("✗ Required categories not found for rules")
            return
        
        rules = [
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="walmart",
                merchant_norm="Walmart",
                category_id=groceries_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="starbucks",
                merchant_norm="Starbucks",
                category_id=coffee_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="tim hortons",
                merchant_norm="Tim Hortons",
                category_id=coffee_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="shell",
                merchant_norm="Shell",
                category_id=gas_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="mcdonalds",
                merchant_norm="McDonald's",
                category_id=dining_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="amazon",
                merchant_norm="Amazon",
                category_id=shopping_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="metro",
                merchant_norm="Metro",
                category_id=groceries_cat.id,
                priority=10
            ),
            MerchantRule(
                rule_type=RuleType.CONTAINS,
                pattern="costco",
                merchant_norm="Costco",
                category_id=groceries_cat.id,
                priority=10
            )
        ]
        
        for rule in rules:
            db.add(rule)
        
        db.commit()
        print(f"✓ Seeded {len(rules)} mapping rules")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding rules: {e}")
    finally:
        db.close()


def seed_sample_budgets():
    """Seed sample budgets."""
    db = SessionLocal()
    try:
        current_month = datetime.now().strftime("%Y-%m")
        
        # Budget amounts by category name
        budget_data = [
            ("Groceries", 800),
            ("Dining Out", 300),
            ("Gas", 200),
            ("Coffee & Beverages", 100),
            ("Shopping", 500),
            ("Utilities", 250),
            ("Entertainment", 200),
            ("Health & Medical", 150)
        ]
        
        budgets = []
        for category_name, amount in budget_data:
            category = db.query(Category).filter(Category.name == category_name).first()
            if category:
                budget = Budget(
                    category_id=category.id,
                    month=current_month,
                    amount=Decimal(str(amount))
                )
                budgets.append(budget)
                db.add(budget)
        
        db.commit()
        print(f"✓ Seeded {len(budgets)} budgets for {current_month}")
        
    except Exception as e:
        db.rollback()
        print(f"✗ Error seeding budgets: {e}")
    finally:
        db.close()


def main():
    """Run all seeding functions."""
    print("🌱 Starting database seeding...")
    
    # Seed accounts first
    accounts = seed_accounts()
    
    # Seed sample transactions
    seed_sample_transactions(accounts)
    
    # Seed mapping rules
    seed_sample_rules()
    
    # Apply rules to map transactions
    db = SessionLocal()
    mapping_service = MappingService(db)
    try:
        results = mapping_service.apply_rules_to_unmapped()
        print(f"✓ Applied mapping rules: {results['mapped_count']} transactions mapped")
    except Exception as e:
        print(f"✗ Error applying rules: {e}")
    finally:
        db.close()
    
    # Seed sample budgets
    seed_sample_budgets()
    
    print("🎉 Database seeding completed!")


if __name__ == "__main__":
    main()



















