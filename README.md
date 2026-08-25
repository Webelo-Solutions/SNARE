# SNARE

Web-based typosquat and homoglyph domain monitoring for brand protection. Rebuilt from the original PyQt6 desktop app as a self-hosted Next.js app — single user, no login, no external backend.

## Features

- **Domain permutation generation** — character deletion/doubling/transposition, QWERTY-adjacent substitution, homoglyphs, Cyrillic confusables, leetspeak, combosquatting, TLD variation, and custom prefix/suffix stubs
- **Multi-source discovery** — Certificate Transparency log search (crt.sh), DNS resolution of generated permutations, WHOIS/RDAP enrichment with newly-registered-domain (NRD) detection, and optional Passive DNS (SecurityTrails or VirusTotal)
- **Reputation enrichment** — optional VirusTotal AV-vendor verdicts and urlscan.io scan lookups (urlscan search works unauthenticated; a key raises rate limits and unlocks the malicious verdict)
- **Domain-parking detection** — flags domains that resolve to a parking/marketplace page (Sedo, GoDaddy Parking, etc.) as a separate signal from risk score
- **0–100 risk scoring** with results streamed live to the UI during a scan (Server-Sent Events)
- **Include/exclude pattern filters** — regex, keyword, edit distance, and combosquat-position rules, each independently enabled/disabled
- **Scan history** with delta ("new domain") detection between runs and CSV export
- **Scheduled recurring scans** — runs unattended on an hourly interval, no browser tab required, via an `instrumentation.ts`-based scheduler loop
- **Alerting** — in-app toast/desktop notification, email (SMTP), Slack webhook, and Microsoft Teams webhook, gated by a minimum risk score (custom-stub matches always alert regardless of score)
- **Screenshot capture** of live squatted sites via Playwright, optionally taken automatically on scheduled scans
- **Takedown notice generation** and registrar abuse-contact lookup
- **One-click defensive registration links** for Namecheap, GoDaddy, Porkbun, Dynadot, Hover, and Squarespace

## Requirements

- [Node.js](https://nodejs.org/) 20 or later (tested on Node 24)
- Windows, macOS, or Linux — data paths are OS-aware (see [Data storage](#data-storage))
- Internet access for the scan itself (crt.sh, RDAP/WHOIS, DNS, and whichever optional providers you configure)

## Installing and compiling

Clone the repository and install dependencies:

```bash
git clone https://github.com/Webelo-Solutions/SNARE.git
cd SNARE
npm install
```

Screenshot capture uses Playwright's bundled Chromium, which is downloaded separately from the npm package:

```bash
npx playwright install chromium
```

Compile a production build:

```bash
npm run build
```

This produces the optimized `.next` build that `npm start` serves. Re-run `npm run build` after pulling new code or changing any source file — `npm start` will not pick up source changes on its own.

## Running it

For interactive use during setup or one-off scans:

```bash
npm run dev            # http://localhost:3000, rebuilds on file changes
```

For anything relying on **scheduled** scans, run the compiled production build instead — the scheduler loop only needs the process alive, not a browser tab open:

```bash
npm run build
npm start
```

Leave that process running (its own terminal, a background job, or a service — see below) for scheduled scans and alerts to keep firing.

### Running as a Windows service

`scripts/install-service.ps1` installs SNARE as a Windows service (via [NSSM](https://nssm.cc/), installed automatically through `winget` if missing) so it starts on boot and survives logoff, running the same `%APPDATA%\snare` data directory as interactive use.

From an elevated (Administrator) PowerShell, after `npm install` and `npm run build`:

```powershell
# One-time: install Chromium where the service (running as Local System) can find it
$env:PLAYWRIGHT_BROWSERS_PATH = 0
npx playwright install chromium

# Install and start the service
.\scripts\install-service.ps1
```

Manage the resulting `SNARE` service with the usual Windows service commands:

```powershell
Start-Service SNARE
Stop-Service SNARE
Get-Service SNARE
nssm remove SNARE confirm   # uninstall
```

Service logs are written to `service-logs\stdout.log` / `stderr.log` in the project directory, with automatic rotation past 10 MB.

## Configuration and options

All configuration is done from the Settings page in the running app (no `.env` file required) and persisted to `config.json` in the data directory:

| Area | Options |
|---|---|
| **Targets** | One or more brand domains to monitor for lookalikes |
| **Sources** | Toggle CT Logs, DNS Permutation, WHOIS/NRD, and Passive DNS independently |
| **API keys** | SecurityTrails and/or VirusTotal (Passive DNS), VirusTotal (reputation), urlscan.io (optional, raises rate limits and unlocks verdicts) |
| **Patterns** | Include/exclude rules of type Regex, Keyword, Edit Distance, or Combosquat, each toggleable |
| **Custom stubs** | Prefix/suffix keywords that always trigger an alert on match, regardless of score threshold |
| **NRD window** | How many days back counts as "newly registered" for WHOIS/NRD matching (default 30) |
| **Show unresolved** | Whether to include domains that don't currently resolve in results |
| **Include available** | Whether to include domains that are unregistered/available for registration in results |
| **Preferred registrar** | Default registrar used for one-click defensive registration links |
| **Schedule** | Enable/disable recurring scans, interval in hours, whether to auto-capture screenshots on scheduled runs |
| **Alerts** | Enable/disable, minimum risk score to trigger, in-app toast/desktop notification, email (SMTP host/port/user/pass/TLS + recipient), Slack webhook URL, Teams webhook URL |
| **Sender profile** | Name/title/company/email/phone/address used when generating takedown notices |

## Data storage

All state lives locally:

- Windows: `%APPDATA%\snare\`
- macOS/Linux: `~/.snare/`
- Override with the `SNARE_DATA_DIR` environment variable (used by the Windows service so it doesn't depend on the interactive user's profile)

Inside that directory:

- `config.json` — targets, patterns, source toggles, API keys, sender profile, schedule, alert channels
- `snare.db` — SQLite database of every scan run and discovered domain
- `screenshots\` — captured PNGs of web-active squatted domains

No data leaves your machine except the outbound lookups the scan itself makes (crt.sh, RDAP/WHOIS, DNS, and — if configured — SecurityTrails/VirusTotal/urlscan, SMTP, Slack/Teams webhooks).

## Tech stack

Next.js (App Router) + TypeScript, `better-sqlite3`, Server-Sent Events for live scan progress, an `instrumentation.ts`-based scheduler loop, Playwright for screenshots, Tailwind + shadcn/ui for the UI.
