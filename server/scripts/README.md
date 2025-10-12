# Scripts Directory

Organized utility scripts for the Budget Tracker application.

## 📁 Structure

### `demo/`
Scripts for managing demo mode and demo database:
- `clear_demo_data.py` - Clear all data from demo database
- `create_demo_template.py` - Create empty demo database with schema
- `enhance_demo_data.py` - Add categorization and staging imports to demo data
- `seed_demo_sql.py` - Generate base demo transactions
- `seed_demo_data.py` - Alternative demo seeding approach
- `regenerate_demo.ps1` - Full demo database regeneration workflow
- `start_demo.ps1` - Start servers in demo mode
- `start_production.ps1` - Start servers in production mode

### `maintenance/`
Database maintenance and seeding scripts:
- `seed_data.py` - Seed production database with sample categories
- `populate_cleaned_merchants.py` - Populate merchant normalization data
- `update_transaction_sources.py` - Update transaction source metadata

### `dev/`
Development utilities:
- `kill_ports.ps1` - Kill processes on ports 8000-8002
- `start_server.ps1` - Start backend server (legacy)
- `check_imports.py` - Verify Python imports
- `test_db_url.py` - Test database connection
- `test_standalone.py` - Standalone tests

## 🚀 Common Usage

### Demo Mode
```powershell
# Regenerate demo database from scratch
cd server
.\scripts\demo\regenerate_demo.ps1

# Start in demo mode
.\scripts\demo\start_demo.ps1

# Start in production mode
.\scripts\demo\start_production.ps1
```

### Maintenance
```powershell
# Seed production database
cd server
.\.venv\Scripts\Activate.ps1
python scripts/maintenance/seed_data.py
```

### Development
```powershell
# Kill stuck server processes
cd server
.\scripts\dev\kill_ports.ps1
```

