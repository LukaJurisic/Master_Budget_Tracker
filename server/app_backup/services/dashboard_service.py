"""Dashboard service for Excel-style analytics."""
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import text, func, and_, or_
from collections import defaultdict

from ..models.transaction import Transaction
from ..models.category import Category


class DashboardService:
    """Service for dashboard analytics matching Excel format."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _get_data_range(self) -> Tuple[Optional[str], Optional[str]]:
        """Get first and latest data months from transactions."""
        result = self.db.execute(text("""
            SELECT 
                MIN(strftime('%Y-%m', posted_date)) as first_month,
                MAX(strftime('%Y-%m', posted_date)) as latest_month
            FROM transactions
        """)).first()
        
        if result and result.first_month:
            return result.first_month, result.latest_month
        return None, None
    
    def _get_effective_month(self, selected_month: str) -> str:
        """Get effective month = min(selectedMonth, latest_data_month)."""
        _, latest_month = self._get_data_range()
        if not latest_month:
            return selected_month
        
        # Compare YYYY-MM strings directly (works for ISO format)
        return min(selected_month, latest_month)
    
    def get_meta(self) -> Dict[str, Any]:
        """Get dashboard metadata."""
        first_month, latest_month = self._get_data_range()
        return {
            "first_data_month": first_month,
            "latest_data_month": latest_month
        }
    
    def get_cards(self, month: Optional[str] = None) -> Dict[str, Any]:
        """Get metric cards for specified month."""
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        effective_month = self._get_effective_month(month)
        
        # Get income (positive inflows only)
        income_result = self.db.execute(text("""
            SELECT COALESCE(SUM(amount), 0) as income
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) = :month
                AND (txn_type = 'income' OR amount > 0)
                AND txn_type != 'expense'
        """), {"month": effective_month}).first()
        
        # Get expenses (expense type, abs amount)
        expense_result = self.db.execute(text("""
            SELECT COALESCE(SUM(ABS(amount)), 0) as expenses
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) = :month
                AND txn_type = 'expense'
        """), {"month": effective_month}).first()
        
        # Get transaction counts
        counts_result = self.db.execute(text("""
            SELECT 
                COUNT(*) as total_txns,
                COUNT(CASE WHEN txn_type = 'expense' AND category_id IS NULL THEN 1 END) as unmapped
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) = :month
        """), {"month": effective_month}).first()
        
        # Get active categories count (all time)
        categories_result = self.db.execute(text("""
            SELECT COUNT(DISTINCT category_id) as active_categories
            FROM transactions
            WHERE category_id IS NOT NULL
        """)).first()
        
        income = float(income_result.income) if income_result else 0.0
        expenses = float(expense_result.expenses) if expense_result else 0.0
        
        return {
            "income": income,
            "expenses": expenses,
            "net_savings": income - expenses,
            "total_txns": counts_result.total_txns if counts_result else 0,
            "unmapped": counts_result.unmapped if counts_result else 0,
            "active_categories": categories_result.active_categories if categories_result else 0
        }
    
    def get_lines(self) -> Dict[str, Any]:
        """Get monthly line chart data for full range."""
        first_month, latest_month = self._get_data_range()
        if not first_month or not latest_month:
            return {
                "income_by_month": [],
                "expenses_by_month": [],
                "networth_cumulative": []
            }
        
        # Get monthly income and expenses
        results = self.db.execute(text("""
            SELECT 
                strftime('%Y-%m', posted_date) as month,
                COALESCE(SUM(CASE 
                    WHEN txn_type = 'income' OR (amount > 0 AND txn_type != 'expense') 
                    THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE 
                    WHEN txn_type = 'expense' 
                    THEN ABS(amount) ELSE 0 END), 0) as expenses
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) BETWEEN :first_month AND :latest_month
            GROUP BY strftime('%Y-%m', posted_date)
            ORDER BY month
        """), {"first_month": first_month, "latest_month": latest_month}).fetchall()
        
        income_by_month = []
        expenses_by_month = []
        networth_cumulative = []
        
        cumulative_networth = 0.0
        
        for row in results:
            income = float(row.income)
            expenses = float(row.expenses)
            net = income - expenses
            cumulative_networth += net
            
            income_by_month.append({"month": row.month, "amount": income})
            expenses_by_month.append({"month": row.month, "amount": expenses})
            networth_cumulative.append({"month": row.month, "amount": cumulative_networth})
        
        return {
            "income_by_month": income_by_month,
            "expenses_by_month": expenses_by_month,
            "networth_cumulative": networth_cumulative
        }
    
    def get_categories(self, month: Optional[str] = None) -> Dict[str, Any]:
        """Get category breakdown and details for specified month."""
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        effective_month = self._get_effective_month(month)
        
        # Get category breakdown (expenses only)
        breakdown_results = self.db.execute(text("""
            SELECT 
                COALESCE(c.name, 'Uncategorized') as category,
                SUM(ABS(t.amount)) as amount
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE strftime('%Y-%m', t.posted_date) = :month
                AND t.txn_type = 'expense'
            GROUP BY c.name
            ORDER BY amount DESC
        """), {"month": effective_month}).fetchall()
        
        # Calculate total and percentages
        total_expenses = sum(float(row.amount) for row in breakdown_results)
        
        breakdown = []
        top_categories = []
        
        for row in breakdown_results:
            amount = float(row.amount)
            percent = amount / total_expenses if total_expenses > 0 else 0
            
            breakdown.append({
                "category": row.category,
                "amount": amount,
                "percent": percent
            })
            
            top_categories.append({
                "category": row.category,
                "amount": amount
            })
        
        # Get category details (Category → Description breakdown)
        details_results = self.db.execute(text("""
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
        """), {"month": effective_month}).fetchall()
        
        # Group details by category
        category_details_dict = defaultdict(lambda: {"category": "", "amount": 0.0, "items": []})
        
        for row in details_results:
            category = row.category
            amount = float(row.amount)
            
            if category not in category_details_dict:
                category_details_dict[category]["category"] = category
            
            category_details_dict[category]["amount"] += amount
            category_details_dict[category]["items"].append({
                "description": row.description,
                "amount": amount
            })
        
        # Sort items within each category and sort categories by total amount
        category_details = []
        for category_data in category_details_dict.values():
            category_data["items"].sort(key=lambda x: x["amount"], reverse=True)
            category_details.append(category_data)
        
        category_details.sort(key=lambda x: x["amount"], reverse=True)
        
        return {
            "breakdown": breakdown,
            "top_categories": top_categories[:10],  # Top 10
            "category_details": category_details
        }
    
    def get_top_merchants(self, month: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get top merchants for specified month."""
        if not month:
            month = datetime.now().strftime('%Y-%m')
        
        effective_month = self._get_effective_month(month)
        
        results = self.db.execute(text("""
            SELECT 
                COALESCE(merchant_norm, merchant_raw, 'Unknown') as merchant,
                SUM(ABS(amount)) as amount
            FROM transactions
            WHERE strftime('%Y-%m', posted_date) = :month
                AND txn_type = 'expense'
            GROUP BY merchant
            ORDER BY amount DESC
            LIMIT 10
        """), {"month": effective_month}).fetchall()
        
        return [
            {
                "merchant": row.merchant,
                "amount": float(row.amount)
            }
            for row in results
        ]