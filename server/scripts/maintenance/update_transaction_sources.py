#!/usr/bin/env python3
"""
Script to update transaction sources based on account names.

This script will:
1. Query all transactions with their account names
2. Apply the account-to-source mapping
3. Update transactions where the source doesn't match the expected mapping
4. Provide detailed reporting of changes made
"""
import sys
sys.path.append('.')

from app.core.db import SessionLocal
from app.models.transaction import Transaction
from app.models.account import Account
from app.utils.account_mapping import get_source_from_account_name
from sqlalchemy import text
from datetime import datetime


def update_transaction_sources(dry_run: bool = True) -> dict:
    """
    Update transaction sources based on account names.
    
    Args:
        dry_run: If True, only show what would be changed without making changes
        
    Returns:
        Dictionary with update statistics
    """
    db = SessionLocal()
    stats = {
        "total_transactions": 0,
        "transactions_to_update": 0,
        "transactions_updated": 0,
        "updates_by_account": {},
        "source_changes": {},
        "errors": []
    }
    
    try:
        # Get all transactions with account information
        print("Fetching all transactions with account information...")
        query = """
            SELECT t.id, t.source, a.name as account_name, a.id as account_id
            FROM transactions t 
            JOIN accounts a ON t.account_id = a.id 
            ORDER BY a.name, t.id
        """
        
        results = db.execute(text(query)).fetchall()
        stats["total_transactions"] = len(results)
        
        print(f"Found {stats['total_transactions']} transactions to analyze")
        print("-" * 60)
        
        updates_needed = []
        
        # Analyze what needs to be updated
        for row in results:
            transaction_id = row.id
            current_source = row.source
            account_name = row.account_name
            account_id = row.account_id
            
            # Determine what the source should be based on account name
            expected_source = get_source_from_account_name(account_name)
            
            # Track by account
            if account_name not in stats["updates_by_account"]:
                stats["updates_by_account"][account_name] = {
                    "total": 0,
                    "needs_update": 0,
                    "current_sources": {},
                    "expected_source": expected_source
                }
            
            stats["updates_by_account"][account_name]["total"] += 1
            
            # Count current source distribution
            if current_source not in stats["updates_by_account"][account_name]["current_sources"]:
                stats["updates_by_account"][account_name]["current_sources"][current_source] = 0
            stats["updates_by_account"][account_name]["current_sources"][current_source] += 1
            
            # Check if update is needed
            if current_source != expected_source:
                stats["transactions_to_update"] += 1
                stats["updates_by_account"][account_name]["needs_update"] += 1
                
                change_key = f"{current_source} -> {expected_source}"
                if change_key not in stats["source_changes"]:
                    stats["source_changes"][change_key] = 0
                stats["source_changes"][change_key] += 1
                
                updates_needed.append({
                    "id": transaction_id,
                    "current_source": current_source,
                    "expected_source": expected_source,
                    "account_name": account_name,
                    "account_id": account_id
                })
        
        # Print analysis results
        print("ANALYSIS RESULTS:")
        print("=" * 60)
        print(f"Total transactions: {stats['total_transactions']}")
        print(f"Transactions needing updates: {stats['transactions_to_update']}")
        
        if stats["transactions_to_update"] > 0:
            print(f"")
            print("Source changes to be made:")
            for change, count in stats["source_changes"].items():
                print(f"  {change}: {count} transactions")
            
            print(f"")
            print("Updates by account:")
            for account_name, info in stats["updates_by_account"].items():
                if info["needs_update"] > 0:
                    print(f"  \"{account_name}\":")
                    print(f"    Total transactions: {info['total']}")
                    print(f"    Need updates: {info['needs_update']}")
                    print(f"    Expected source: {info['expected_source']}")
                    print(f"    Current sources: {info['current_sources']}")
        
        # Perform updates if not dry run
        if not dry_run and updates_needed:
            print(f"")
            print(f"PERFORMING UPDATES...")
            print("-" * 60)
            
            # Batch update for efficiency
            for update in updates_needed:
                try:
                    db.execute(
                        text("UPDATE transactions SET source = :new_source WHERE id = :txn_id"),
                        {
                            "new_source": update["expected_source"],
                            "txn_id": update["id"]
                        }
                    )
                    stats["transactions_updated"] += 1
                    
                    if stats["transactions_updated"] % 1000 == 0:
                        print(f"Updated {stats['transactions_updated']} transactions...")
                        
                except Exception as e:
                    error_msg = f"Error updating transaction {update['id']}: {str(e)}"
                    stats["errors"].append(error_msg)
                    print(f"ERROR: {error_msg}")
            
            # Commit all changes
            db.commit()
            print(f"Successfully updated {stats['transactions_updated']} transactions")
            
        elif dry_run and updates_needed:
            print(f"")
            print("DRY RUN MODE - No changes made")
            print("Run with dry_run=False to apply changes")
        
        else:
            print("No updates needed - all transactions have correct sources!")
            
    except Exception as e:
        error_msg = f"Critical error during processing: {str(e)}"
        stats["errors"].append(error_msg)
        print(f"ERROR: {error_msg}")
        db.rollback()
        
    finally:
        db.close()
    
    return stats


def main():
    """Main function to run the update script."""
    print("Transaction Source Update Script")
    print("=" * 60)
    print(f"Started at: {datetime.now()}")
    print("")
    
    # First run in dry-run mode to see what would change
    print("RUNNING DRY RUN to analyze needed changes...")
    print("=" * 60)
    dry_run_stats = update_transaction_sources(dry_run=True)
    
    if dry_run_stats["transactions_to_update"] == 0:
        print("No changes needed. Exiting.")
        return
    
    print("")
    print("=" * 60)
    response = input(f"Do you want to proceed with updating {dry_run_stats['transactions_to_update']} transactions? (yes/no): ").strip().lower()
    
    if response in ['yes', 'y']:
        print("")
        print("RUNNING ACTUAL UPDATE...")
        print("=" * 60)
        update_stats = update_transaction_sources(dry_run=False)
        
        print("")
        print("FINAL RESULTS:")
        print("=" * 60)
        print(f"Transactions updated: {update_stats['transactions_updated']}")
        if update_stats["errors"]:
            print(f"Errors encountered: {len(update_stats['errors'])}")
            for error in update_stats["errors"]:
                print(f"  - {error}")
        else:
            print("No errors encountered")
    else:
        print("Update cancelled by user")
    
    print(f"")
    print(f"Finished at: {datetime.now()}")


if __name__ == "__main__":
    main()