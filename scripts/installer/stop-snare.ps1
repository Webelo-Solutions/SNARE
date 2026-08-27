<#
.SYNOPSIS
  Stops the SNARE process started by launch-snare.ps1, using the PID it
  recorded — never a blanket `taskkill /IM node.exe`, which could kill
  unrelated Node processes on the host.
#>

$ErrorActionPreference = "Stop"

$SnareHome = $PSScriptRoot
$PidFile = Join-Path $SnareHome "snare.pid"

if (-not (Test-Path $PidFile)) {
    Write-Host "SNARE does not appear to be running (no snare.pid found)."
    exit 0
}

$targetPid = Get-Content $PidFile -ErrorAction SilentlyContinue
Remove-Item $PidFile -ErrorAction SilentlyContinue

if (-not $targetPid) {
    Write-Host "snare.pid was empty - nothing to stop."
    exit 0
}

$proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Host "No process with PID $targetPid is running - already stopped."
    exit 0
}

Stop-Process -Id $targetPid -Force
Write-Host "SNARE (PID $targetPid) stopped."
