# Budget Tracker

A personal budget tracking application with Plaid integration for automatic transaction syncing.

## Features

- 🏦 **Plaid Integration**: Sync transactions from Amex and other supported institutions
- 📊 **Manual Imports**: Upload CSV/OFX files for RBC, Scotia, and other banks
- 🎯 **Smart Mapping**: Automatic merchant normalization with custom mapping rules
- 📈 **Dashboard**: Budget vs actual tracking, spending trends, and insights
- 🔄 **Automated Sync**: Scheduled background syncing of transaction data

## Tech Stack

**Backend:**
- FastAPI + SQLAlchemy + Alembic
- SQLite database (easily upgradeable to PostgreSQL)
- APScheduler for background tasks
- Plaid API integration

**Frontend:**
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Recharts for data visualization

## Quick Setup (Windows PowerShell)

1. **Clone and setup**
   ```powershell
   git clone <repository-url>
   cd budget-tracker
   .\setup.ps1
   ```

2. **Edit environment file**
   ```powershell
   # Edit .env with your Plaid credentials
   notepad .env
   ```

3. **Start the application**
   ```powershell
   # Production mode (with real data)
   cd server
   .\scripts\demo\start_production.ps1
   
   # Demo mode (with fake data for testing)
   cd server
   .\scripts\demo\start_demo.ps1
   
   # Or start separately:
   .\start-backend.ps1  # Terminal 1
   .\start-frontend.ps1 # Terminal 2
   ```

## 🎭 Demo Mode

Try out the app with fake data before connecting your real accounts:

```powershell
cd server
.\scripts\demo\regenerate_demo.ps1  # Generate demo database
.\scripts\demo\start_demo.ps1       # Start in demo mode
```

Demo mode includes:
- 12 months of realistic fake transactions
- Sample categories and mappings
- Staging imports to test the import workflow
- Full UI functionality without Plaid connection

## 📁 Repository Structure

```
budget-tracker/
├── server/              # FastAPI backend
│   ├── bt_app/         # Main application code
│   ├── migrations/     # Database migrations
│   ├── scripts/        # Utility scripts
│   │   ├── demo/      # Demo mode scripts
│   │   ├── maintenance/ # DB maintenance
│   │   └── dev/       # Development utilities
│   └── tests/         # Backend tests
├── web/                # React frontend
├── docs/               # Documentation
│   ├── bugs/          # Bug screenshots
│   └── *.md           # Technical docs
└── excel_views/        # Excel import templates
```

## Manual Setup

1. **Environment Setup**
   ```powershell
   cp .env.example .env
   # Edit .env with your Plaid credentials
   ```

2. **Backend Setup**
   ```powershell
   cd server
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head
   python seed_data.py  # Load sample data
   uvicorn app.main:app --reload --port 8000
   ```

3. **Frontend Setup**
   ```powershell
   cd web
   npm install
   npm run dev
   ```

## Usage

1. **Connect Bank Account**: Use Plaid Link to connect your Amex account
2. **Upload Files**: Import CSV/OFX files for other banks
3. **Review Mappings**: Use the Mapping Studio to categorize unmapped transactions
4. **Set Budgets**: Define monthly budgets by category
5. **Monitor**: Track spending vs budgets on the dashboard

## API Endpoints

- `POST /api/plaid/link-token` - Get Plaid Link token
- `POST /api/plaid/exchange` - Exchange public token for access token
- `POST /api/sync/amex` - Sync Amex transactions via Plaid
- `GET /api/transactions` - Get filtered transactions
- `POST /api/rules` - Create merchant mapping rules
- `POST /api/upload/csv` - Upload CSV files
- `GET /api/summary` - Get dashboard summary data

## Development

Run tests:
```bash
cd server
pytest
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
