from datetime import date, datetime
from statistics import median
from collections import defaultdict
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

# Configuration
AMOUNT_PCT_TOL = 0.10     # ±10% tolerance (more flexible for price changes)
AMOUNT_ABS_TOL = 3.00     # or ±$3 (more flexible)
DAY_OF_MONTH_TOL = 7      # ±7 days variance (more flexible)
MIN_CONSEC_MONTHS = 3     # Require 3+ consecutive months
PRICE_CHANGE_THRESHOLD = 1.00  # Minimum $1 change to consider a price change

# Categories that are typically subscriptions
SUBSCRIPTION_CATEGORIES = {
    "Rent", "Mortgage", "Housing",
    "Utilities", "Internet", "Telecom", "Phone", "Mobile",
    "Insurance", "Health Insurance", "Car Insurance",
    "Gym", "Fitness", "Health & Fitness",
    "Subscriptions", "Streaming", "Entertainment",
    "Software", "Cloud", "Security", "Storage",
    "Membership", "Membership Fee",
    "Parking", "Parking Permit", "Transit Pass",
    "Education", "Courses", "Learning",
}

# Categories to explicitly exclude (not subscriptions)
NON_SUBSCRIPTION_CATEGORIES = {
    "QSR", "Restaurant", "Ordering Out", "Ordering In", "Groceries",
    "Home Maintenance", "Going Out", "Medical", "Healthcare",
    "Pharmacy", "Pickup Sport", "Trading",
    "Retail", "Shopping", "Clothing",
    "Public Transportation",  # Usually pay-per-ride
    "Gas", "Fuel", "Travel", "Hotels",
    "Coffee", "Tim Hortons", "Starbucks",
    "Personal Care", "Grooming",
}

# Merchant keywords that strongly indicate subscriptions
SUBSCRIPTION_MERCHANT_KEYWORDS = (
    "NETFLIX", "DISNEY", "SPOTIFY", "AMAZON PRIME", "PRIME VIDEO", "AMZN", "AMAZON.COM",
    "APPLE.COM/BILL", "ICLOUD", "APPLE TV", "APPLE.COM", "APPLE SERVICES",
    "GOOGLE STORAGE", "YOUTUBE", "GOOGLE", "YOUTUBE PREMIUM",
    "ADOBE", "MICROSOFT", "365", "DROPBOX", "OURA", "OURARING",
    "EQUINOX", "GOODLIFE", "PELOTON", "F45", "PURE FITNESS", "FITNESS",
    "BELL", "ROGERS", "FIDO", "TELUS", "KOODO", "FREEDOM", "MACC",
    "INSURANCE", "RENT", "MORTGAGE", "MEMBERSHIP", "SUBSCRIPTION",
    "PATREON", "SUBSTACK", "MEDIUM", "AUDIBLE", "KINDLE",
    "SLACK", "ZOOM", "NOTION", "FIGMA", "CANVA",
    "HULU", "HBO", "PARAMOUNT", "PEACOCK", "CRUNCHYROLL",
    "TWITCH", "DISCORD", "GITHUB", "GITLAB",
)

class SubscriptionDetector:
    def __init__(self):
        pass
    
    def _normalize_merchant(self, merchant: str) -> str:
        """Normalize merchant name for grouping."""
        if not merchant:
            return ""
        
        # Enhanced normalization for better subscription grouping
        normalized = merchant.upper().strip()
        
        # Remove common suffixes and prefixes
        for suffix in [" INC", " LLC", " LTD", " CORP", " CO", " CORPORATION", " LIMITED"]:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)].strip()
        
        # Normalize common subscription service variations
        replacements = {
            "AMZN.FR/PREM": "AMAZON PRIME",
            "AMZN.COM/BILL": "AMAZON",
            "APPLE.COM/BILL": "APPLE SERVICES",
            "GOOGLE *STORAGE": "GOOGLE STORAGE",
            "GOOGLE *GOOGLE STORAGE": "GOOGLE STORAGE",
            "NETFLIX.COM": "NETFLIX",
            "SPOTIFY PREMIUM": "SPOTIFY",
            "SPOTIFY P": "SPOTIFY",
        }
        
        for pattern, replacement in replacements.items():
            if pattern in normalized:
                normalized = replacement
                break
        
        # Remove trailing numbers and special characters that vary per transaction
        import re
        normalized = re.sub(r'\s+\d+$', '', normalized)  # Remove trailing numbers
        normalized = re.sub(r'\s+[A-Z0-9]{4,}$', '', normalized)  # Remove trailing codes
        
        return normalized
    
    def _is_subscription_category(self, category: str, merchant: str) -> bool:
        """Check if category/merchant indicates a subscription."""
        if not category:
            # Check merchant keywords if no category
            merchant_upper = merchant.upper()
            return any(keyword in merchant_upper for keyword in SUBSCRIPTION_MERCHANT_KEYWORDS)
        
        # Exclude non-subscription categories
        if any(cat in category for cat in NON_SUBSCRIPTION_CATEGORIES):
            return False
        
        # Include subscription categories
        if any(cat in category for cat in SUBSCRIPTION_CATEGORIES):
            return True
        
        # Fall back to merchant keywords
        merchant_upper = merchant.upper()
        return any(keyword in merchant_upper for keyword in SUBSCRIPTION_MERCHANT_KEYWORDS)
    
    def _within_amount_tolerance(self, amount: float, reference: float) -> bool:
        """Check if amount is within tolerance of reference."""
        # Convert to float to avoid decimal/float mixing
        amount_f = float(amount)
        reference_f = float(reference)
        tolerance = max(AMOUNT_ABS_TOL, abs(reference_f) * AMOUNT_PCT_TOL)
        return abs(abs(amount_f) - abs(reference_f)) <= tolerance
    
    def _find_consecutive_runs(self, months: List[date]) -> List[Tuple[int, int]]:
        """Find consecutive month runs in sorted dates."""
        if not months:
            return []
        
        runs = []
        start_idx = 0
        
        for i in range(1, len(months)):
            prev_month = months[i-1]
            curr_month = months[i]
            
            # Check if consecutive
            months_diff = (curr_month.year - prev_month.year) * 12 + (curr_month.month - prev_month.month)
            
            if months_diff != 1:
                # End of run
                runs.append((start_idx, i-1))
                start_idx = i
        
        # Add final run
        runs.append((start_idx, len(months)-1))
        
        return runs
    
    def _merge_adjacent_segments(self, segments: List[Dict]) -> List[Dict]:
        """Merge adjacent subscription segments (handles price changes)."""
        if not segments:
            return []
        
        # Sort by start date
        segments.sort(key=lambda s: s['start_date'])
        
        merged = []
        current = dict(segments[0], price_changes=[])
        
        for seg in segments[1:]:
            # Check if segments are adjacent (allow up to 3 month gap for price changes)
            current_end = current['end_date']
            seg_start = seg['start_date']
            
            # Calculate month difference
            month_diff = (seg_start.year - current_end.year) * 12 + (seg_start.month - current_end.month)
            
            if month_diff <= 4:  # Allow up to 3 month gap for price changes
                # Record price change if significant
                if abs(seg['monthly_amount'] - current['monthly_amount']) >= PRICE_CHANGE_THRESHOLD:
                    current['price_changes'].append({
                        'from': round(current['monthly_amount'], 2),
                        'to': round(seg['monthly_amount'], 2),
                        'date': seg['start_date'].strftime('%Y-%m')
                    })
                
                # Merge segments
                current['end_date'] = seg['end_date']
                current['months_count'] += seg['months_count']
                current['total_charged'] += seg['total_charged']
                current['monthly_amount'] = seg['monthly_amount']  # Update to latest price
            else:
                # Gap too large - treat as separate subscription
                merged.append(current)
                current = dict(seg, price_changes=[])
        
        merged.append(current)
        return merged
    
    def detect_subscriptions(self, transactions: List[Dict]) -> List[Dict]:
        """
        Detect recurring subscriptions from transaction list.
        
        Args:
            transactions: List of transaction dicts with keys:
                - posted_date: date string
                - merchant_raw: merchant name
                - amount: transaction amount (negative for expenses)
                - category: category dict with 'name' field
                
        Returns:
            List of subscription dicts with keys:
                - merchant: Display name
                - category: Category name
                - monthly_amount: Current monthly fee
                - months_count: Number of months
                - total_charged: Total amount charged
                - first_date: First charge date
                - last_date: Last charge date
                - price_changes: List of price change history
        """
        if not transactions:
            return []
        
        # Group by normalized merchant
        merchant_groups = defaultdict(list)
        
        for txn in transactions:
            if not txn.get('merchant_raw'):
                continue
            
            # Only consider expenses (negative amounts)
            amount = txn.get('amount', 0)
            if amount >= 0:
                continue
            
            merchant_key = self._normalize_merchant(txn['merchant_raw'])
            merchant_groups[merchant_key].append({
                'date': datetime.strptime(txn['posted_date'], '%Y-%m-%d').date() if isinstance(txn['posted_date'], str) else txn['posted_date'],
                'merchant_raw': txn['merchant_raw'],
                'amount': abs(float(amount)),  # Convert to positive float
                'category': txn.get('category', {}).get('name', '') if isinstance(txn.get('category'), dict) else ''
            })
        
        results = []
        
        for merchant_key, txns in merchant_groups.items():
            if len(txns) < MIN_CONSEC_MONTHS:
                continue
            
            # Get display name and category
            sample = txns[-1]  # Use most recent
            merchant_display = sample['merchant_raw']
            
            # Check category filter
            categories = [t['category'] for t in txns if t['category']]
            main_category = max(set(categories), key=categories.count) if categories else ''
            
            if not self._is_subscription_category(main_category, merchant_display):
                continue
            
            # Group by month
            monthly_charges = defaultdict(list)
            for txn in txns:
                month_key = date(txn['date'].year, txn['date'].month, 1)
                monthly_charges[month_key].append(txn)
            
            # Pick one charge per month (closest to median if multiple)
            monthly_picks = {}
            for month_key, month_txns in monthly_charges.items():
                amounts = [t['amount'] for t in month_txns]
                median_amount = median(amounts)
                
                # Pick transaction closest to median
                best_txn = min(month_txns, key=lambda t: abs(t['amount'] - median_amount))
                monthly_picks[month_key] = best_txn
            
            if len(monthly_picks) < MIN_CONSEC_MONTHS:
                continue
            
            # Find consecutive runs
            months_sorted = sorted(monthly_picks.keys())
            consecutive_runs = self._find_consecutive_runs(months_sorted)
            
            # Process each consecutive run
            segments = []
            for start_idx, end_idx in consecutive_runs:
                run_months = months_sorted[start_idx:end_idx+1]
                
                if len(run_months) < MIN_CONSEC_MONTHS:
                    continue
                
                # Check amount consistency
                run_amounts = [monthly_picks[m]['amount'] for m in run_months]
                median_amount = median(run_amounts)
                
                # Allow up to 30% outliers (for price changes)
                outlier_count = sum(1 for amt in run_amounts if not self._within_amount_tolerance(amt, median_amount))
                outlier_ratio = outlier_count / len(run_amounts)
                if outlier_ratio > 0.3:  # Allow 30% outliers
                    continue
                
                # Check day-of-month consistency
                days_of_month = [monthly_picks[m]['date'].day for m in run_months]
                median_day = median(days_of_month)
                
                if any(abs(day - median_day) > DAY_OF_MONTH_TOL for day in days_of_month):
                    continue
                
                # Valid subscription segment
                segments.append({
                    'start_date': run_months[0],
                    'end_date': run_months[-1],
                    'monthly_amount': median_amount,
                    'months_count': len(run_months),
                    'total_charged': sum(run_amounts)
                })
            
            # Merge adjacent segments (handles price changes)
            merged_segments = self._merge_adjacent_segments(segments)
            
            # Create result for each merged segment
            for segment in merged_segments:
                if segment['months_count'] >= MIN_CONSEC_MONTHS:
                    results.append({
                        'merchant': merchant_display,
                        'category': main_category,
                        'monthly_amount': round(segment['monthly_amount'], 2),
                        'months_count': segment['months_count'],
                        'total_charged': round(segment['total_charged'], 2),
                        'first_date': segment['start_date'].strftime('%Y-%m-%d'),
                        'last_date': segment['end_date'].strftime('%Y-%m-%d'),
                        'price_changes': segment.get('price_changes', [])
                    })
        
        # Sort by total charged (descending)
        results.sort(key=lambda x: (-x['total_charged'], -x['months_count'], x['merchant']))
        
        return results