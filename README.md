# SNARE

Web-based typosquat and homoglyph domain monitoring for brand protection. Rebuilt from the original PyQt6 desktop app as a self-hosted Next.js app — single user, no login.

## Features

- Domain permutation generation (character deletion/doubling/transposition, QWERTY-adjacent substitution, homoglyphs, Cyrillic confusables, leetspeak, combosquatting, TLD variation, custom prefix/suffix stubs)
- Certificate Transparency log search (crt.sh), DNS resolution, WHOIS/RDAP enrichment, optional Passive DNS (SecurityTrails / VirusTotal)
- 0–100 risk scoring with live-streaming results during a scan
- Include/exclude pattern filters (regex, keyword, edit distance, combosquat position)
- Scan history with delta ("new domain") detection, CSV export
- Scheduled recurring scans (runs unattended, no browser tab required)
- Email / Slack / Microsoft Teams alerts for new high-risk domains
- Screenshot capture of live squatted sites (Playwright)
- Takedown notice generation + registrar abuse-contact lookup
- One-click defensive registration links (Namecheap, GoDaddy, Porkbun, Dynadot, Hover, Squarespace)

## Running it

```bash
npm install
npm run dev            # interactive use — http://localhost:3000
```

For scheduled scans to keep firing unattended, run it as a standing production server instead of dev mode:

```bash
npm run build
npm start
```

Leave that process running (e.g. in its own terminal, or as a background/Task Scheduler job) for scheduled scans and alerts to fire without a browser open.

## Data storage

All state lives locally under `%APPDATA%\snare\`:

- `config.json` — targets, patterns, source toggles, API keys, sender profile, schedule, alert channels
- `snare.db` — SQLite database of every scan run and discovered domain
- `screenshots\` — captured PNGs of web-active squatted domains

No data leaves your machine except the outbound lookups the scan itself makes (crt.sh, RDAP/WHOIS, DNS, and — if configured — SecurityTrails/VirusTotal, SMTP, Slack/Teams webhooks).

## Tech stack

Next.js (App Router) + TypeScript, `better-sqlite3`, Server-Sent Events for live scan progress, an `instrumentation.ts`-based scheduler loop, Playwright for screenshots, Tailwind + shadcn/ui for the UI.
