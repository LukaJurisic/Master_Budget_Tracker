"""Transaction API routes."""
from typing import List, Optional
from datetime import date
from decimal import Decimal
import time
import io
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, desc, text
import pandas as pd

from ..models.transaction import Transaction
from ..models.account import Account
from ..models.category import Category
from ..schemas.transactions import (
    Transaction as TransactionSchema,
    TransactionList,
    TransactionUpdate,
    TransactionCreate,
    UnmappedMerchant
)
from ..services.mapping_service import MappingService
from .deps import get_database
from ..core.config import settings
from ..utils.account_mapping import get_source_from_account_id
from ..utils.query import parse_date_range, parse_pagination, parse_txn_type, parse_bool, get_any
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/debug/db")
def debug_db():
    """Debug endpoint to show the actual database file being used."""
    from sqlalchemy import text
    from ..core.db import engine
    with engine.connect() as c:
        # PRAGMA shows the actual file SQLite opened
        sqlite_path = c.exec_driver_sql("PRAGMA database_list").fetchone()[2]
    return {"engine_url": str(engine.url), "sqlite_path": sqlite_path}


@router.get("", response_model=TransactionList)
async def get_transactions(
    request: Request,
    db: Session = Depends(get_database)
) -> TransactionList:
    """Get transactions with filtering and pagination.
    
    Returns:
        Paginated list of transactions
    """
    try:
        start_time = time.time()
        
        # Parse query parameters safely
        qp = request.query_params
        # Support synonyms for txn_type
        txn_type = parse_txn_type(get_any(qp, "txn_type", "type", "txn"))
        date_from, date_to = parse_date_range(qp.get("date_from"), qp.get("date_to"))
        page, per_page = parse_pagination(qp.get("page"), qp.get("per_page"))
        unmapped = parse_bool(qp.get("unmapped"))
        
        logger.debug("get_transactions params %s", dict(qp))
        
        # Parse other parameters safely
        account_id = None
        if qp.get("account_id"):
            try:
                account_id = int(qp.get("account_id"))
            except (ValueError, TypeError):
                pass
        
        category_id = None
        if qp.get("category_id"):
            try:
                category_id = int(qp.get("category_id"))
            except (ValueError, TypeError):
                pass
        
        merchant = qp.get("merchant", "").strip() or None
        search = qp.get("search", "").strip() or None
        source = qp.get("source", "").strip() or None
        cleaned_merchant = qp.get("cleaned_merchant", "").strip() or None
        amount_min = None
        if qp.get("amount_min"):
            try:
                amount_min = Decimal(qp.get("amount_min"))
            except (ValueError, TypeError):
                pass
        
        amount_max = None
        if qp.get("amount_max"):
            try:
                amount_max = Decimal(qp.get("amount_max"))
            except (ValueError, TypeError):
                pass
        
        # Build query - simplified to avoid relationship issues
        query = db.query(Transaction)
        
        # Apply filters
        if date_from:
            query = query.filter(Transaction.posted_date >= date_from)
        if date_to:
            query = query.filter(Transaction.posted_date <= date_to)
        if account_id:
            query = query.filter(Transaction.account_id == account_id)
        if category_id:
            query = query.filter(Transaction.category_id == category_id)
        if merchant:
            query = query.filter(
                or_(
                    Transaction.merchant_norm.contains(merchant),
                    Transaction.merchant_raw.contains(merchant),
                    Transaction.description_raw.contains(merchant)
                )
            )
        if search:
            # Use FTS5 for fast text search when available
            search_query = search.strip()
            if len(search_query) >= 2:  # Only search for terms 2+ chars
                try:
                    # Use FTS5 virtual table for fast search
                    fts_subquery = db.execute(text("""
                        SELECT DISTINCT rowid FROM txn_fts 
                        WHERE txn_fts MATCH :search_term
                    """), {"search_term": search_query}).fetchall()
                    
                    if fts_subquery:
                        fts_ids = [row[0] for row in fts_subquery]
                        query = query.filter(Transaction.id.in_(fts_ids))
                    else:
                        # If no FTS results, return empty result set to avoid slow fallback
                        query = query.filter(Transaction.id == -1)
                except Exception:
                    # Fallback to simple LIKE if FTS fails
                    query = query.filter(
                        or_(
                            Transaction.merchant_raw.ilike(f'%{search}%'),
                            Transaction.description_raw.ilike(f'%{search}%')
                        )
                    )
            else:
                # For very short queries, use simple LIKE as fallback
                query = query.filter(
                    or_(
                        Transaction.merchant_raw.ilike(f'%{search}%'),
                        Transaction.description_raw.ilike(f'%{search}%')
                    )
                )
        if amount_min is not None:
            logger.info(f"Filtering by amount_min: {amount_min}")
            query = query.filter(func.abs(Transaction.amount) >= amount_min)
        if amount_max is not None:
            logger.info(f"Filtering by amount_max: {amount_max}")
            query = query.filter(func.abs(Transaction.amount) <= amount_max)
        if source:
            query = query.filter(Transaction.source == source)
        if cleaned_merchant:
            query = query.filter(Transaction.cleaned_final_merchant.ilike(f'%{cleaned_merchant}%'))
        if unmapped:
            query = query.filter(Transaction.category_id.is_(None))
        if txn_type:
            # Case-insensitive comparison to handle 'Income' vs 'income'
            query = query.filter(func.lower(Transaction.txn_type) == txn_type.lower())
        
        # Get total count
        total = query.count()
        
        # Apply pagination and ordering
        offset = (page - 1) * per_page
        transactions = query.options(
            joinedload(Transaction.category),
            joinedload(Transaction.subcategory)
        ).order_by(desc(Transaction.posted_date), desc(Transaction.id)).offset(offset).limit(per_page).all()
        
        # Calculate pagination info
        pages = (total + per_page - 1) // per_page
        
        # Calculate timing
        query_time_ms = int((time.time() - start_time) * 1000)
        
        result = TransactionList(
            transactions=transactions,
            total=total,
            page=page,
            per_page=per_page,
            pages=pages
        )
        
        # Add timing info as custom header (will be visible in dev tools)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("get_transactions failed")
        raise HTTPException(status_code=500, detail=f"get_transactions failed: {e}")


@router.post("", response_model=TransactionSchema)
async def create_transaction(
    transaction_data: TransactionCreate,
    db: Session = Depends(get_database)
) -> TransactionSchema:
    """Create a new transaction with proper validation and normalization.
    
    Args:
        transaction_data: Transaction creation data
        
    Returns:
        Created transaction
    """
    try:
        from decimal import Decimal, InvalidOperation
        from sqlalchemy.exc import IntegrityError
        import hashlib
        
        # 1) Ignore accidental blank "new row"
        if not (transaction_data.merchant_raw or transaction_data.description_raw or str(transaction_data.amount).strip()):
            raise HTTPException(status_code=422, detail="Empty transaction data")
        
        # 2) Validate and get account_id
        if not transaction_data.account_id:
            raise HTTPException(status_code=422, detail="account_id is required")
        
        # 3) Normalize amount + txn_type to DB convention: expense = negative, income = positive
        try:
            amt = Decimal(str(transaction_data.amount))
        except (InvalidOperation, ValueError):
            raise HTTPException(status_code=422, detail=f"Invalid amount: {transaction_data.amount}")
        
        # Infer txn_type if absent
        txn_type = transaction_data.txn_type or ("expense" if amt < 0 else "income")
        
        if txn_type == "expense":
            amt = -abs(amt)     # charges are negative in DB
        else:
            amt = abs(amt)      # income/refunds are positive in DB
        
        # 4) Create transaction with normalized fields
        mapping_service = MappingService(db)
        
        # Generate hash for deduplication
        hash_input = f"{transaction_data.account_id}_{transaction_data.posted_date}_{transaction_data.merchant_raw or ''}_{amt}"
        hash_dedupe = hashlib.sha256(hash_input.encode()).hexdigest()
        
        # Determine source from account if not provided
        source = transaction_data.source
        if not source:
            source = get_source_from_account_id(db, transaction_data.account_id)
            if source == "Unknown":
                source = "Manual"  # Fallback for unknown accounts
        
        transaction = Transaction(
            account_id=transaction_data.account_id,
            posted_date=transaction_data.posted_date,
            amount=float(amt),
            merchant_raw=transaction_data.merchant_raw or transaction_data.description_raw,
            description_raw=transaction_data.description_raw or transaction_data.merchant_raw,
            merchant_norm=mapping_service.normalize_text(transaction_data.merchant_raw or transaction_data.description_raw or ""),
            description_norm=mapping_service.normalize_text(transaction_data.description_raw or transaction_data.merchant_raw or ""),
            source=source,
            txn_type=txn_type,
            currency=transaction_data.currency or "CAD",
            category_id=transaction_data.category_id,
            hash_dedupe=hash_dedupe
        )
        
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        
        return transaction
        
    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail="Duplicate transaction") from e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create transaction: {str(e)}")


@router.put("/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    update_data: TransactionUpdate,
    db: Session = Depends(get_database)
) -> TransactionSchema:
    """Update a transaction.
    
    Args:
        transaction_id: Transaction ID
        update_data: Update data
        
    Returns:
        Updated transaction
    """
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Update fields - use hasattr to distinguish between None and not provided
        update_dict = update_data.dict(exclude_unset=True)
        
        # Handle normalization for merchant_raw and description_raw
        mapping_service = MappingService(db)
        
        for field, value in update_dict.items():
            # Prevent corruption of critical fields
            if field in ['txn_type', 'source', 'hash_dedupe', 'account_id']:
                continue  # Skip these protected fields
            elif field == 'merchant_raw' and value:
                setattr(transaction, field, value)
                # Also update the normalized version
                setattr(transaction, 'merchant_norm', mapping_service.normalize_text(value))
            elif field == 'description_raw' and value:
                setattr(transaction, field, value)
                # Also update the normalized version
                setattr(transaction, 'description_norm', mapping_service.normalize_text(value))
            else:
                setattr(transaction, field, value)
        
        db.commit()
        db.refresh(transaction)
        
        return transaction
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{transaction_id}")
async def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_database)
) -> dict:
    """Delete a transaction.
    
    Args:
        transaction_id: Transaction ID to delete
        
    Returns:
        Success message
    """
    try:
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        db.delete(transaction)
        db.commit()
        
        return {"message": "Transaction deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unmapped/pairs")
async def get_unmapped_pairs(
    db: Session = Depends(get_database),
    limit: int = Query(100, ge=1, le=500)
):
    """Get unmapped transactions grouped by merchant and description pairs."""
    try:
        # Group unmapped transactions by (merchant_norm, description_norm), exclude income
        query = db.query(
            Transaction.merchant_norm,
            Transaction.description_norm,
            func.count(Transaction.id).label('count'),
            func.sum(func.abs(Transaction.amount)).label('total_amount'),
            func.max(Transaction.posted_date).label('last_seen')
        ).filter(
            Transaction.category_id.is_(None),
            Transaction.txn_type == 'expense'
        ).group_by(
            Transaction.merchant_norm,
            Transaction.description_norm
        ).order_by(
            desc(func.count(Transaction.id))
        ).limit(limit)
        
        results = query.all()
        
        return [
            {
                "merchant_norm": row.merchant_norm or "",
                "description_norm": row.description_norm or "",
                "count": row.count,
                "total_amount": float(row.total_amount),
                "last_seen": row.last_seen
            }
            for row in results
        ]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/unmapped", response_model=List[UnmappedMerchant])
async def get_unmapped_merchants(
    db: Session = Depends(get_database),
    limit: int = Query(100, ge=1, le=500)
) -> List[UnmappedMerchant]:
    """Get summary of unmapped merchants for the mapping studio.
    
    Args:
        limit: Maximum number of merchants to return
        
    Returns:
        List of unmapped merchant summaries
    """
    try:
        mapping_service = MappingService(db)
        unmapped = mapping_service.get_unmapped_merchants(limit)
        return unmapped
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/accounts")
async def get_accounts(
    db: Session = Depends(get_database)
) -> List[dict]:
    """Get all accounts for filtering.
    
    Returns:
        List of accounts
    """
    try:
        accounts = db.query(Account).all()
        return [
            {
                "id": account.id,
                "name": account.name,
                "mask": account.mask,
                "official_name": account.official_name,
                "account_type": account.account_type
            }
            for account in accounts
        ]
        
    except Exception as e:
        # Temporary stub to avoid 500 errors during Plaid setup
        return []


class BulkCategoryUpdateRequest(BaseModel):
    merchant_norm: str
    description_norm: str
    category_id: int

@router.get("/debug-search-vs-bulk/{transaction_id}")
async def debug_search_vs_bulk(
    transaction_id: int,
    db: Session = Depends(get_database)
):
    """Debug endpoint to compare search results vs bulk update scope."""
    try:
        # Get the transaction
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Count by merchant_raw (what bulk update would affect)
        bulk_count = db.query(Transaction).filter(
            Transaction.merchant_raw == transaction.merchant_raw
        ).count()
        
        # Simulate search query for comparison
        # Search uses FTS5 with both merchant and description
        search_term = transaction.merchant_raw.lower().replace(' ', '+')
        search_sql = text("""
            SELECT COUNT(DISTINCT t.id) as search_count
            FROM txn_fts
            JOIN transactions t ON t.id = txn_fts.rowid
            WHERE txn_fts MATCH :search_term
              AND COALESCE(t.is_deleted, 0) = 0
        """)
        
        search_result = db.execute(search_sql, {"search_term": search_term}).scalar()
        
        return {
            "transaction_merchant_raw": transaction.merchant_raw,
            "bulk_update_would_affect": bulk_count,
            "search_query_finds": search_result or 0,
            "explanation": f"Bulk update matches exact merchant_raw, search uses FTS5 with fuzzy matching"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/similar-count/{transaction_id}")
async def get_similar_transaction_count(
    transaction_id: int,
    db: Session = Depends(get_database)
):
    """Get count of similar transactions for bulk update confirmation."""
    try:
        # Get the transaction
        transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Count similar transactions by exact merchant_raw match (more precise)
        similar_count = db.query(Transaction).filter(
            Transaction.merchant_raw == transaction.merchant_raw,
            Transaction.id != transaction_id
        ).count()
        
        # Get ALL similar transactions for full preview
        all_similar_transactions = db.query(Transaction).filter(
            Transaction.merchant_raw == transaction.merchant_raw,
            Transaction.id != transaction_id
        ).order_by(desc(Transaction.posted_date)).all()
        
        return {
            "similar_count": similar_count,
            "merchant_norm": transaction.merchant_norm,
            "merchant_raw": transaction.merchant_raw,
            "all_transactions": [
                {
                    "id": t.id,
                    "posted_date": str(t.posted_date),
                    "amount": str(t.amount),
                    "description_raw": t.description_raw,
                    "merchant_raw": t.merchant_raw
                }
                for t in all_similar_transactions
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bulk-category-update")
async def bulk_category_update(
    request: BulkCategoryUpdateRequest,
    db: Session = Depends(get_database)
):
    """Update category for all transactions with matching merchant and description."""
    try:
        # Count transactions that will be affected
        count_query = db.query(Transaction).filter(
            Transaction.merchant_norm == request.merchant_norm,
            Transaction.description_norm == request.description_norm
        )
        total_count = count_query.count()
        
        if total_count == 0:
            raise HTTPException(status_code=404, detail="No matching transactions found")
        
        # Update all matching transactions
        updated_count = count_query.update(
            {Transaction.category_id: request.category_id},
            synchronize_session=False
        )
        
        db.commit()
        
        return {
            "updated": updated_count,
            "merchant_norm": request.merchant_norm,
            "description_norm": request.description_norm,
            "category_id": request.category_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update transactions: {str(e)}")

class BulkUpdateByMerchantRequest(BaseModel):
    transaction_id: int
    category_id: int

@router.post("/bulk-update-by-merchant")
async def bulk_update_by_merchant(
    request: BulkUpdateByMerchantRequest,
    db: Session = Depends(get_database)
):
    """Update category for all transactions with the same merchant as the specified transaction."""
    try:
        # Get the source transaction
        source_transaction = db.query(Transaction).filter(Transaction.id == request.transaction_id).first()
        if not source_transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        # Update all transactions with same merchant_raw (more precise)
        updated_count = db.query(Transaction).filter(
            Transaction.merchant_raw == source_transaction.merchant_raw
        ).update(
            {Transaction.category_id: request.category_id},
            synchronize_session=False
        )
        
        db.commit()
        
        return {
            "updated": updated_count,
            "merchant_norm": source_transaction.merchant_norm,
            "category_id": request.category_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to bulk update transactions: {str(e)}")


@router.get("/categories")
async def get_categories(
    request: Request,
    db: Session = Depends(get_database)
) -> List[dict]:
    """Get all categories for filtering and selection.
    
    Returns:
        List of categories in tree structure
    """
    try:
        # Parse query parameters safely
        qp = request.query_params
        only_with_transactions = parse_bool(qp.get("only_with_transactions"))
        
        if only_with_transactions:
            # Only get categories that have transactions assigned
            categories = db.query(Category).join(Transaction, Category.id == Transaction.category_id).distinct().all()
        else:
            categories = db.query(Category).all()
        
        # Build category tree - now much simpler since no children exist
        category_list = []
        for cat in categories:
            category_list.append({
                "id": cat.id,
                "name": cat.name,
                "parent_id": cat.parent_id,
                "color": cat.color,
                "full_path": cat.name  # Since no children, full_path is just the name
            })
        
        # Sort alphabetically
        category_list.sort(key=lambda x: x["name"])
        
        return category_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug/db")
async def debug_database(db: Session = Depends(get_database)) -> dict:
    """Debug endpoint to check database counts and paths."""
    try:
        # Get transaction counts by type
        total_transactions = db.query(Transaction).count()
        expense_count = db.query(Transaction).filter(Transaction.txn_type == 'expense').count()
        income_count = db.query(Transaction).filter(Transaction.txn_type == 'income').count()
        
        # Get database path info
        db_url = settings.database_url
        absolute_db_url = settings.absolute_database_url
        
        return {
            "database_url_original": db_url,
            "database_url_absolute": absolute_db_url,
            "transaction_counts": {
                "total": total_transactions,
                "expenses": expense_count,
                "income": income_count
            },
            "engine_url": str(db.bind.url)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-income")
async def clear_income_transactions(db: Session = Depends(get_database)) -> dict:
    """Clear all income transactions to allow re-import."""
    try:
        deleted_count = db.query(Transaction).filter(Transaction.txn_type == 'income').count()
        db.query(Transaction).filter(Transaction.txn_type == 'income').delete(synchronize_session=False)
        db.commit()
        
        return {
            "message": f"Successfully deleted {deleted_count} income transactions",
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fix-plaid-types")
async def fix_plaid_transaction_types(db: Session = Depends(get_database)) -> dict:
    """Fix wrongly committed Plaid transactions: charges→expenses, refunds→income."""
    try:
        from sqlalchemy import text
        
        # Fix charges recorded as income (positive amount) → flip to expense  
        charges_fixed = db.execute(text("""
            UPDATE transactions 
            SET txn_type = 'expense',
                amount = -ABS(amount)
            WHERE source = 'Amex'
              AND txn_type = 'income' 
              AND amount > 0
              AND posted_date >= '2025-07-01'
        """)).rowcount
        
        # Fix refunds recorded as expense (negative amount) → flip to income
        refunds_fixed = db.execute(text("""
            UPDATE transactions
            SET txn_type = 'income',
                amount = ABS(amount)  
            WHERE source = 'Amex'
              AND txn_type = 'expense'
              AND amount < 0
              AND posted_date >= '2025-07-01'
        """)).rowcount
        
        db.commit()
        
        return {
            "message": f"Fixed {charges_fixed} charges and {refunds_fixed} refunds",
            "charges_fixed": charges_fixed,
            "refunds_fixed": refunds_fixed
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to fix transaction types: {str(e)}")

@router.get("/export/excel")
async def export_transactions_excel(
    request: Request,
    db: Session = Depends(get_database)
):
    """Export all transactions to Excel file."""
    try:
        # Get all transactions with categories
        query = db.query(Transaction).options(
            joinedload(Transaction.category)
        ).order_by(desc(Transaction.posted_date))
        
        transactions = query.all()
        
        # Convert to list of dictionaries for pandas
        data = []
        for txn in transactions:
            data.append({
                'ID': txn.id,
                'Date': txn.posted_date.strftime('%Y-%m-%d'),
                'Amount': float(txn.amount),
                'Type': txn.txn_type,
                'Merchant (Raw)': txn.merchant_raw,
                'Description (Raw)': txn.description_raw,
                'Merchant (Normalized)': txn.merchant_norm,
                'Description (Normalized)': txn.description_norm,
                'Cleaned Final Merchant': txn.cleaned_final_merchant,
                'Category': txn.category.name if txn.category else 'Unmapped',
                'Source': txn.source,
                'Account ID': txn.account_id,
                'Currency': txn.currency,
                'Created': txn.created_at.strftime('%Y-%m-%d %H:%M:%S') if txn.created_at else None,
                'Updated': txn.updated_at.strftime('%Y-%m-%d %H:%M:%S') if txn.updated_at else None
            })
        
        # Create DataFrame
        df = pd.DataFrame(data)
        
        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Transactions', index=False)
            
            # Auto-adjust column widths
            worksheet = writer.sheets['Transactions']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)  # Cap at 50 characters
                worksheet.column_dimensions[column_letter].width = adjusted_width
        
        output.seek(0)
        
        # Return as streaming response
        from datetime import datetime
        filename = f"transactions_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        
        return StreamingResponse(
            io.BytesIO(output.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Export error: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


