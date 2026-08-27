# SNARE installer build

Produces `dist\SNARE-Setup-<version>.exe` — a self-contained Windows installer
for SNARE. It bundles a portable Node.js runtime, the Next.js standalone
build, the native `better-sqlite3` binding, and a trimmed Playwright Chromium
build, so the **target host needs no Node, npm, git, or internet access** to
install and run SNARE. Chromium and better-sqlite3's native binary are already
Windows x64 only — this pipeline does not produce macOS/Linux installers.

This is a build-machine tool. Run it from a normal SNARE dev checkout (i.e.
one with Node.js/npm already set up) — the resulting `.exe` is what you hand
to a target host, not this script.

## One-time build-machine setup

Nothing to do manually — `build-installer.ps1` installs NSIS and NSSM via
`winget` automatically on first run if they aren't already on `PATH`. If your
machine can't reach `winget` (e.g. no internet, locked-down policy), install
them yourself first:

- NSIS: https://nsis.sourceforge.io/Download
- NSSM: https://nssm.cc/download

## Building

From an elevated PowerShell, at the repo root:

```powershell
.\scripts\installer\build-installer.ps1
```

This runs `npm ci` + `npm run build` (standalone output), downloads and stages
a portable Node.js runtime and Playwright's Chromium, then compiles
`installer.nsi` into `dist\SNARE-Setup-<version>.exe`. Build artifacts
(downloaded runtime/browser caches, the staged tree, the final `.exe`) live
under the gitignored `dist\` directory — only the scripts here are committed.

Re-run the script after any source change or `package.json` version bump; it
rebuilds from scratch each time (`npm ci`, fresh `next build`), though the
downloaded Node.js zip is cached under `dist\cache\` between runs.

## What the installer does

- Installs the app under `Program Files\SNARE` with Start Menu shortcuts
  (Start SNARE, Stop SNARE, Uninstall SNARE) and a standard uninstaller.
- Offers an optional "Install as Windows Service" component (unchecked by
  default) that registers SNARE via a bundled NSSM to auto-start on boot,
  replacing the need to separately run the older `scripts\install-service.ps1`.
- Without that option, SNARE runs as a foreground process started from the
  Start Menu shortcut (or the finish-page "Launch SNARE now" checkbox),
  opening `http://localhost:3000` in the default browser.
- Data (`config.json`, `snare.db`, `screenshots\`) is written to
  `%APPDATA%\snare`, same as every other install method — see the main
  [README](../../README.md#data-storage). The uninstaller asks before
  deleting it (default: keep).

## Manual verification after a build

Test on a machine (or clean VM) without Node/npm/git installed, ideally with
networking disabled to confirm the install is genuinely self-contained:

1. Run the `.exe`; confirm the install directory has `app\`, `runtime\`,
   `browsers\`, and Start Menu shortcuts exist.
2. Launch it; confirm `http://localhost:3000` loads and
   `%APPDATA%\snare\config.json` / `snare.db` get created.
3. Add a target domain and run a manual scan — exercises the embedded
   `better-sqlite3` binary.
4. Capture a screenshot of a result — exercises the relocated, trimmed
   `PLAYWRIGHT_BROWSERS_PATH` resolution.
5. Temporarily shrink the schedule interval and confirm a scheduled scan
   fires — confirms `instrumentation.ts`'s scheduler loop survived tracing.
6. Use "Stop SNARE"; confirm `node.exe` actually terminates (Task Manager).
7. Re-run the installer with "Install as Windows Service" checked; confirm
   the `SNARE` service starts automatically and survives a reboot.
8. Run the uninstaller; confirm it stops/removes the service (if installed),
   removes the install directory and Start Menu group, honors both answers
   to the data-deletion prompt, and no longer appears in "Add or Remove
   Programs".
