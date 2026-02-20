param(
    [string]$Label = "",
    [string]$OutputRoot = "",
    [string]$Serial = "",
    [string]$PackageName = "com.lukajurisic.budgettracker",
    [int]$LogLines = 1200
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-Adb {
    $adbCmd = Get-Command adb -ErrorAction SilentlyContinue
    if ($adbCmd) {
        return $adbCmd.Source
    }

    $candidates = @(
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe",
        "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "adb not found. Install Android platform-tools or add adb to PATH."
}

function Get-ConnectedDevices([string]$adbPath) {
    $raw = & $adbPath devices
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to run 'adb devices'."
    }

    return ($raw | Select-Object -Skip 1 | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^\S+\s+device$" } | ForEach-Object {
        ($_ -split "\s+")[0]
    })
}

function Invoke-Adb([string]$adbPath, [string[]]$targetArgs, [string[]]$commandArgs, [switch]$AllowFailure) {
    & $adbPath @targetArgs @commandArgs
    if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
        throw "adb command failed: $($commandArgs -join ' ')"
    }
}

function Safe-Name([string]$value) {
    if (-not $value) { return "" }
    return ($value -replace "[^A-Za-z0-9_-]", "_")
}

$adb = Resolve-Adb
$connected = @(Get-ConnectedDevices -adbPath $adb)

if ($connected.Count -eq 0) {
    throw "No Android device/emulator connected. Start an emulator first."
}

$targetSerial = $Serial
if (-not $targetSerial) {
    if ($connected.Count -gt 1) {
        throw "Multiple devices detected ($($connected -join ', ')). Re-run with -Serial."
    }
    $targetSerial = $connected[0]
} elseif ($connected -notcontains $targetSerial) {
    throw "Requested serial '$targetSerial' not connected. Connected: $($connected -join ', ')"
}

$targetArgs = @("-s", $targetSerial)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = Safe-Name $Label
$folderName = if ($safeLabel) { "$stamp-$safeLabel" } else { $stamp }

if (-not $OutputRoot) {
    $OutputRoot = Join-Path $PSScriptRoot "artifacts\mobile-bugs"
}

$outDir = Join-Path $OutputRoot $folderName
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$remoteShot = "/sdcard/budget_tracker_bug.png"
$remoteUi = "/sdcard/budget_tracker_ui.xml"
$screenshotPath = Join-Path $outDir "screenshot.png"
$uiDumpPath = Join-Path $outDir "ui.xml"
$logcatPath = Join-Path $outDir "logcat.txt"
$appLogPath = Join-Path $outDir "logcat-app.txt"
$metaPath = Join-Path $outDir "meta.txt"

# Screenshot
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("shell", "screencap", "-p", $remoteShot)
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("pull", $remoteShot, $screenshotPath)
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("shell", "rm", $remoteShot) -AllowFailure

# UI hierarchy dump
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("shell", "uiautomator", "dump", $remoteUi)
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("pull", $remoteUi, $uiDumpPath)
Invoke-Adb -adbPath $adb -targetArgs $targetArgs -commandArgs @("shell", "rm", $remoteUi) -AllowFailure

# Logs
(& $adb @targetArgs logcat -d -v time -t $LogLines) | Out-File -FilePath $logcatPath -Encoding utf8

$appPid = ((& $adb @targetArgs shell pidof -s $PackageName) -join "").Trim()
if ($appPid) {
    (& $adb @targetArgs logcat -d --pid=$appPid -v time -t $LogLines) | Out-File -FilePath $appLogPath -Encoding utf8
} else {
    "App process not running for package '$PackageName' at capture time." | Out-File -FilePath $appLogPath -Encoding utf8
}

# Metadata
$model = ((& $adb @targetArgs shell getprop ro.product.model) -join "").Trim()
$androidVersion = ((& $adb @targetArgs shell getprop ro.build.version.release) -join "").Trim()
$sdk = ((& $adb @targetArgs shell getprop ro.build.version.sdk) -join "").Trim()
$focused = ((& $adb @targetArgs shell dumpsys window) | Select-String -Pattern "mCurrentFocus" | Select-Object -First 1 | ForEach-Object { $_.Line.Trim() })
$resumed = ((& $adb @targetArgs shell dumpsys activity activities) | Select-String -Pattern "mResumedActivity" | Select-Object -First 1 | ForEach-Object { $_.Line.Trim() })

@(
    "captured_at=$((Get-Date).ToString('s'))"
    "serial=$targetSerial"
    "package_name=$PackageName"
    "model=$model"
    "android_version=$androidVersion"
    "sdk=$sdk"
    "focused_window=$focused"
    "resumed_activity=$resumed"
    "label=$Label"
) | Out-File -FilePath $metaPath -Encoding utf8

Write-Host "Capture complete: $outDir" -ForegroundColor Green
Write-Host "Files:" -ForegroundColor Green
Write-Host "- screenshot.png"
Write-Host "- ui.xml"
Write-Host "- logcat.txt"
Write-Host "- logcat-app.txt"
Write-Host "- meta.txt"
