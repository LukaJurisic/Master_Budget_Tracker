"""Safe query parameter parsing utilities to prevent 500 errors."""
from datetime import date, datetime
from typing import Optional, Tuple
from fastapi import HTTPException

MIN_DATE = date(2000, 1, 1)

def _to_int(value: Optional[str], default: int, *, lo: int = 1, hi: int = 1000) -> int:
    """Safely convert string to int with bounds checking."""
    try:
        v = int(value) if value not in (None, "", "null", "None") else default
    except (TypeError, ValueError):
        v = default
    return max(lo, min(v, hi))

def parse_pagination(page_str: Optional[str], per_page_str: Optional[str]) -> Tuple[int, int]:
    """Parse pagination parameters safely."""
    page = _to_int(page_str, 1, lo=1, hi=10_000)
    per_page = _to_int(per_page_str, 100, lo=1, hi=10_000)
    return page, per_page

def parse_date(s: Optional[str]) -> Optional[date]:
    """Parse date string safely, accepting YYYY-MM or YYYY-MM-DD formats."""
    if not s:
        return None
    try:
        # accept YYYY-MM-DD or YYYY-MM; normalize to a date
        if len(s) == 7:
            return datetime.strptime(s + "-01", "%Y-%m-%d").date()
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {s}. Use YYYY-MM or YYYY-MM-DD.")

def parse_date_range(date_from: Optional[str], date_to: Optional[str]) -> Tuple[date, date]:
    """Parse date range safely."""
    start = parse_date(date_from) or MIN_DATE
    end = parse_date(date_to) or date.today()
    if end < start:
        start, end = end, start
    return start, end

def parse_month(s: Optional[str]) -> date:
    """Parse month parameter and return first day of the month."""
    if not s:
        raise HTTPException(status_code=400, detail="Missing 'month' parameter.")
    parsed = parse_date(s)
    if parsed:
        return parsed.replace(day=1)
    raise HTTPException(status_code=400, detail="Invalid month format.")

def parse_txn_type(s: Optional[str]) -> Optional[str]:
    """Parse transaction type parameter safely."""
    if s in (None, "", "all"):
        return None
    s = s.lower().strip()
    if s not in {"income", "expense"}:
        raise HTTPException(status_code=400, detail="txn_type must be 'income' or 'expense'.")
    return s

def get_any(qp, *names) -> Optional[str]:
    """Get first non-empty value from query params by trying multiple names."""
    for n in names:
        v = qp.get(n)
        if v not in (None, "", "null", "None"):
            return v
    return None

def parse_bool(s: Optional[str], default: bool = False) -> bool:
    """Parse boolean parameter safely."""
    if not s:
        return default
    return s.lower() in ("true", "1", "yes", "on")