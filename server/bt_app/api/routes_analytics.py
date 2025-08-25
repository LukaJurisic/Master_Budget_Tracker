"""Analytics API routes with enhanced subscription detection."""
import datetime as dt
import re
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from collections import defaultdict

from ..services.analytics_service import AnalyticsService
from .deps import get_database
from ..utils.query import parse_date_range
import logging

logger = logging.getLogger(__name__)

# Vendor whitelist and patterns (module scope)
TRADINGVIEW_PAT = re.compile(r"TRADINGVIEWA?")  # TRADINGVIEW or TRADINGVIEWA (removed word boundaries)

ANALYTICS_REV = "rev-2025-08-23-04-frequency-endpoints-fixed"  # change when you edit

def _clean_upper(s: str) -> str:
    """Clean and normalize string for pattern matching."""
    s = (s or "").upper()
    return re.sub(r"[^A-Z]+", " ", s)

def _U(s):  # normalize once
    return (s or "").upper()

WHITELIST_KEYS = {"TRADINGVIEW", "EQUINOX", "NETFLIX", "AMAZON PRIME", "SPOTIFY", "APPLE", "GOOGLE", "CURSOR"}

router = APIRouter()

@router.get("/__rev")
def __rev():
    return {"rev": ANALYTICS_REV}

@router.get("/transaction-frequency-by-category")
def transaction_frequency_by_category_final(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database)
):
    """Transaction frequency by category - real data from database"""
    from sqlalchemy import text
    from datetime import datetime
    
    # Parse dates or use defaults
    if not date_from:
        date_from = "2021-01-01"
    if not date_to:
        date_to = "2025-12-31"
    
    # Calculate months between dates
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    months_count = ((end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)) + 1
    
    # Get transaction frequency by category
    query = text("""
        SELECT 
            c.name as category_name,
            c.color as category_color,
            COUNT(t.id) as total_transactions,
            ROUND(CAST(COUNT(t.id) AS FLOAT) / :months, 2) as avg_per_month
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE t.posted_date >= :date_from
          AND t.posted_date <= :date_to
          AND t.txn_type = 'expense'
          AND t.category_id IS NOT NULL
        GROUP BY c.id, c.name, c.color
        ORDER BY total_transactions DESC
        LIMIT :limit
    """)
    
    results = db.execute(query, {
        "date_from": date_from,
        "date_to": date_to,
        "months": months_count,
        "limit": limit
    }).fetchall()
    
    # Format data
    data = []
    for row in results:
        data.append({
            "category": row.category_name,
            "color": row.category_color or "#808080",
            "total_transactions": int(row.total_transactions),
            "avg_per_month": float(row.avg_per_month)
        })
    
    return {
        "data": data,
        "date_range": {
            "start_date": date_from,
            "end_date": date_to,
            "months_count": months_count
        }
    }

@router.get("/transaction-frequency-by-merchant")
def transaction_frequency_by_merchant_final(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_database)
):
    """Transaction frequency by merchant - real data from database"""
    from sqlalchemy import text
    from datetime import datetime
    
    # Parse dates or use defaults
    if not date_from:
        date_from = "2021-01-01"
    if not date_to:
        date_to = "2025-12-31"
    
    # Calculate months between dates
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    months_count = ((end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)) + 1
    
    # Get transaction frequency by merchant
    query = text("""
        SELECT 
            COALESCE(NULLIF(TRIM(t.merchant_raw), ''), 'Unknown') as merchant,
            COUNT(t.id) as total_transactions,
            ROUND(CAST(COUNT(t.id) AS FLOAT) / :months, 2) as avg_per_month,
            SUM(ABS(t.amount)) as total_amount
        FROM transactions t
        WHERE t.posted_date >= :date_from
          AND t.posted_date <= :date_to
          AND t.txn_type = 'expense'
        GROUP BY merchant
        ORDER BY total_transactions DESC
        LIMIT :limit
    """)
    
    results = db.execute(query, {
        "date_from": date_from,
        "date_to": date_to,
        "months": months_count,
        "limit": limit
    }).fetchall()
    
    # Format data
    data = []
    for row in results:
        data.append({
            "merchant": row.merchant,
            "total_transactions": int(row.total_transactions),
            "avg_per_month": float(row.avg_per_month),
            "total_amount": float(row.total_amount)
        })
    
    return {
        "data": data,
        "date_range": {
            "start_date": date_from,
            "end_date": date_to,
            "months_count": months_count
        }
    }

@router.get("/__ping_analytics")
async def __ping_analytics():
    return {"ok": True, "message": "Analytics router is working!"}

@router.post("/populate-cleaned-merchants")
def populate_cleaned_merchants_endpoint(db: Session = Depends(get_database)):
    """Populate cleaned_final_merchant column for all transactions."""
    try:
        from ..utils.merchant_cleaner import populate_cleaned_final_merchant
        updated_count = populate_cleaned_final_merchant(db)
        return {
            "success": True,
            "message": f"Successfully updated {updated_count} transactions",
            "updated_count": updated_count
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error updating merchants: {str(e)}"
        }

@router.get("/test-merchant-cleaning")
def test_merchant_cleaning():
    """Test merchant cleaning function with sample data."""
    try:
        from ..utils.merchant_cleaner import clean_final_merchant
        
        test_cases = [
            # Generic merchant cases
            {"merchant": "RESTAURANT TRANSACTION", "description": "TIM HORTONS 1234", "expected": "TIM HORTONS"},
            {"merchant": "RETAIL TRANSACTION", "description": "DOLLARAMA #5678", "expected": "DOLLARAMA"},
            {"merchant": "SERVICE", "description": "NETFLIX SUBSCRIPTION", "expected": "NETFLIX SUBSCRIPTION"},
            
            # Normal merchant cases
            {"merchant": "TIM HORTONS #1234", "description": "Coffee purchase", "expected": "TIM HORTONS"},
            {"merchant": "STARBUCKS 5678 TORONTO ON", "description": "Coffee", "expected": "STARBUCKS"},
            {"merchant": "CHIPOTLE MEXICAN GRILL", "description": "Food", "expected": "CHIPOTLE"},
            
            # Stripe cases
            {"merchant": "STRIPE", "description": "OPENAI API USAGE", "expected": "OPENAI API USAGE"},
        ]
        
        results = []
        for case in test_cases:
            actual = clean_final_merchant(case["merchant"], case["description"])
            results.append({
                "merchant": case["merchant"],
                "description": case["description"], 
                "expected": case["expected"],
                "actual": actual,
                "match": actual == case["expected"]
            })
        
        return {"test_results": results}
    except Exception as e:
        return {"error": str(e)}

@router.get("/summary-range")
def get_analytics_summary_range(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_database)
):
    """Get summary analytics for a date range."""
    from sqlalchemy import text
    
    # Get totals by transaction type for the date range
    totals_query = text("""
        SELECT 
            txn_type,
            SUM(amount) as total_amount,
            COUNT(*) as transaction_count
        FROM transactions 
        WHERE posted_date >= :date_from 
          AND posted_date <= :date_to
          AND txn_type IN ('income', 'expense')
        GROUP BY txn_type
    """)
    
    totals_result = db.execute(totals_query, {
        "date_from": date_from, 
        "date_to": date_to
    }).fetchall()
    
    # Parse results
    income_total = 0.0
    expense_total = 0.0
    income_count = 0
    expense_count = 0
    
    for row in totals_result:
        if row.txn_type.lower() == 'income':
            income_total = float(row.total_amount)
            income_count = row.transaction_count
        elif row.txn_type.lower() == 'expense':
            expense_total = float(row.total_amount)
            expense_count = row.transaction_count
    
    # Calculate derived values - expenses are negative, so add them to income
    savings_total = income_total + expense_total  # expense_total is negative
    pct_saved = (savings_total / income_total * 100) if income_total > 0 else 0.0
    
    # Convert expense total to positive for display
    expense_total_display = abs(expense_total)
    
    # Calculate date range for averages (months)
    from datetime import datetime
    start_date = datetime.strptime(date_from, "%Y-%m-%d")
    end_date = datetime.strptime(date_to, "%Y-%m-%d")
    months_count = ((end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)) + 1
    
    income_avg = income_total / months_count if months_count > 0 else 0.0
    expense_avg = expense_total_display / months_count if months_count > 0 else 0.0
    
    # Get monthly breakdown for charts
    monthly_query = text("""
        SELECT 
            strftime('%Y-%m', posted_date) as month,
            txn_type,
            SUM(amount) as amount
        FROM transactions 
        WHERE posted_date >= :date_from 
          AND posted_date <= :date_to
          AND txn_type IN ('income', 'expense')
        GROUP BY strftime('%Y-%m', posted_date), txn_type
        ORDER BY month
    """)
    
    monthly_result = db.execute(monthly_query, {
        "date_from": date_from,
        "date_to": date_to  
    }).fetchall()
    
    # Group by month for chart data
    monthly_data = {}
    for row in monthly_result:
        month = row.month
        if month not in monthly_data:
            monthly_data[month] = {"income": 0.0, "expenses": 0.0}
        
        if row.txn_type.lower() == 'income':
            monthly_data[month]["income"] = float(row.amount)
        elif row.txn_type.lower() == 'expense':
            monthly_data[month]["expenses"] = abs(float(row.amount))  # Convert to positive
    
    # Convert to chart format
    income_vs_expenses = []
    savings_by_month = []
    
    for month in sorted(monthly_data.keys()):
        data = monthly_data[month]
        income_vs_expenses.append({
            "month": month,
            "income": data["income"],
            "expenses": data["expenses"]
        })
        
        net_savings = data["income"] - data["expenses"]
        savings_by_month.append({
            "month": month,
            "net_savings": net_savings
        })
    
    return {
        "income_total": income_total,
        "expense_total": expense_total_display, 
        "savings_total": savings_total,
        "income_avg": income_avg,
        "expense_avg": expense_avg,
        "pct_saved": pct_saved,
        "income_vs_expenses": income_vs_expenses,
        "savings_by_month": savings_by_month,
        "date_range": {"start_date": date_from, "end_date": date_to}
    }

@router.get("/recurring-subscriptions")
def get_recurring_subscriptions(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_database)
):
    """Get recurring subscription transactions."""
    from sqlalchemy import text
    import datetime as dt
    from collections import defaultdict
    
    # Get actual date range from database if not provided
    if not date_from or not date_to:
        date_range_query = text("""
            SELECT 
                MIN(posted_date) as min_date,
                MAX(posted_date) as max_date
            FROM transactions
            WHERE txn_type = 'expense'
        """)
        date_range_result = db.execute(date_range_query).fetchone()
        
        if not date_from:
            date_from = date_range_result.min_date or "2021-01-01"
        if not date_to:
            date_to = date_range_result.max_date or "2025-12-31"
    
    # Pre-process grouping: Create canonical merchant keys BEFORE aggregation
    # This ensures merchants that change names get grouped together
    query = text("""
        WITH merchant_normalized AS (
            SELECT 
                t.merchant_raw,
                t.description_raw,
                t.posted_date,
                t.amount,
                c.name as category_name,
                -- Create canonical merchant key that groups variations together
                CASE 
                    -- OPENAI patterns: STRIPE + OPENAI desc OR direct OpenAI merchant
                    WHEN (t.merchant_raw = 'ONLINE PAYMENTS BY STRIPE' AND t.description_raw LIKE '%OPENAI%') 
                      OR (t.merchant_raw = 'ONLINE PAYMENTS BY STRIPE' AND t.description_raw LIKE '%CHATGPT%')
                      OR UPPER(t.merchant_raw) LIKE '%OPENAI%' THEN 'OPENAI'
                    
                    -- CURSOR patterns: STRIPE + CURSOR desc OR direct Cursor merchant  
                    WHEN (t.merchant_raw = 'ONLINE PAYMENTS BY STRIPE' AND t.description_raw LIKE '%CURSOR%')
                      OR UPPER(t.merchant_raw) LIKE '%CURSOR%' THEN 'CURSOR'
                    
                    -- TRADINGVIEW patterns: B2B + TRADINGVIEW desc OR direct Tradingview merchant
                    WHEN (t.merchant_raw = 'B2B TRANSACTION' AND t.description_raw LIKE '%TRADINGVIEW%')
                      OR UPPER(t.merchant_raw) LIKE '%TRADINGVIEW%' THEN 'TRADINGVIEW'
                    
                    -- LEETCODE patterns: STRIPE + LEETCODE desc
                    WHEN (t.merchant_raw = 'ONLINE PAYMENTS BY STRIPE' AND t.description_raw LIKE '%LEETCODE%')
                      OR UPPER(t.merchant_raw) LIKE '%LEETCODE%' THEN 'LEETCODE'
                    
                    -- NETFLIX patterns: All Netflix variations
                    WHEN UPPER(t.merchant_raw) LIKE '%NETFLIX%' 
                      OR t.description_raw LIKE '%NETFLIX%' THEN 'NETFLIX'
                    
                    -- MEMBERSHIP FEE patterns: All membership fee variations and related patterns  
                    WHEN UPPER(t.merchant_raw) LIKE '%MEMBERSHIP FEE%'
                      OR (t.merchant_raw = 'CHECKOUT.COM ECOMM MEDIUM EEA' AND t.description_raw LIKE '%PATREON% MEMBERSHIP%')
                      OR (UPPER(t.merchant_raw) LIKE '%INTEREST%' AND t.description_raw LIKE '%MEMBERSHIP FEE%') THEN 'MEMBERSHIP_FEE'
                    
                    -- FIDO patterns: All Fido variations (FIDO, FIDO MACC, NEW MERCHANT with Fido description)
                    WHEN UPPER(t.merchant_raw) LIKE '%FIDO%' 
                      OR (t.merchant_raw = 'NEW MERCHANT' AND t.description_raw LIKE '%FIDO MOBILE%')
                      OR t.description_raw LIKE '%FIDO MOBILE%' THEN 'FIDO'
                    
                    -- BELL CANADA patterns: All Bell Canada variations
                    WHEN UPPER(t.merchant_raw) LIKE '%BELL CANADA%'
                      OR UPPER(t.merchant_raw) LIKE '%BELL%' AND t.description_raw LIKE '%BELL CANADA%' THEN 'BELL_CANADA'
                    
                    -- Default: use merchant_raw as-is
                    ELSE t.merchant_raw
                END as canonical_merchant,
                
                -- For display, prefer the most recent merchant name
                t.merchant_raw as display_merchant
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.txn_type = 'expense'
              AND t.posted_date >= :date_from
              AND t.posted_date <= :date_to
              AND t.merchant_raw IS NOT NULL
              AND t.merchant_raw != ''
        ),
        monthly_charges AS (
            SELECT 
                canonical_merchant,
                strftime('%Y-%m', posted_date) as month,
                COUNT(*) as transaction_count,
                SUM(ABS(amount)) as monthly_total,
                AVG(ABS(amount)) as avg_amount,
                MIN(posted_date) as first_date_in_month,
                MAX(posted_date) as last_date_in_month,
                MAX(category_name) as category_name,
                MAX(display_merchant) as latest_display_merchant,
                MAX(description_raw) as latest_description
            FROM merchant_normalized
            GROUP BY canonical_merchant, strftime('%Y-%m', posted_date)
        ),
        merchant_summary AS (
            SELECT 
                canonical_merchant,
                MAX(latest_display_merchant) as display_merchant_name,
                MAX(latest_description) as description_raw,
                COUNT(DISTINCT month) as months_count,
                SUM(monthly_total) as total_charged,
                AVG(avg_amount) as typical_amount,
                MIN(first_date_in_month) as first_date,
                MAX(last_date_in_month) as last_date,
                MAX(category_name) as category_name,
                GROUP_CONCAT(DISTINCT ROUND(avg_amount, 2)) as price_points
            FROM monthly_charges
            GROUP BY canonical_merchant
            HAVING months_count >= 1
        )
        SELECT *
        FROM merchant_summary
        ORDER BY months_count DESC, total_charged DESC
    """)
    
    results = db.execute(query, {
        "date_from": date_from,
        "date_to": date_to
    }).fetchall()
    
    # Process results - much simpler now since SQL already groups by canonical merchant
    subscriptions = []
    current_date = dt.datetime.now().date()
    cutoff_date = current_date - dt.timedelta(days=90)  # Consider current if charged in last 90 days
    
    # Whitelist patterns for canonical merchants (already normalized by SQL)
    whitelisted_merchants = {
        'TRADINGVIEW', 'EQUINOX', 'NETFLIX', 'SPOTIFY', 'APPLE', 'GOOGLE', 
        'CURSOR', 'LEETCODE', 'OPENAI', 'BELL_CANADA', 'FIDO', 'ROGERS', 'TELUS', 
        'OURARING', 'MEMBERSHIP_FEE'
    }
    
    # Categories to exclude (non-subscription categories)
    excluded_categories = {
        'qsr', 'restaurant', 'ordering out', 'ordering in', 'groceries',
        'home maintenance', 'going out', 'medical', 'healthcare',
        'pharmacy', 'pickup sport', 'trading', 'retail', 'shopping', 
        'clothing', 'public transportation', 'gas', 'fuel', 'travel', 
        'hotels', 'coffee', 'tim hortons', 'starbucks', 'personal care', 
        'grooming', 'cash withdrawal', 'atm', 'dollarama', 'amazon'
    }
    
    # Specific merchants to exclude (high-frequency non-subscriptions)
    excluded_merchants = {
        'RENT', 'LONGOS', 'LOBLAWS', 'METRO', 'SOBEYS', 'WALMART', 
        'DOLLARAMA', 'RESTAURANT', 'TIM HORTONS', 'STARBUCKS',
        'SHELL', 'ESSO', 'PETRO', 'UBER RIDES', 'UBER EATS',
        'REXALL', 'SHOPPERS', 'NATURES EMPORIUM', 'WINNERS', 
        'INTEREST', 'PHARMACY', 'MCDONALD', 'SUBWAY',
        'AMAZONCOM PAYMENTS-CA', 'AMAZON', 'BEST BUY'
    }
    
    # Debug output
    print(f"Debug: SQL returned {len(results)} canonical merchant groups")
    
    # Process each canonical merchant group
    for row in results:
        canonical_merchant = row.canonical_merchant
        display_name = row.display_merchant_name or canonical_merchant
        category_name = row.category_name or "Subscription"
        
        # Debug key merchants
        if any(term in canonical_merchant.upper() for term in ['OPENAI', 'CURSOR', 'TRADINGVIEW', 'LEETCODE', 'EQUINOX']):
            print(f"Debug: canonical_merchant='{canonical_merchant}', display='{display_name}', months={row.months_count}, first={row.first_date}, last={row.last_date}")
        
        # Check if whitelisted
        is_whitelisted = canonical_merchant.upper() in whitelisted_merchants
        
        # Apply filtering
        if not is_whitelisted:
            # Check category exclusions
            category_lower = category_name.lower()
            if any(excluded_cat in category_lower for excluded_cat in excluded_categories):
                continue
            
            # Check merchant exclusions
            if canonical_merchant.upper() in excluded_merchants:
                continue
            
            # Require minimum subscription categories for non-whitelisted
            subscription_categories = {
                'gym', 'fitness', 'telecom', 'entertainment', 'streaming',
                'subscriptions', 'software', 'ai tools', 'education',
                'membership', 'cc fee', 'electronics'
            }
            
            if not any(sub_cat in category_lower for sub_cat in subscription_categories):
                continue
            
            # Require at least 3 months for non-whitelisted
            if row.months_count < 3:
                continue
        
        # Check if subscription is current
        last_date = dt.datetime.strptime(row.last_date, "%Y-%m-%d").date()
        is_current = last_date >= cutoff_date
        
        # Parse price points
        price_changes = []
        if row.price_points:
            try:
                price_changes = sorted([float(p) for p in row.price_points.split(',')], key=float)
            except (ValueError, AttributeError):
                price_changes = []
        
        # Use the most recent price as monthly amount
        monthly_amount = price_changes[-1] if price_changes else (row.total_charged / row.months_count if row.months_count > 0 else 0)
        
        subscriptions.append({
            "merchant": canonical_merchant,  # Use canonical name for consistency
            "monthly_amount": round(monthly_amount, 2),
            "months_count": int(row.months_count),
            "total_charged": round(float(row.total_charged), 2),
            "first_date": row.first_date,
            "last_date": row.last_date,
            "category": category_name,
            "price_changes": price_changes if len(price_changes) > 1 else None,
            "is_current": is_current
        })
    
    # Sort to show current subscriptions first, then by total charged
    subscriptions.sort(key=lambda x: (not x["is_current"], -x["total_charged"]))
    
    # Calculate summary stats
    current_subs = [s for s in subscriptions if s["is_current"]]
    total_monthly = sum(s["monthly_amount"] for s in current_subs)
    total_all_time = sum(s["total_charged"] for s in subscriptions)
    
    return {
        "subscriptions": subscriptions,
        "summary": {
            "count": len(current_subs),
            "total_monthly": round(total_monthly, 2),
            "total_all_time": round(total_all_time, 2)
        }
    }

@router.get("/latest-month-breakdowns")
def get_latest_month_breakdowns(db: Session = Depends(get_database)):
    """Get breakdown data for the latest month."""
    from sqlalchemy import text
    
    # Get the latest month with transactions
    latest_month_query = text("""
        SELECT strftime('%Y-%m', MAX(posted_date)) as latest_month
        FROM transactions
        WHERE txn_type = 'expense'
    """)
    
    latest_month_result = db.execute(latest_month_query).fetchone()
    latest_month = latest_month_result.latest_month if latest_month_result else "2025-07"
    
    # Get category breakdown for latest month
    category_query = text("""
        SELECT 
            c.name as category_name,
            SUM(ABS(t.amount)) as total_amount,
            COUNT(t.id) as transaction_count
        FROM transactions t
        JOIN categories c ON t.category_id = c.id
        WHERE strftime('%Y-%m', t.posted_date) = :latest_month
          AND t.txn_type = 'expense'
          AND t.category_id IS NOT NULL
        GROUP BY c.id, c.name
        ORDER BY total_amount DESC
        LIMIT 10
    """)
    
    category_results = db.execute(category_query, {"latest_month": latest_month}).fetchall()
    
    # Get top merchants for latest month  
    merchant_query = text("""
        SELECT 
            COALESCE(NULLIF(TRIM(t.merchant_raw), ''), 'Unknown') as merchant,
            SUM(ABS(t.amount)) as total_amount,
            COUNT(t.id) as transaction_count
        FROM transactions t
        WHERE strftime('%Y-%m', t.posted_date) = :latest_month
          AND t.txn_type = 'expense'
        GROUP BY merchant
        ORDER BY total_amount DESC
        LIMIT 10
    """)
    
    merchant_results = db.execute(merchant_query, {"latest_month": latest_month}).fetchall()
    
    # Format category details
    category_details = []
    for row in category_results:
        category_details.append({
            "category": row.category_name,
            "total_amount": float(row.total_amount),
            "transaction_count": int(row.transaction_count)
        })
    
    # Format top merchants
    top_merchants = []
    for row in merchant_results:
        top_merchants.append({
            "merchant": row.merchant,
            "total_amount": float(row.total_amount), 
            "transaction_count": int(row.transaction_count)
        })
    
    return {
        "latest_month": latest_month,
        "category_details": category_details,
        "top_merchants": top_merchants
    }

@router.get("/category-series")
def get_category_series(
    category_id: int = Query(..., description="Category ID"),
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_database)
):
    """Get time series data for a specific category."""
    from sqlalchemy import text
    
    # Get monthly spending for the specific category within date range
    series_query = text("""
        SELECT 
            strftime('%Y-%m', t.posted_date) as month,
            SUM(ABS(t.amount)) as amount
        FROM transactions t
        WHERE t.category_id = :category_id
          AND t.posted_date >= :date_from
          AND t.posted_date <= :date_to
          AND t.txn_type = 'expense'
        GROUP BY strftime('%Y-%m', t.posted_date)
        ORDER BY month
    """)
    
    series_results = db.execute(series_query, {
        "category_id": category_id,
        "date_from": date_from,
        "date_to": date_to
    }).fetchall()
    
    # Format series data
    series = []
    months = []
    values = []
    
    for row in series_results:
        month = row.month
        amount = float(row.amount)
        
        series.append({"month": month, "amount": amount})
        months.append(month)
        values.append(amount)
    
    # Calculate totals and averages
    total_amount = sum(values) if values else 0
    monthly_avg = total_amount / len(values) if values else 0
    
    return {
        "series": series,
        "months": months,
        "values": values,
        "total": total_amount,
        "monthly_avg": monthly_avg,
        "category_id": category_id,
        "date_range": {"start_date": date_from, "end_date": date_to}
    }

@router.get("/category-merchant-breakdown")
def get_category_merchant_breakdown(
    category_id: int = Query(..., description="Category ID"),
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    db: Session = Depends(get_database)
):
    """Get merchant breakdown by month for a specific category."""
    from sqlalchemy import text
    
    try:
        # Validate dates
        dt.datetime.strptime(date_from, "%Y-%m-%d")
        dt.datetime.strptime(date_to, "%Y-%m-%d")
        
        query = text("""
            SELECT 
                strftime('%Y-%m', posted_date) as month,
                cleaned_final_merchant,
                ABS(SUM(amount)) as amount
            FROM transactions 
            WHERE category_id = :category_id
            AND posted_date BETWEEN :date_from AND :date_to
            AND COALESCE(is_deleted, 0) = 0
            AND cleaned_final_merchant IS NOT NULL
            AND txn_type = 'expense'
            GROUP BY strftime('%Y-%m', posted_date), cleaned_final_merchant
            ORDER BY month, amount DESC
        """)
        
        result = db.execute(query, {
            "category_id": category_id,
            "date_from": date_from,
            "date_to": date_to
        })
        
        # Group by month
        monthly_data = {}
        total_spending = 0
        
        for row in result:
            month, merchant, amount = row[0], row[1], float(row[2])
            total_spending += amount
            
            if month not in monthly_data:
                monthly_data[month] = []
            
            monthly_data[month].append({
                "name": merchant,
                "amount": amount
            })
        
        # Convert to list format
        months_list = []
        for month in sorted(monthly_data.keys()):
            months_list.append({
                "month": month,
                "merchants": monthly_data[month]
            })
        
        return {
            "months": months_list,
            "total": total_spending
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")
    except Exception as e:
        logger.error(f"Analytics category merchant breakdown error: {e}")
        raise HTTPException(status_code=500, detail=str(e))




