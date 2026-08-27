<#
.SYNOPSIS
  Builds a self-contained SNARE installer (dist\SNARE-Setup-<version>.exe):
  bundles a portable Node.js runtime, the Next.js "standalone" build output,
  the native better-sqlite3 binding, and a trimmed Playwright Chromium build
  into an NSIS installer, so the target host needs no Node, npm, git, or
  internet access to install and run SNARE.

.NOTES
  Run this on a machine with Node.js/npm already set up (this repo's normal
  dev environment) — that machine is the *build* machine, not the target.
  NSIS (makensis) and NSSM are installed via winget if not already on PATH;
  both are build-machine-only tools bundled into the installer output, not
  required on the end user's machine.
#>

#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$ProjectDir  = (Resolve-Path "$PSScriptRoot\..\..").Path
$DistDir     = Join-Path $ProjectDir "dist"
$CacheDir    = Join-Path $DistDir "cache"
$StageDir    = Join-Path $DistDir "stage"
$NodeVersion = "24.14.0"
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeZipUrl  = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Update-PathFromMachine {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# Windows antivirus/EDR real-time scanning can transiently lock a native
# addon file (e.g. next-swc's .node binary) right as npm tries to delete it
# during node_modules cleanup, causing a spurious EPERM/unlink failure that
# usually clears itself within seconds - retry before giving up.
function Invoke-WithRetry {
    param(
        [Parameter(Mandatory)][scriptblock]$Action,
        [Parameter(Mandatory)][string]$Description,
        [int]$MaxAttempts = 3,
        [int]$DelaySeconds = 5
    )
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        & $Action
        if ($LASTEXITCODE -eq 0) { return }
        if ($attempt -lt $MaxAttempts) {
            Write-Host "$Description failed (exit $LASTEXITCODE) - retrying in ${DelaySeconds}s (attempt $attempt of $MaxAttempts; this is usually a transient antivirus file lock on Windows, not a real failure)..." -ForegroundColor Yellow
            Start-Sleep -Seconds $DelaySeconds
        }
    }
}

# --- 1. Build the app --------------------------------------------------------
Write-Step "Installing dependencies and building Next.js (standalone output)"

$nextConfigContent = Get-Content (Join-Path $ProjectDir "next.config.ts") -Raw
if ($nextConfigContent -notmatch 'output:\s*"standalone"') {
    throw "next.config.ts is missing output: `"standalone`" - required for a self-contained build."
}

Push-Location $ProjectDir
try {
    Invoke-WithRetry -Description "npm ci" -Action { & npm ci }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm ci kept failing - falling back to 'npm install', which updates node_modules in place instead of deleting it wholesale (less likely to race with antivirus scanning)." -ForegroundColor Yellow
        Invoke-WithRetry -Description "npm install" -Action { & npm install }
        if ($LASTEXITCODE -ne 0) { throw "npm install failed after retries (exit code $LASTEXITCODE)" }
    }

    Invoke-WithRetry -Description "npm run build" -Action { & npm run build }
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed after retries (exit code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$StandaloneDir = Join-Path $ProjectDir ".next\standalone"
$ServerJs = Join-Path $StandaloneDir "server.js"
if (-not (Test-Path $ServerJs)) {
    throw "Build did not produce .next\standalone\server.js - check the build output above."
}
Write-Host "Standalone build OK: $ServerJs"

# --- 2. Fetch Chromium for embedding -----------------------------------------
Write-Step "Fetching Playwright Chromium (for embedding)"

$env:PLAYWRIGHT_BROWSERS_PATH = "0"
Push-Location $ProjectDir
try {
    & npx playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw "npx playwright install chromium failed (exit code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

$BrowsersCacheDir = Join-Path $ProjectDir "node_modules\playwright-core\.local-browsers"
$ChromiumDir = Get-ChildItem $BrowsersCacheDir -Directory -Filter "chromium-*" -ErrorAction SilentlyContinue | Select-Object -First 1
$FfmpegDir   = Get-ChildItem $BrowsersCacheDir -Directory -Filter "ffmpeg-*"   -ErrorAction SilentlyContinue | Select-Object -First 1
$WinLddDir   = Get-ChildItem $BrowsersCacheDir -Directory -Filter "winldd-*"   -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $ChromiumDir -or -not (Test-Path (Join-Path $ChromiumDir.FullName "INSTALLATION_COMPLETE"))) {
    throw "Chromium was not installed correctly under $BrowsersCacheDir"
}
Write-Host "Chromium OK: $($ChromiumDir.Name)"
# chromium_headless_shell-* is deliberately NOT bundled - lib/server/screenshot.ts
# only ever calls chromium.launch(), never the 'chromium-headless-shell' channel.

# --- 3. Fetch a portable Node.js runtime -------------------------------------
Write-Step "Fetching portable Node.js v$NodeVersion runtime"

New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
$NodeZipPath = Join-Path $CacheDir $NodeZipName
if (-not (Test-Path $NodeZipPath)) {
    Invoke-WebRequest -Uri $NodeZipUrl -OutFile $NodeZipPath
} else {
    Write-Host "Using cached $NodeZipPath"
}

$NodeExtractDir = Join-Path $CacheDir "node-v$NodeVersion-win-x64"
if (-not (Test-Path $NodeExtractDir)) {
    Expand-Archive -Path $NodeZipPath -DestinationPath $CacheDir -Force
}
$NodeExe = Join-Path $NodeExtractDir "node.exe"
if (-not (Test-Path $NodeExe)) {
    throw "node.exe not found after extracting $NodeZipPath"
}
Write-Host "Portable Node.js OK: $NodeExe"

# --- 4. Locate NSSM (bundled for the optional in-installer service step) ----
Write-Step "Locating NSSM (bundled for the optional 'Install as service' step)"

# Same story as makensis below: winget's NSSM package doesn't reliably land
# on PATH for a freshly-started process, and winget exits non-zero for an
# already-installed package ("no applicable update found") even though
# nothing is wrong - so search well-known install/winget locations too, and
# just re-check afterwards regardless of winget's exit code.
function Find-Nssm {
    $cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $wingetLink = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links\nssm.exe"
    if (Test-Path $wingetLink) { return $wingetLink }

    $wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $wingetPackages) {
        $found = Get-ChildItem $wingetPackages -Recurse -Filter "nssm.exe" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }

    foreach ($path in @("$env:ProgramFiles\nssm\nssm.exe", "${env:ProgramFiles(x86)}\nssm\nssm.exe")) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

$nssmPath = Find-Nssm
if (-not $nssmPath) {
    Write-Host "Installing NSSM via winget..."
    winget install --id NSSM.NSSM --accept-source-agreements --accept-package-agreements
    Update-PathFromMachine
    $nssmPath = Find-Nssm
}
if (-not $nssmPath) {
    throw "nssm.exe could not be found on PATH or in common winget/install locations after attempting winget install. Install it manually from https://nssm.cc/download and re-run this script."
}
$nssmCmd = [PSCustomObject]@{ Source = $nssmPath }
Write-Host "NSSM OK: $($nssmCmd.Source)"

# --- 5. Assemble the staging tree --------------------------------------------
Write-Step "Assembling staging tree at $StageDir"

if (Test-Path $StageDir) { Remove-Item $StageDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StageDir | Out-Null

$AppDir = Join-Path $StageDir "app"
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
Copy-Item (Join-Path $StandaloneDir "*") $AppDir -Recurse -Force

$StaticSrc = Join-Path $ProjectDir ".next\static"
$StaticDst = Join-Path $AppDir ".next\static"
New-Item -ItemType Directory -Force -Path $StaticDst | Out-Null
Copy-Item (Join-Path $StaticSrc "*") $StaticDst -Recurse -Force

$PublicSrc = Join-Path $ProjectDir "public"
if ((Test-Path $PublicSrc) -and (Get-ChildItem $PublicSrc -ErrorAction SilentlyContinue)) {
    $PublicDst = Join-Path $AppDir "public"
    New-Item -ItemType Directory -Force -Path $PublicDst | Out-Null
    Copy-Item (Join-Path $PublicSrc "*") $PublicDst -Recurse -Force
}

# better-sqlite3 ships its native binding as a prebuilt binary
# (node_modules/better-sqlite3/prebuilds/win32-x64.node) loaded via a
# runtime-computed path, which Next's static file-tracer can miss - verify it
# made it into the standalone output and copy it explicitly if not.
$PrebuildRelPath = "node_modules\better-sqlite3\prebuilds\win32-x64.node"
$TracedPrebuild = Join-Path $AppDir $PrebuildRelPath
if (-not (Test-Path $TracedPrebuild)) {
    Write-Host "better-sqlite3 native binding missing from traced output - copying explicitly" -ForegroundColor Yellow
    $SourcePrebuildDir = Join-Path $ProjectDir "node_modules\better-sqlite3\prebuilds"
    if (-not (Test-Path $SourcePrebuildDir)) {
        throw "Could not find better-sqlite3 prebuilds at $SourcePrebuildDir - is better-sqlite3 installed?"
    }
    $DestPrebuildDir = Join-Path $AppDir "node_modules\better-sqlite3\prebuilds"
    New-Item -ItemType Directory -Force -Path $DestPrebuildDir | Out-Null
    Copy-Item (Join-Path $SourcePrebuildDir "*") $DestPrebuildDir -Recurse -Force
}
if (-not (Test-Path $TracedPrebuild)) {
    throw "better-sqlite3 native binding still missing at $TracedPrebuild after explicit copy - aborting."
}
Write-Host "better-sqlite3 native binding OK"

foreach ($pkg in @("playwright-core", "whoiser")) {
    $pkgPath = Join-Path $AppDir "node_modules\$pkg"
    if (-not (Test-Path $pkgPath)) {
        throw "$pkg missing from traced standalone output at $pkgPath - review serverExternalPackages in next.config.ts."
    }
}
Write-Host "playwright-core and whoiser present in traced output"

$RuntimeDir = Join-Path $StageDir "runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Copy-Item $NodeExe (Join-Path $RuntimeDir "node.exe") -Force

$BrowsersDir = Join-Path $StageDir "browsers"
New-Item -ItemType Directory -Force -Path $BrowsersDir | Out-Null
foreach ($dir in @($ChromiumDir, $FfmpegDir, $WinLddDir)) {
    if ($dir) {
        Copy-Item $dir.FullName (Join-Path $BrowsersDir $dir.Name) -Recurse -Force
    }
}

$ToolsDir = Join-Path $StageDir "tools"
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
Copy-Item $nssmCmd.Source (Join-Path $ToolsDir "nssm.exe") -Force

foreach ($file in @("launch-snare.cmd", "launch-snare.ps1", "stop-snare.cmd", "stop-snare.ps1")) {
    Copy-Item (Join-Path $PSScriptRoot $file) (Join-Path $StageDir $file) -Force
}

# --- 6. Compile the installer -------------------------------------------------
Write-Step "Compiling NSIS installer"

$PackageJson = Get-Content (Join-Path $ProjectDir "package.json") -Raw | ConvertFrom-Json
$Version = $PackageJson.version
Write-Host "Product version: $Version"

# The NSIS installer doesn't add itself to PATH, so Get-Command alone won't
# find an existing install - check well-known install locations too. And
# winget can exit non-zero for an already-installed package ("no applicable
# update found") even though nothing is actually wrong, so its exit code
# alone isn't a reliable success/failure signal here - just re-check for the
# tool afterwards regardless of what it returned.
$NsisSearchPaths = @(
    "$env:ProgramFiles\NSIS\makensis.exe",
    "${env:ProgramFiles(x86)}\NSIS\makensis.exe"
)

function Find-Makensis {
    $cmd = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    foreach ($path in $NsisSearchPaths) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

$makensisPath = Find-Makensis
if (-not $makensisPath) {
    Write-Host "Installing NSIS via winget..."
    winget install --id NSIS.NSIS --accept-source-agreements --accept-package-agreements
    Update-PathFromMachine
    $makensisPath = Find-Makensis
}
if (-not $makensisPath) {
    throw "makensis.exe could not be found on PATH or under Program Files after attempting winget install. Install it manually from https://nsis.sourceforge.io/Download and re-run this script."
}
$makensisCmd = [PSCustomObject]@{ Source = $makensisPath }

$OutputExe = Join-Path $DistDir "SNARE-Setup-$Version.exe"
$NsiScript = Join-Path $PSScriptRoot "installer.nsi"

& $makensisCmd.Source "/DPRODUCT_VERSION=$Version" "/DSTAGE_DIR=$StageDir" "/DOUTPUT_EXE=$OutputExe" $NsiScript
if ($LASTEXITCODE -ne 0) {
    throw "makensis failed (exit code $LASTEXITCODE) - see output above."
}

# --- 7. Summary ---------------------------------------------------------------
function Get-DirSizeMB($path) {
    [math]::Round(((Get-ChildItem $path -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB), 1)
}

Write-Step "Build complete"
Write-Host "Staged tree:  $StageDir ($(Get-DirSizeMB $StageDir) MB)"
Write-Host "Installer:    $OutputExe ($([math]::Round((Get-Item $OutputExe).Length / 1MB, 1)) MB)"
Write-Host "Node runtime: v$NodeVersion"
Write-Host "Chromium:     $($ChromiumDir.Name)"
Write-Host "Package:      snare-web v$Version"
