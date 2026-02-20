# Start Budget Tracker in DEMO MODE
# This starts the backend server using the demo database

Write-Host "🎭 Starting Budget Tracker in DEMO MODE..." -ForegroundColor Magenta
Write-Host ("=" * 60)

cd $PSScriptRoot\..\..\

# Check if demo.db exists
$demoDbPath = ".\bt_app\demo.db"
if (-not (Test-Path $demoDbPath)) {
    Write-Host "❌ Demo database not found!" -ForegroundColor Red
    Write-Host "   Run .\regenerate_demo.ps1 first to create demo data" -ForegroundColor Yellow
    exit 1
}

# Remove any stale app.db that appears in wrong location
Remove-Item .\app\app.db -Force -ErrorAction SilentlyContinue

# Set environment variables for demo mode
$env:APP_MODE = "demo"
$env:DATABASE_URL = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/demo.db"
$env:DEMO_DATABASE_URL = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/demo.db"

Write-Host "✓ Environment: DEMO MODE" -ForegroundColor Green
Write-Host "✓ Database: $demoDbPath" -ForegroundColor Green
Write-Host "`n🚀 Starting backend server on port 8000..." -ForegroundColor Cyan

.\.venv\Scripts\Activate.ps1
uvicorn bt_app.main:app --reload --port 8000

