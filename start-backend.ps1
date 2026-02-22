param(
    [int]$Port = 8020
)

Write-Host ">>> Starting Budget Tracker Backend on port $Port..." -ForegroundColor Green

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $repoRoot
try {
    $existing = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -gt 0 }
    if ($existing) {
        $pids = $existing | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
        foreach ($pid in $pids) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "Stopped process $pid holding port $Port" -ForegroundColor Yellow
            } catch {
                Write-Warning "Failed to stop process ${pid}: $($_.Exception.Message)"
            }
        }
        Start-Sleep -Milliseconds 500
    }

    $pythonExe = Join-Path $repoRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path $pythonExe)) {
        throw "Virtual environment Python not found at $pythonExe"
    }

    Set-Location (Join-Path $repoRoot 'server')
    & $pythonExe -m uvicorn bt_app.main:app --reload --port $Port
} finally {
    Pop-Location
}
