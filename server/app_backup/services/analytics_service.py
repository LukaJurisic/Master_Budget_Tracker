"""Analytics service for dashboard with comprehensive subscription detection."""
from collections import defaultdict
from datetime import date, datetime
from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, case, text, select
import calendar
import re

from ..models.transaction import Transaction
from ..models.category import Category

# Subscription detection configuration
PRICE_TOL_ABS = 3.00        # absolute tolerance in $
PRICE_TOL_PCT = 0.05        # 5% relative tolerance
MIN_MONTHS = 3              # require ≥3 months
REQUIRE_CONSECUTIVE = True  # true monthly cadence (no gaps)
BLOCK_MERCHANTS = {"DOLLARAMA", "TIM HORTONS", "RESTAURANT", "RETAIL"}
# Leave empty so we don't miss real subscriptions because of categories
ALLOW_CATEGORIES: set[str] = set()

def _ym(d: date) -> tuple[int, int]:
    """Convert date to (year, month) tuple."""
    return d.year, d.month

def _norm(s: str | None) -> str:
    """Normalize text for comparison."""
    if not s:
        return ""
    s = s.strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s

def _amount_same(a: float, b: float) -> bool:
    """Check if two amounts are within tolerance."""
    if abs(a - b) <= PRICE_TOL_ABS:
        return True
    base = min(abs(a), abs(b)) or 0.0
    if base == 0:
        return False
    return abs(a - b) / base <= PRICE_TOL_PCT



class AnalyticsService:
    """Service for analytics with date range support."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_available_months(self) -> Dict[str, str]:
        """Return min, max, and latest month with data."""
        result = self.db.execute(text("""
            SELECT 
                MIN(strftime('%Y-%m', posted_date)) as min_month,
                MAX(strftime('%Y-%m', posted_date)) as max_month,
                MAX(strftime('%Y-%m', posted_date)) as latest_with_data
            FROM transactions
        """)).first()
        
        if result and result.min_month:
            return {
                "min_month": result.min_month,
                "max_month": result.max_month,
                "latest_with_data": result.latest_with_data
            }
        return {
            "min_month": None,
            "max_month": None,
            "latest_with_data": None
        }
    
    def month_range(self, start: date, end: date) -> List[str]:
        """Return list of YYYY-MM between start and end (inclusive)."""
        months = []
        current = start.replace(day=1)
        end_month = end.replace(day=1)
        
        while current <= end_month:
            months.append(current.strftime('%Y-%m'))
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        return months
    
    def monthly_income_expense(self, start: date, end: date) -> Dict[str, Dict[str, float]]:
        """Return dict {month: {"income": x, "expense": y}} for the range (zero-filled)."""
        # Get actual data from database
        results = self.db.execute(text("""
            SELECT 
                strftime('%Y-%m', posted_date) as month,
                SUM(CASE WHEN txn_type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN txn_type = 'expense' THEN ABS(amount) ELSE 0 END) as expense
            FROM transactions
            WHERE posted_date >= :start_date 
                AND posted_date <= :end_date
                AND txn_type IN ('income', 'expense')
            GROUP BY strftime('%Y-%m', posted_date)
            ORDER BY month
        """), {
            "start_date": start.strftime('%Y-%m-%d'),
            "end_date": end.strftime('%Y-%m-%d')
        }).fetchall()
        
        # Create zero-filled dict for all months in range
        month_data = {}
        for month in self.month_range(start, end):
            month_data[month] = {"income": 0.0, "expense": 0.0}
        
        # Fill in actual data
        for row in results:
            month_data[row.month] = {
                "income": float(row.income or 0),
                "expense": float(row.expense or 0)
            }
        
        return month_data
    
    def totals_for_range(self, monthly: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """Return totals for the range (income_total, expense_total, savings_total, pct_saved)."""
        income_total = sum(data["income"] for data in monthly.values())
        expense_total = sum(data["expense"] for data in monthly.values())
        savings_total = income_total - expense_total
        pct_saved = round(100 * savings_total / income_total, 1) if income_total > 0 else 0.0
        
        # Calculate averages over number of months (include zero months)
        num_months = len(monthly)
        income_avg = income_total / num_months if num_months > 0 else 0.0
        expense_avg = expense_total / num_months if num_months > 0 else 0.0
        
        return {
            "income_total": income_total,
            "expense_total": expense_total,
            "savings_total": savings_total,
            "pct_saved": pct_saved,
            "income_avg": income_avg,
            "expense_avg": expense_avg
        }
    
    def monthly_savings(self, monthly: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """Return savings monthly dict {month: value}."""
        return {
            month: data["income"] - data["expense"]
            for month, data in monthly.items()
        }
    
    def latest_month_with_data(self) -> str:
        """Return latest month string 'YYYY-MM' that actually has transactions."""
        result = self.db.execute(text("""
            SELECT MAX(strftime('%Y-%m', posted_date)) as latest_month
            FROM transactions
        """)).first()
        
        return result.latest_month if result and result.latest_month else None
    
    def get_summary_range(self, start: date, end: date) -> Dict[str, Any]:
        """Get summary data for date range."""
        monthly = self.monthly_income_expense(start, end)
        totals = self.totals_for_range(monthly)
        savings = self.monthly_savings(monthly)
        
        # Sort months chronologically
        sorted_months = sorted(monthly.keys())
        
        return {
            "months": sorted_months,
            "income_monthly": [monthly[month]["income"] for month in sorted_months],
            "expense_monthly": [monthly[month]["expense"] for month in sorted_months],
            "savings_monthly": [savings[month] for month in sorted_months],
            **totals
        }
    
    def get_category_series(self, category_id: int, start: date, end: date) -> Dict[str, Any]:
        """Get monthly series for a single expense category."""
        # Get actual data for the category
        results = self.db.execute(text("""
            SELECT 
                strftime('%Y-%m', posted_date) as month,
                SUM(ABS(amount)) as total
            FROM transactions
            WHERE category_id = :category_id
                AND txn_type = 'expense'
                AND posted_date >= :start_date 
                AND posted_date <= :end_date
            GROUP BY strftime('%Y-%m', posted_date)
            ORDER BY month
        """), {
            "category_id": category_id,
            "start_date": start.strftime('%Y-%m-%d'),
            "end_date": end.strftime('%Y-%m-%d')
        }).fetchall()
        
        # Create zero-filled dict for all months in range
        months = self.month_range(start, end)
        values = [0.0] * len(months)
        
        # Fill in actual data
        month_index = {month: i for i, month in enumerate(months)}
        for row in results:
            if row.month in month_index:
                values[month_index[row.month]] = float(row.total or 0)
        
        total = sum(values)
        monthly_avg = total / len(months) if months else 0.0
        
        return {
            "months": months,
            "values": values,
            "total": total,
            "monthly_avg": monthly_avg
        }
    
    def get_latest_month_breakdowns(self) -> Dict[str, Any]:
        """Get category details and top merchants for latest month."""
        latest_month = self.latest_month_with_data()
        if not latest_month:
            return {
                "latest_month": None,
                "category_details": [],
                "top_merchants": []
            }
        
        # Category details: Category -> Description breakdown
        category_results = self.db.execute(text("""
            SELECT 
                COALESCE(c.name, 'Uncategorized') as category,
                COALESCE(t.description_norm, t.description_raw, 'Unknown') as description,
                SUM(ABS(t.amount)) as amount
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE strftime('%Y-%m', t.posted_date) = :month
                AND t.txn_type = 'expense'
            GROUP BY c.name, description
            ORDER BY c.name, amount DESC
        """), {"month": latest_month}).fetchall()
        
        # Group by category
        category_details_dict = defaultdict(lambda: {"category": "", "items": [], "total": 0.0})
        
        for row in category_results:
            category = row.category
            amount = float(row.amount or 0)
            
            if category not in category_details_dict:
                category_details_dict[category]["category"] = category
            
            category_details_dict[category]["total"] += amount
            category_details_dict[category]["items"].append({
                "description": row.description,
                "amount": amount
            })
        
        # Convert to list and sort by total
        category_details = []
        for category_data in category_details_dict.values():
            category_data["items"].sort(key=lambda x: x["amount"], reverse=True)
            category_details.append(category_data)
        
        category_details.sort(key=lambda x: x["total"], reverse=True)
        
        # Top merchants
        merchant_results = self.db.execute(text("""
            SELECT 
                COALESCE(merchant_norm, merchant_raw, 'Unknown') as merchant,
                SUM(ABS(amount)) as amount
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) = :month
                AND txn_type = 'expense'
            GROUP BY merchant
            ORDER BY amount DESC
            LIMIT 10
        """), {"month": latest_month}).fetchall()
        
        top_merchants = [
            {
                "merchant": row.merchant,
                "amount": float(row.amount or 0)
            }
            for row in merchant_results
        ]
        
        return {
            "latest_month": latest_month,
            "category_details": category_details,
            "top_merchants": top_merchants
        }
    
    def get_transaction_counts(self, start: date, end: date) -> Dict[str, int]:
        """Get transaction counts for date range."""
        result = self.db.execute(text("""
            SELECT 
                COUNT(*) as total_txns,
                COUNT(CASE WHEN txn_type = 'expense' AND category_id IS NULL THEN 1 END) as unmapped,
                COUNT(DISTINCT category_id) as categories
            FROM transactions
            WHERE posted_date >= :start_date 
                AND posted_date <= :end_date
        """), {
            "start_date": start.strftime('%Y-%m-%d'),
            "end_date": end.strftime('%Y-%m-%d')
        }).fetchall()
        
        return {
            "total_txns": result.total_txns if result else 0,
            "unmapped": result.unmapped if result else 0,
            "categories": result.categories if result else 0
        }
    
    def get_cumulative_networth(self) -> Dict[str, Any]:
        """Get net worth progression from first to latest month (all time)."""
        results = self.db.execute(text("""
            SELECT 
                strftime('%Y-%m', posted_date) as month,
                SUM(CASE WHEN txn_type = 'income' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN txn_type = 'expense' THEN ABS(amount) ELSE 0 END) as expense
            FROM transactions
            WHERE txn_type IN ('income', 'expense')
            GROUP BY strftime('%Y-%m', posted_date)
            ORDER BY month
        """)).fetchall()
        
        months = []
        networth_values = []
        cumulative = 0.0
        
        for row in results:
            income = float(row.income or 0)
            expense = float(row.expense or 0)
            net_savings = income - expense
            cumulative += net_savings
            
            months.append(row.month)
            networth_values.append(cumulative)
        
        return {
            "months": months,
            "networth_cumulative": networth_values
        }