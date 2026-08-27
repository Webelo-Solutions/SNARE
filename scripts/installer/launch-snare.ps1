<#
.SYNOPSIS
  Starts the installed, self-contained SNARE build (bundled Node.js runtime +
  Next.js standalone server) as a background process and opens it in the
  default browser. Companion to stop-snare.ps1, which stops it again via the
  PID this script records.
#>

$ErrorActionPreference = "Stop"

$SnareHome = $PSScriptRoot
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $SnareHome "browsers"
$env:NODE_ENV = "production"
if (-not $env:PORT) { $env:PORT = "3000" }

$PidFile = Join-Path $SnareHome "snare.pid"
if (Test-Path $PidFile) {
    $existingPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
        Write-Host "SNARE is already running (PID $existingPid)."
        Start-Process "http://localhost:$($env:PORT)"
        exit 0
    }
}

$NodeExe = Join-Path $SnareHome "runtime\node.exe"
$ServerJs = Join-Path $SnareHome "app\server.js"
$OutLog = Join-Path $SnareHome "snare.log"
$ErrLog = Join-Path $SnareHome "snare.err.log"

$proc = Start-Process -FilePath $NodeExe -ArgumentList "`"$ServerJs`"" `
    -WorkingDirectory (Join-Path $SnareHome "app") -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog
$proc.Id | Out-File -Encoding ascii -FilePath $PidFile

Write-Host "SNARE starting (PID $($proc.Id))..."
Start-Sleep -Seconds 3
Start-Process "http://localhost:$($env:PORT)"
