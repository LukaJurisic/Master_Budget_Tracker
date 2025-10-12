# Balance Feature Implementation - Troubleshooting Guide

## Overview
This document contains troubleshooting information for the current balances feature implemented in the Budget Tracker app.

## Current Issue
The balance feature is fully implemented but showing $0 values due to Plaid API authorization error: `INVALID_PRODUCT - The client is not authorized to access this product`.

## Root Cause
The Plaid client is not authorized for the "balance" product. The current implementation uses:
- Endpoint: `/accounts/balance/get` 
- Request: `AccountsBalanceGetRequest`

## Alternative Solution (if balance product unavailable)
If balance product authorization is delayed, we can modify the implementation to use `/accounts/get` endpoint which provides cached balance data (up to 24h old):

### Code Changes Required:

1. **Update provider.py import:**
```python
# Change from:
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest

# To:
from plaid.model.accounts_get_request import AccountsGetRequest
```

2. **Update fetch_all_balances method:**
```python
# In PlaidBalanceProvider.fetch_all_balances(), change:
request = AccountsBalanceGetRequest(access_token=access_token)
response = self.client.accounts_balance_get(request)

# To:
request = AccountsGetRequest(access_token=access_token)
response = self.client.accounts_get(request)
```

## Files Involved in Balance Feature

### Backend Files:
- `server/bt_app/models/account.py` - Extended Account model with balance fields
- `server/bt_app/models/account_balance.py` - New AccountBalance model for snapshots
- `server/migrations/versions/016_add_account_balances.py` - Database migration
- `server/bt_app/services/balances/provider.py` - Plaid balance provider (MAIN FILE TO MODIFY)
- `server/bt_app/services/balances/service.py` - Balance service orchestration
- `server/bt_app/api/routes_balances.py` - API endpoints

### Frontend Files:
- `web/src/pages/BalancesPage.tsx` - Main balances page
- `web/src/components/balances/BalanceSummary.tsx` - Three-card summary
- `web/src/components/balances/AccountsTable.tsx` - Detailed accounts table
- `web/src/components/dashboard/NetWorthCard.tsx` - Dashboard widget
- `web/src/App.tsx` - Route and navigation setup

## API Endpoints
- `GET /api/balances` - Retrieve current balance data
- `POST /api/balances/refresh` - Manual refresh trigger
- `GET /api/balances/history` - Historical balance data

## Testing When Balance Product is Available
1. Navigate to `/balances` page
2. Click "Refresh Balances" button
3. Should see success toast with "Refreshed X accounts successfully"
4. Balance cards should show actual values instead of $0
5. Accounts table should populate with current/available balances

## Current Status
- ✅ All code implemented and tested
- ✅ Database migration applied  
- ✅ Frontend UI working with manual refresh
- ❌ Plaid balance product authorization pending
- ❌ API returning INVALID_PRODUCT error

## Next Steps
1. Wait for Plaid balance product to be enabled on account
2. Test manual refresh functionality
3. If still issues, consider switching to `/accounts/get` endpoint as documented above

## Architecture Notes
- Uses idempotent daily balance snapshots (unique constraint on account_id + as_of date)
- Asset vs liability classification for net worth calculation
- Manual refresh only to control API costs
- Error handling and user feedback built-in