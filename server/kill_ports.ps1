# Kill process on port 8000
$procId = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($procId) { 
    Stop-Process -Id $procId -Force
    Write-Host "Killed process on port 8000"
} else { 
    Write-Host "No process on port 8000"
}

# Kill processes on other ports
foreach ($p in 8001,8002) {
    $procId = (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue | Where-Object State -eq 'Listen').OwningProcess
    if ($procId) { 
        Stop-Process -Id $procId -Force
        Write-Host "Killed process on port $p"
    } else {
        Write-Host "No process on port $p"
    }
}

# Kill any uvicorn processes
Get-Process uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Killed any uvicorn processes"

# Kill any Python processes
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Killed any Python processes"