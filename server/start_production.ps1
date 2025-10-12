# Start Budget Tracker in PRODUCTION MODE
# This starts the backend server using the real production database

Write-Host "💼 Starting Budget Tracker in PRODUCTION MODE..." -ForegroundColor Green
Write-Host ("=" * 60)

cd $PSScriptRoot

# Remove any stale app.db that appears in wrong location
Remove-Item .\app\app.db -Force -ErrorAction SilentlyContinue

# Set environment variables for production mode
$env:APP_MODE = "production"
$env:DATABASE_URL = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/app.db"

Write-Host "✓ Environment: PRODUCTION MODE" -ForegroundColor Green
Write-Host "✓ Database: bt_app\app.db (your real data)" -ForegroundColor Yellow
Write-Host "`n🚀 Starting backend server on port 8000..." -ForegroundColor Cyan

.\.venv\Scripts\Activate.ps1
uvicorn bt_app.main:app --reload --port 8000

