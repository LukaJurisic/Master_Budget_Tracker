# Budget Tracker Setup Script for Windows PowerShell

Write-Host "🏦 Budget Tracker Setup" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.11+ first." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
try {
    $nodeVersion = node --version 2>&1
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Setup environment file
Write-Host "`n📝 Setting up environment..." -ForegroundColor Cyan

if (!(Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file from template" -ForegroundColor Green
    Write-Host "⚠️  Please edit .env file with your Plaid credentials" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Backend Setup
Write-Host "`n🐍 Setting up Python backend..." -ForegroundColor Cyan

Set-Location "server"

# Create virtual environment
if (!(Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv .venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
} else {
    Write-Host "✓ Virtual environment already exists" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "Activating virtual environment..."
& ".\.venv\Scripts\Activate.ps1"

# Install Python dependencies
Write-Host "Installing Python dependencies..."
pip install -r requirements.txt

# Run database migrations
Write-Host "Setting up database..."
alembic upgrade head
Write-Host "✓ Database migrations completed" -ForegroundColor Green

# Seed database with sample data
Write-Host "Seeding database with sample data..."
python seed_data.py
Write-Host "✓ Sample data seeded" -ForegroundColor Green

Set-Location ".."

# Frontend Setup
Write-Host "`n⚛️  Setting up React frontend..." -ForegroundColor Cyan

Set-Location "web"

# Install Node.js dependencies
Write-Host "Installing Node.js dependencies..."
npm install
Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green

Set-Location ".."

# Create start scripts
Write-Host "`n📜 Creating start scripts..." -ForegroundColor Cyan

# Backend start script
$backendScript = @"
# Start Backend Server
Write-Host "🚀 Starting Budget Tracker Backend..." -ForegroundColor Green
Set-Location "server"
& ".\.venv\Scripts\Activate.ps1"
uvicorn app.main:app --reload --port 8000
"@

$backendScript | Out-File -FilePath "start-backend.ps1" -Encoding UTF8
Write-Host "✓ Created start-backend.ps1" -ForegroundColor Green

# Frontend start script
$frontendScript = @"
# Start Frontend Development Server
Write-Host "🚀 Starting Budget Tracker Frontend..." -ForegroundColor Green
Set-Location "web"
npm run dev
"@

$frontendScript | Out-File -FilePath "start-frontend.ps1" -Encoding UTF8
Write-Host "✓ Created start-frontend.ps1" -ForegroundColor Green

# Combined start script
$startAllScript = @"
# Start Both Backend and Frontend
Write-Host "🚀 Starting Budget Tracker (Full Stack)..." -ForegroundColor Green

# Start backend in background job
`$backendJob = Start-Job -ScriptBlock {
    Set-Location "$pwd\server"
    & ".\.venv\Scripts\Activate.ps1"
    uvicorn app.main:app --reload --port 8000
}

Write-Host "✓ Backend started in background (Job ID: `$(`$backendJob.Id))" -ForegroundColor Green

# Start frontend in foreground
Set-Location "web"
Write-Host "✓ Starting frontend..." -ForegroundColor Green
npm run dev

# Cleanup background job when frontend exits
Stop-Job `$backendJob
Remove-Job `$backendJob
"@

$startAllScript | Out-File -FilePath "start-all.ps1" -Encoding UTF8
Write-Host "✓ Created start-all.ps1" -ForegroundColor Green

# Success message
Write-Host "`n🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env file with your Plaid credentials" -ForegroundColor White
Write-Host "2. Run tests: cd server && python -m pytest" -ForegroundColor White
Write-Host "3. Start backend: .\start-backend.ps1" -ForegroundColor White
Write-Host "4. Start frontend: .\start-frontend.ps1" -ForegroundColor White
Write-Host "   OR start both: .\start-all.ps1" -ForegroundColor White
Write-Host ""
Write-Host "🌐 URLs:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "📚 Features:" -ForegroundColor Cyan
Write-Host "• Plaid integration for automatic transaction sync" -ForegroundColor White
Write-Host "• CSV import for RBC, Scotia, TD, BMO banks" -ForegroundColor White
Write-Host "• Smart merchant mapping with rules engine" -ForegroundColor White
Write-Host "• Budget tracking and variance analysis" -ForegroundColor White
Write-Host "• Beautiful dashboard with charts" -ForegroundColor White
Write-Host ""

















