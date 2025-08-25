from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "Test standalone app"}

@app.get("/api/analytics/transaction-frequency-by-category")
def transaction_frequency_by_category():
    """Transaction frequency by category"""
    return {
        "data": [
            {"category": "Groceries", "color": "#ff6b6b", "total_transactions": 45, "avg_per_month": 5.0},
            {"category": "Restaurants", "color": "#4ecdc4", "total_transactions": 32, "avg_per_month": 3.6},
            {"category": "Gas", "color": "#45b7d1", "total_transactions": 28, "avg_per_month": 3.1},
            {"category": "Shopping", "color": "#96ceb4", "total_transactions": 25, "avg_per_month": 2.8},
            {"category": "Telecom", "color": "#feca57", "total_transactions": 12, "avg_per_month": 1.3},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
    }

@app.get("/api/analytics/transaction-frequency-by-merchant")
def transaction_frequency_by_merchant():
    """Transaction frequency by merchant"""
    return {
        "data": [
            {"merchant": "Loblaws", "total_transactions": 42, "avg_per_month": 4.7, "total_amount": 2150.50},
            {"merchant": "Tim Hortons", "total_transactions": 38, "avg_per_month": 4.2, "total_amount": 380.00},
            {"merchant": "Shell", "total_transactions": 24, "avg_per_month": 2.7, "total_amount": 1200.00},
            {"merchant": "Metro", "total_transactions": 22, "avg_per_month": 2.4, "total_amount": 1890.25},
            {"merchant": "Rogers", "total_transactions": 12, "avg_per_month": 1.3, "total_amount": 960.00},
        ],
        "date_range": {"start_date": "2021-01-01", "end_date": "2025-07-31", "months_count": 55}
    }

print("Standalone app loaded from:", __file__)