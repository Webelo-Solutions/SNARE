<#
.SYNOPSIS
  Installs SNARE as a Windows service using NSSM, running the production
  build (`next start`) and pointed at the current user's existing
  %APPDATA%\snare data directory (config/DB/screenshots) via SNARE_DATA_DIR,
  so the service picks up right where interactive testing left off. Also
  sets PLAYWRIGHT_BROWSERS_PATH=0 so screenshot capture finds Chromium
  under node_modules rather than the service account's own profile cache.

.NOTES
  Must be run from an elevated (Administrator) PowerShell.
  Run `npm run build` in the project first if you haven't already.
  Also run `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium`
  first if you haven't - screenshot capture needs it downloaded to that
  project-local location, not just the interactive user's own profile.
#>

#Requires -RunAsAdministrator

# Left at the default ("Continue") deliberately: NSSM writes an expected,
# non-fatal message to stderr when querying a service that doesn't exist yet
# (the normal case on a fresh install), and with ErrorActionPreference =
# "Stop" that stderr write gets escalated into a terminating exception by
# PowerShell's native-command handling before the exit-code check below ever
# runs. Real failures are still caught explicitly via exit-code checks and
# try/catch below, so nothing here is silently ignored.

$ProjectDir = (Resolve-Path "$PSScriptRoot\..").Path
$NodeExe    = (Get-Command node.exe).Source
$NextEntry  = Join-Path $ProjectDir "node_modules\next\dist\bin\next"
$DataDir    = Join-Path $env:APPDATA "snare"
$LogDir     = Join-Path $ProjectDir "service-logs"
$ServiceName = "SNARE"

if (-not (Test-Path $NextEntry)) {
    throw "Next.js entry script not found at $NextEntry - run 'npm install' and 'npm run build' first."
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Install NSSM if it isn't already available.
if (-not (Get-Command nssm.exe -ErrorAction SilentlyContinue)) {
    Write-Host "Installing NSSM via winget..."
    winget install --id NSSM.NSSM --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget install of NSSM failed (exit code $LASTEXITCODE). Install it manually from https://nssm.cc/download and re-run this script."
    }
    # winget just registered nssm's install path in the machine PATH; refresh
    # this process's copy of it so Get-Command below can find it immediately.
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

$nssmCmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
if (-not $nssmCmd) {
    throw "nssm.exe still isn't on PATH after install. Open a new PowerShell window and re-run this script."
}
$nssm = $nssmCmd.Source

# Remove a pre-existing service of the same name so this script is safely
# re-runnable. `nssm status` on a service that doesn't exist yet writes an
# expected message to stderr — that's fine and is why this is wrapped in
# try/catch rather than treated as a real failure.
$serviceExists = $false
try {
    & $nssm status $ServiceName 2>$null | Out-Null
    $serviceExists = ($LASTEXITCODE -eq 0)
} catch {
    $serviceExists = $false
}

if ($serviceExists) {
    Write-Host "Existing '$ServiceName' service found - stopping and removing it first."
    & $nssm stop $ServiceName confirm | Out-Null
    & $nssm remove $ServiceName confirm | Out-Null
}

& $nssm install $ServiceName $NodeExe "`"$NextEntry`" start"
if ($LASTEXITCODE -ne 0) {
    throw "nssm install failed (exit code $LASTEXITCODE) - see output above."
}

& $nssm set $ServiceName AppDirectory $ProjectDir
# PLAYWRIGHT_BROWSERS_PATH=0 keeps Chromium under node_modules (project-
# local) instead of the running account's own profile cache - the service
# runs as Local System by default, whose profile never has the browser
# `npm install`/`npx playwright install` downloaded to the interactive
# user's profile. Run `PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install
# chromium` once before installing the service so it's actually there.
& $nssm set $ServiceName AppEnvironmentExtra "SNARE_DATA_DIR=$DataDir" "NODE_ENV=production" "PLAYWRIGHT_BROWSERS_PATH=0"
& $nssm set $ServiceName AppStdout (Join-Path $LogDir "stdout.log")
& $nssm set $ServiceName AppStderr (Join-Path $LogDir "stderr.log")
& $nssm set $ServiceName AppRotateFiles 1
& $nssm set $ServiceName AppRotateBytes 10485760
& $nssm set $ServiceName Start SERVICE_AUTO_START
& $nssm set $ServiceName AppExit Default Restart
& $nssm set $ServiceName AppRestartDelay 5000
& $nssm set $ServiceName DisplayName "SNARE Domain Surveillance"
& $nssm set $ServiceName Description "SNARE typosquat/homoglyph domain monitoring - self-hosted web app (localhost:3000)."

Start-Service $ServiceName
Start-Sleep -Seconds 2
$svc = Get-Service $ServiceName
$svc | Format-List Name, Status, StartType

Write-Host ""
if ($svc.Status -eq "Running") {
    Write-Host "SNARE is now running as a Windows service at http://localhost:3000"
} else {
    Write-Host "Service status is '$($svc.Status)', not 'Running' - check the logs below:" -ForegroundColor Yellow
    Write-Host "  $(Join-Path $LogDir 'stderr.log')"
    Write-Host "  $(Join-Path $LogDir 'stdout.log')"
}
Write-Host "Data directory: $DataDir"
Write-Host "Logs: $LogDir"
Write-Host ""
Write-Host "Manage it with: Start-Service SNARE / Stop-Service SNARE / Get-Service SNARE"
Write-Host "Uninstall with:  nssm remove SNARE confirm"
