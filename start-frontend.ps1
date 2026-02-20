Write-Host ">>> Starting Budget Tracker Frontend..." -ForegroundColor Green

$repoRoot = $PSScriptRoot
$webDir = Join-Path $repoRoot 'web'
Push-Location $webDir
try {
    npm run dev
} finally {
    Pop-Location
}
