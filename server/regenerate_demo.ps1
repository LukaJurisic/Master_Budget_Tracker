# Regenerate Demo Database Script
# This script creates a fresh demo database with new seed data

Write-Host "🔄 Regenerating Demo Database..." -ForegroundColor Cyan
Write-Host ("=" * 60)

# Navigate to server directory
cd $PSScriptRoot

# Step 1: Backup existing demo.db if it exists
$demoDbPath = ".\bt_app\demo.db"
if (Test-Path $demoDbPath) {
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupPath = ".\bt_app\demo_backup_$timestamp.db"
    Copy-Item $demoDbPath $backupPath
    Write-Host "✓ Backed up existing demo.db to demo_backup_$timestamp.db" -ForegroundColor Green
}

# Step 2: Create fresh template
Write-Host "`n📦 Creating fresh database template..." -ForegroundColor Yellow
.\.venv\Scripts\Activate.ps1
python create_demo_template.py

# Step 3: Copy template to demo.db
$templatePath = ".\bt_app\demo_template.db"
if (Test-Path $templatePath) {
    Copy-Item $templatePath $demoDbPath -Force
    Write-Host "✓ Copied template to demo.db" -ForegroundColor Green
} else {
    Write-Host "❌ Template database not found!" -ForegroundColor Red
    exit 1
}

# Step 4: Run migrations on demo database (if needed)
Write-Host "`n🔧 Running migrations..." -ForegroundColor Yellow
$env:DATABASE_URL = "sqlite:///C:/Users/lukaj/OneDrive/Desktop/Folders/Budgeting/Budget App/budget-tracker/server/bt_app/demo.db"
alembic upgrade head

# Step 5: Seed demo data
Write-Host "`n🌱 Seeding demo data..." -ForegroundColor Yellow
python seed_demo_data.py

# Step 6: Verify
Write-Host "`n✓ Demo database regenerated successfully!" -ForegroundColor Green
Write-Host "📍 Location: $demoDbPath" -ForegroundColor Cyan
Write-Host "🚀 Ready to start in demo mode with: .\start_demo.ps1" -ForegroundColor Cyan
Write-Host ("=" * 60)

