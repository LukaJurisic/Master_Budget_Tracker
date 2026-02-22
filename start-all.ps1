param(
    [int]$Port = 8020
)

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendScript = Join-Path $repoRoot 'start-backend.ps1'
$frontendScript = Join-Path $repoRoot 'start-frontend.ps1'

if (-not (Test-Path $backendScript)) {
    throw "Backend script not found at $backendScript"
}
if (-not (Test-Path $frontendScript)) {
    throw "Frontend script not found at $frontendScript"
}

Write-Host '>>> Launching backend and frontend in their own PowerShell windows...' -ForegroundColor Green

$backendArgs = "-NoExit", "-Command", "& '$backendScript' -Port $Port"
Start-Process -FilePath powershell -ArgumentList $backendArgs -WorkingDirectory $repoRoot | Out-Null

$frontendArgs = "-NoExit", "-Command", "& '$frontendScript'"
Start-Process -FilePath powershell -ArgumentList $frontendArgs -WorkingDirectory $repoRoot | Out-Null

Write-Host '>>> Both processes started. Close their windows to stop them.' -ForegroundColor Green
