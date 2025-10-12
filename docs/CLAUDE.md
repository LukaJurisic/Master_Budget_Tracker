# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Budget Tracker with Excel-parity specifications

A personal finance application that replicates Excel-based budget workflow with automated transaction syncing via Plaid and smart merchant categorization.

## Architecture

### Tech Stack
- **Backend**: FastAPI + SQLAlchemy + Alembic (SQLite DB)
- **Frontend**: React + TypeScript + Vite + Tailwind + shadcn/ui  
- **Integration**: Plaid API v12 for transaction sync
- **State Management**: TanStack Query for server state

### Directory Structure
```
budget-tracker/
├── server/               # FastAPI backend
│   ├── app/             # Main application code
│   │   ├── api/         # Route handlers
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic validation
│   │   └── services/    # Business logic
│   ├── migrations/      # Alembic database migrations
│   └── tests/          # Pytest test files
├── web/                 # React frontend
│   └── src/
│       ├── pages/      # Route components
│       ├── components/ # Reusable UI components
│       └── lib/        # API client and utilities
└── .env                # Environment variables (root level)
```

## Development Commands

### Quick Setup (Windows)
```powershell
cd budget-tracker
.\setup.ps1              # Full automated setup
.\start-all.ps1          # Start both backend and frontend
```

### Backend Commands
```bash
cd server
.\.venv\Scripts\activate          # Windows venv activation
pip install -r requirements.txt   # Install dependencies
alembic upgrade head              # Run database migrations
alembic revision --autogenerate -m "description"  # Create migration
python seed_data.py               # Seed categories from Excel
uvicorn app.main:app --reload --port 8000  # Start server
pytest tests/ -v                  # Run all tests
pytest tests/test_normalization.py::test_function -v  # Single test
```

### Frontend Commands  
```bash
cd web
npm install               # Install dependencies
npm run dev              # Start dev server (port 3000)
npm run build            # Production build
npm run lint             # Run ESLint
npx tsc --noEmit         # Type check without building
```

## Core Business Logic

### Excel Workflow Replication

The system must replicate this Excel mapping logic:
1. **Level 1 (Merchant)**: Map transactions by merchant name
2. **Level 2 (Description)**: Map by description when merchant is generic
3. **Generic Merchants**: When merchant is one of these, use description instead:
   - `retail transaction`, `service`, `stripe`, `healthcare`, `other`, `b2b wholesale`

Reference Excel file: `C:\Users\lukaj\OneDrive\Desktop\Folders\Budgeting\Budget App\Master Budget Tracker V2 - 2023 (1).xlsx`

### Text Normalization

Single `normalize_text()` function used consistently for:
- Transaction ingest (merchant_norm, description_norm fields)
- Rule creation (pattern, desc_pattern fields)
- Matching logic

Normalization steps:
1. Lowercase
2. Trim whitespace  
3. Collapse multiple spaces
4. Remove punctuation (except # if useful)
5. Strip POS/terminal junk conservatively

### Rule Engine

Rule precedence (highest to lowest):
1. PAIR_EXACT (merchant + description exact match)
2. MERCHANT_EXACT or DESCRIPTION_EXACT
3. PAIR_CONTAINS → MERCHANT_CONTAINS → DESCRIPTION_CONTAINS
4. PAIR_REGEX → MERCHANT_REGEX → DESCRIPTION_REGEX

**Generic boost**: If merchant is generic, check description rules before merchant rules.

### Retro-application
- New rules automatically apply to existing unmapped transactions
- Return `{affected: N}` count after rule creation
- Provide `/api/transactions/remap` endpoint for manual re-application

## Plaid Integration

### Environment Setup
```python
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=True)
```

### Client Configuration (v12 API)
```python
Configuration(
    host=Environment.Sandbox,  # or Development, Production
    api_key={"clientId": PLAID_CLIENT_ID, "secret": PLAID_SECRET}  # camelCase!
)
```

### Critical Notes
- **First sync**: Must omit cursor parameter (Plaid rejects cursor=None)
- **Token storage**: Encrypt access tokens using Fernet
- **Deduplication**: Use SHA256 hash of date|amount|merchant_norm|description_norm|account_id
- **Never log**: Full tokens or secrets (log lengths only)

## API Endpoints

### Plaid Operations
- `POST /api/plaid/link-token` - Initialize Plaid Link
- `POST /api/plaid/exchange` - Exchange public token for access token
- `POST /api/refresh` - Sync transactions from all connected accounts

### Rule Management  
- `POST /api/rules` - Create single rule with retro-application
- `POST /api/rules/bulk-assign` - Create multiple rules at once
- `GET /api/unmapped?group_by=pair|merchant|description` - Get unmapped transaction groups
- `POST /api/transactions/remap` - Reapply all rules to unmapped transactions

### Transaction & Analytics
- `GET /api/transactions` - Filtered transaction list
- `GET /api/summary?month=YYYY-MM` - Dashboard summary data
- `POST /api/import` - Import CSV/OFX files (auto-detects bank format)

## Frontend Development

### Component Patterns
- Use existing shadcn/ui components from `components/ui/`
- Single `<PlaidLink>` component per token (avoid script conflicts)
- Invalidate queries after mutations: `['transactions']`, `['unmapped']`, `['summary']`

### Key Pages
- **Dashboard**: KPI cards, spending trends, budget variance
- **Transactions**: Filtered list with category assignments
- **MappingStudio**: Quick Assign tab for bulk categorization
- **Sources**: Plaid connection and CSV import

### State Management
- TanStack Query for server state (with invalidation on mutations)
- Local React state for UI interactions
- No global state management needed

## Testing Guidelines

### Critical Test Areas
```bash
cd server
pytest tests/test_normalization.py -v  # Text normalization
pytest tests/test_rules.py -v          # Mapping rule engine
```

### Test Cases (from Excel)
- LONGOS MLS → Groceries
- UBER RIDES → Public Transportation  
- AMAZONCOM PAYMENTS-CA → Amazon
- RESTAURANT TRANSACTION → Restaurant
- Generic "RETAIL TRANSACTION" + "MOBI BY SHAW GO" → Public Transportation
- Generic "SERVICE" + "PURE FITNESS" → Gym

## Environment Variables

Create `.env` in root directory:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox  # or development, production
DATABASE_URL=sqlite:///./app.db
```

## Common Issues & Solutions

### Plaid Connection
- Ensure camelCase in API config: `{"clientId": ..., "secret": ...}`
- Omit cursor on first sync
- Use correct Environment enum (capital E)

### Import Errors
- CSV imports auto-detect bank format (RBC, Scotia, TD, BMO)
- Check date format matches bank's export
- Verify account mapping in transaction source

### Mapping Issues  
- Check normalization is applied consistently
- Verify generic merchant list includes all variants
- Ensure rule priorities are set correctly

## Security Considerations

- Encrypt Plaid access tokens at rest (Fernet)
- Never commit `.env` file
- Use SHA256 for transaction deduplication
- Validate all inputs with Pydantic schemas
- No direct SQL queries - use SQLAlchemy ORM

## Performance Notes

- Frontend runs on port 3000, backend on 8000
- Use absolute file paths in all operations
- Batch rule creation for Quick Assign efficiency
- Query invalidation pattern prevents stale data
- SQLite suitable for personal use; easy PostgreSQL migration path