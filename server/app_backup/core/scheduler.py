"""Background scheduler for automated tasks."""
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from ..core.db import SessionLocal
from ..services.plaid_service import PlaidService
from ..services.mapping_service import MappingService

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def sync_transactions_job():
    """Background job to sync transactions and apply mappings."""
    logger.info("Starting scheduled transaction sync")
    
    db: Session = SessionLocal()
    try:
        plaid_service = PlaidService(db)
        mapping_service = MappingService(db)
        
        # Sync all Plaid items
        sync_results = plaid_service.sync_all_items()
        
        # Apply normalization and mapping to new transactions
        mapping_service.normalize_unmapped_transactions()
        mapping_results = mapping_service.apply_rules_to_unmapped()
        
        logger.info(f"Sync completed: {sync_results}, Mapping results: {mapping_results}")
        
    except Exception as e:
        logger.error(f"Scheduled sync failed: {e}")
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    # Schedule daily sync at 2:00 AM
    scheduler.add_job(
        func=sync_transactions_job,
        trigger=CronTrigger(hour=2, minute=0),
        id="daily_sync",
        name="Daily transaction sync and mapping",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("Scheduler started")


def stop_scheduler():
    """Stop the background scheduler."""
    scheduler.shutdown()
    logger.info("Scheduler stopped")










