<#
.SYNOPSIS
  Installs SNARE as a Windows service using NSSM, running the production
  build (`next start`) and pointed at the current user's existing
  %APPDATA%\snare data directory (config/DB/screenshots) via SNARE_DATA_DIR,
  so the service picks up right where interactive testing left off.

.NOTES
  Must be run from an elevated (Administrator) PowerShell.
  Run `npm run build` in the project first if you haven't already.
#>

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

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
}

$nssm = (Get-Command nssm.exe).Source

# Remove a pre-existing service of the same name so this script is safely re-runnable.
& $nssm status $ServiceName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Existing '$ServiceName' service found - stopping and removing it first."
    & $nssm stop $ServiceName confirm | Out-Null
    & $nssm remove $ServiceName confirm | Out-Null
}

& $nssm install $ServiceName $NodeExe "`"$NextEntry`" start"
& $nssm set $ServiceName AppDirectory $ProjectDir
& $nssm set $ServiceName AppEnvironmentExtra "SNARE_DATA_DIR=$DataDir" "NODE_ENV=production"
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
Get-Service $ServiceName | Format-List Name, Status, StartType

Write-Host ""
Write-Host "SNARE is now running as a Windows service at http://localhost:3000"
Write-Host "Data directory: $DataDir"
Write-Host "Logs: $LogDir"
Write-Host ""
Write-Host "Manage it with: Start-Service SNARE / Stop-Service SNARE / Get-Service SNARE"
Write-Host "Uninstall with:  nssm remove SNARE confirm"
