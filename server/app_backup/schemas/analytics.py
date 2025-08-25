"""Analytics schemas for dashboard responses."""
from typing import List, Optional, Dict, Any
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field


class SummaryTotals(BaseModel):
    """Monthly summary totals."""
    income: Decimal = Field(default=Decimal("0.00"))
    expense: Decimal = Field(default=Decimal("0.00"))
    savings: Decimal = Field(default=Decimal("0.00"))


class SummaryCounts(BaseModel):
    """Transaction counts."""
    unmapped: int = 0
    txns: int = 0


class SummaryResponse(BaseModel):
    """Summary response for a month."""
    asOf: date
    requestedMonth: str
    effectiveMonth: str
    totals: SummaryTotals
    counts: SummaryCounts


class MonthlyResponse(BaseModel):
    """Monthly trends response."""
    asOf: date
    months: List[str]
    income: List[float]
    expense: List[float]
    savings: List[float]
    cumulativeSavings: List[float]


class CategoryBreakdown(BaseModel):
    """Category breakdown item."""
    id: int
    name: str
    total: Decimal
    pct: float


class CategoriesResponse(BaseModel):
    """Categories breakdown response."""
    asOf: date
    month: str
    total: Decimal
    categories: List[CategoryBreakdown]


class MerchantBreakdown(BaseModel):
    """Merchant breakdown item."""
    merchant: str
    total: Decimal
    count: int
    pctOfMonth: float


class MerchantsResponse(BaseModel):
    """Merchants breakdown response."""
    asOf: date
    month: str
    merchants: List[MerchantBreakdown]


class AccountBreakdown(BaseModel):
    """Account activity item."""
    id: int
    name: str
    total: Decimal
    count: int


class AccountsResponse(BaseModel):
    """Accounts activity response."""
    asOf: date
    month: str
    accounts: List[AccountBreakdown]


class BreakdownRow(BaseModel):
    """Current month breakdown row."""
    category: str
    description: str
    total: Decimal


class BreakdownItem(BaseModel):
    """Breakdown item within a category group."""
    description: str
    total: Decimal


class BreakdownGroup(BaseModel):
    """Category group with items."""
    category: str
    total: Decimal
    items: List[BreakdownItem]


class CurrentMonthBreakdownResponse(BaseModel):
    """Current month breakdown (pivot-like) response."""
    asOf: date
    month: str
    rows: List[BreakdownRow]
    groups: List[BreakdownGroup]


class Config:
    """Pydantic config."""
    json_encoders = {
        Decimal: lambda v: float(v),
        date: lambda v: v.isoformat()
    }