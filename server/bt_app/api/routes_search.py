"""Search API routes for transactions using FTS5 with pagination."""
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.category import Category
from .deps import get_database
import re
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Regex to extract search terms
_word = re.compile(r"[\w\-]+", re.U)

def to_fts_query(q: str) -> str:
    """Convert free-text to FTS5 MATCH with prefix search.
    
    'uber eats' -> 'description:uber* OR merchant:uber* AND description:eats* OR merchant:eats*'
    This gives matches in both description and merchant fields with prefix expansion.
    """
    terms = [_t.lower() for _t in _word.findall(q)]
    if not terms:
        return ""
    per_term = [f"(description:{t}* OR merchant:{t}*)" for t in terms]
    return " AND ".join(per_term)

class SearchHit(BaseModel):
    id: int
    posted_date: str
    amount: str  # String to match regular endpoint
    currency: Optional[str] = None
    merchant_raw: Optional[str] = None
    description_raw: Optional[str] = None
    merchant_norm: Optional[str] = None
    description_norm: Optional[str] = None
    cleaned_final_merchant: Optional[str] = None
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    source: Optional[str] = None
    txn_type: Optional[str] = None
    account_id: int
    plaid_transaction_id: Optional[str] = None
    hash_dedupe: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    category: Optional[dict] = None
    rank: Optional[float] = None

class SearchResponse(BaseModel):
    transactions: List[SearchHit]
    total: int
    page: int
    per_page: int
    pages: int  # Total number of pages

@router.get("/search", response_model=SearchResponse)
def search_transactions(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    category_id: Optional[int] = None,
    amount_min: Optional[float] = Query(None, description="Minimum amount filter"),
    amount_max: Optional[float] = Query(None, description="Maximum amount filter"),
    cleaned_merchant: Optional[str] = Query(None, description="Cleaned merchant filter"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_database),
):
    """Search transactions using FTS5 full-text search with relevance ranking."""
    match = to_fts_query(q)
    if not match:
        raise HTTPException(status_code=400, detail="Empty or invalid search query")

    try:
        # BM25 relevance scoring with description weight 1.0, merchant weight 1.3
        # Lower rank = better relevance
        # Return all the same fields as regular transactions endpoint
        # Fallback to regular SQL LIKE search since FTS5 is not available
        search_terms = [term.lower() for term in _word.findall(q)]
        
        # Build LIKE conditions for each search term
        search_conditions = []
        for i, term in enumerate(search_terms):
            search_conditions.append(f"""(
                LOWER(t.merchant_norm) LIKE :term_{i} OR 
                LOWER(t.description_norm) LIKE :term_{i} OR 
                LOWER(t.merchant_raw) LIKE :term_{i} OR 
                LOWER(t.description_raw) LIKE :term_{i}
            )""")
        
        search_where = " AND ".join(search_conditions)
        
        sql = text(f"""
            SELECT
              t.id, 
              t.posted_date, 
              t.amount,
              t.currency,
              t.merchant_raw,
              t.description_raw,
              t.merchant_norm, 
              t.description_norm,
              t.cleaned_final_merchant,
              t.category_id,
              t.subcategory_id,
              t.source,
              t.txn_type,
              t.account_id,
              t.plaid_transaction_id,
              t.hash_dedupe,
              t.created_at,
              t.updated_at,
              c.id as cat_id,
              c.name as cat_name,
              c.parent_id as cat_parent_id,
              c.color as cat_color,
              c.created_at as cat_created_at,
              c.updated_at as cat_updated_at,
              1.0 AS rank
            FROM transactions t
            LEFT JOIN categories c ON c.id = t.category_id
            WHERE ({search_where})
              AND COALESCE(t.is_deleted, 0) = 0
              AND (:date_from IS NULL OR date(t.posted_date) >= date(:date_from))
              AND (:date_to IS NULL OR date(t.posted_date) <= date(:date_to))
              AND (:category_id IS NULL OR t.category_id = :category_id)
              AND (:amount_min IS NULL OR ABS(t.amount) >= :amount_min)
              AND (:amount_max IS NULL OR ABS(t.amount) <= :amount_max)
              AND (:cleaned_merchant IS NULL OR t.cleaned_final_merchant LIKE '%' || :cleaned_merchant || '%')
            ORDER BY t.posted_date DESC
            LIMIT :limit OFFSET :offset
        """)

        # Prepare parameters including search terms
        params = {
            "date_from": date_from,
            "date_to": date_to,
            "category_id": category_id,
            "amount_min": amount_min,
            "amount_max": amount_max,
            "cleaned_merchant": cleaned_merchant,
            "limit": limit,
            "offset": offset,
        }
        
        # Add search term parameters
        for i, term in enumerate(search_terms):
            params[f"term_{i}"] = f"%{term}%"
        
        result = db.execute(sql, params)
        
        rows = result.mappings().all()
        
        # Get total count for pagination
        count_sql = text(f"""
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE ({search_where})
              AND COALESCE(t.is_deleted, 0) = 0
              AND (:date_from IS NULL OR date(t.posted_date) >= date(:date_from))
              AND (:date_to IS NULL OR date(t.posted_date) <= date(:date_to))
              AND (:category_id IS NULL OR t.category_id = :category_id)
              AND (:amount_min IS NULL OR ABS(t.amount) >= :amount_min)
              AND (:amount_max IS NULL OR ABS(t.amount) <= :amount_max)
              AND (:cleaned_merchant IS NULL OR t.cleaned_final_merchant LIKE '%' || :cleaned_merchant || '%')
        """)
        
        count_params = {
            "date_from": date_from,
            "date_to": date_to,
            "category_id": category_id,
            "amount_min": amount_min,
            "amount_max": amount_max,
            "cleaned_merchant": cleaned_merchant,
        }
        
        # Add search term parameters to count query
        for i, term in enumerate(search_terms):
            count_params[f"term_{i}"] = f"%{term}%"
        
        count_result = db.execute(count_sql, count_params).scalar()
        
        # Format transactions to match regular endpoint format
        transactions = []
        for row in rows:
            txn = dict(row)
            
            # Build category object if category exists
            if txn.get('cat_id'):
                txn['category'] = {
                    'id': txn.pop('cat_id'),
                    'name': txn.pop('cat_name'),
                    'parent_id': txn.pop('cat_parent_id', None),
                    'color': txn.pop('cat_color', None),
                    'created_at': str(txn.pop('cat_created_at', '')) if txn.get('cat_created_at') else None,
                    'updated_at': str(txn.pop('cat_updated_at', '')) if txn.get('cat_updated_at') else None,
                }
            else:
                txn['category'] = None
                # Remove cat_ fields
                for key in ['cat_id', 'cat_name', 'cat_parent_id', 'cat_color', 'cat_created_at', 'cat_updated_at']:
                    txn.pop(key, None)
            
            # Convert dates to strings
            if txn.get('created_at'):
                txn['created_at'] = str(txn['created_at'])
            if txn.get('updated_at'):
                txn['updated_at'] = str(txn['updated_at'])
            if txn.get('posted_date'):
                txn['posted_date'] = str(txn['posted_date'])
            
            # Convert amount to string to match regular endpoint
            if txn.get('amount') is not None:
                txn['amount'] = str(txn['amount'])
            
            # The cleaned_final_merchant should be included from the SQL query
            # If somehow missing, it will show as None which is acceptable
            transactions.append(txn)
        
        page = (offset // limit) + 1 if limit > 0 else 1
        total_count = count_result or 0
        pages = (total_count + limit - 1) // limit if limit > 0 else 1  # Calculate total pages
        
        return SearchResponse(
            transactions=transactions,
            total=total_count,
            page=page,
            per_page=limit,
            pages=pages
        )
        
    except Exception as e:
        logger.error(f"Search query failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search query failed: {str(e)}")