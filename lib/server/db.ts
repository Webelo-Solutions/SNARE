import "server-only";
import fs from "node:fs";
import Database from "better-sqlite3";
import { DB_PATH, ensureDataDirs } from "./paths";
import type { DomainResult, MatchSource, ScanSummary } from "@/lib/types";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS scans (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT    NOT NULL,
    completed_at TEXT,
    targets      TEXT    NOT NULL,
    total_found  INTEGER DEFAULT 0,
    new_found    INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS results (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id          INTEGER,
    domain           TEXT    NOT NULL,
    target           TEXT    NOT NULL,
    source           TEXT    NOT NULL,
    score            INTEGER DEFAULT 0,
    first_seen       TEXT,
    registrar        TEXT,
    ips              TEXT    DEFAULT '[]',
    mx_records       TEXT    DEFAULT '[]',
    has_web          INTEGER DEFAULT 0,
    abuse_contact    TEXT    DEFAULT '',
    screenshot_path  TEXT    DEFAULT '',
    technique        TEXT    DEFAULT '',
    first_discovered TEXT    NOT NULL,
    last_seen        TEXT    NOT NULL,
    UNIQUE(domain, target)
);

CREATE INDEX IF NOT EXISTS idx_results_domain ON results(domain, target);
CREATE INDEX IF NOT EXISTS idx_results_scan   ON results(scan_id);
`;

interface ResultRow {
  id: number;
  scan_id: number | null;
  domain: string;
  target: string;
  source: string;
  score: number;
  first_seen: string | null;
  registrar: string | null;
  ips: string;
  mx_records: string;
  has_web: number;
  abuse_contact: string;
  screenshot_path: string;
  technique: string | null;
  first_discovered: string;
  last_seen: string;
}

interface ScanRow {
  id: number;
  started_at: string;
  completed_at: string | null;
  targets: string;
  total_found: number;
  new_found: number;
}

function now(): string {
  return new Date().toISOString();
}

function rowToDomainResult(row: ResultRow): DomainResult {
  const source = row.source as MatchSource;
  const ips: string[] = JSON.parse(row.ips || "[]");
  const mxRecords: string[] = JSON.parse(row.mx_records || "[]");

  // A DNS-permutation result with no resolved IPs represents an unregistered
  // domain available for defensive registration.
  const isAvailable = source === "DNS Permutation" && ips.length === 0;

  let screenshotPath = row.screenshot_path || "";
  // turbopackIgnore: this path is a runtime value under the app's own
  // screenshot dir, not a build-time asset — safe to skip Turbopack's
  // whole-project dependency tracing for it.
  if (screenshotPath && !fs.existsSync(/*turbopackIgnore: true*/ screenshotPath)) {
    screenshotPath = "";
  }

  return {
    id: row.id,
    domain: row.domain,
    source,
    target: row.target,
    firstSeen: row.first_seen,
    registrar: row.registrar,
    ips,
    mxRecords,
    hasWeb: Boolean(row.has_web),
    score: row.score,
    abuseContact: row.abuse_contact || "",
    screenshotPath,
    technique: row.technique || "",
    isNew: false,
    isAvailable,
    // Not persisted — derived from the *current* custom stub config at scan
    // time, same reasoning as isNew above. A reload of a historical scan
    // can't retroactively know what stubs were configured back then.
    isCustomStubMatch: false,
  };
}

function rowToScanSummary(row: ScanRow): ScanSummary {
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    targets: JSON.parse(row.targets || "[]"),
    totalFound: row.total_found,
    newFound: row.new_found,
  };
}

class SnareDatabase {
  private conn: Database.Database;

  constructor() {
    ensureDataDirs();
    this.conn = new Database(DB_PATH);
    this.conn.pragma("journal_mode = WAL");
    this.conn.pragma("busy_timeout = 5000");
    this.conn.exec(SCHEMA);
    this.migrate();
  }

  /** Additive schema changes for databases created before a given column
   * existed. CREATE TABLE IF NOT EXISTS above only applies to brand-new
   * databases, so existing ones need an explicit ALTER TABLE. */
  private migrate(): void {
    const columns = this.conn.prepare("PRAGMA table_info(results)").all() as Array<{
      name: string;
    }>;
    const hasColumn = (name: string) => columns.some((c) => c.name === name);

    if (!hasColumn("technique")) {
      this.conn.exec("ALTER TABLE results ADD COLUMN technique TEXT DEFAULT ''");
    }
  }

  beginScan(targets: string[]): number {
    const stmt = this.conn.prepare(
      "INSERT INTO scans (started_at, targets) VALUES (?, ?)"
    );
    const info = stmt.run(now(), JSON.stringify(targets));
    return Number(info.lastInsertRowid);
  }

  completeScan(scanId: number, total: number, newCount: number): void {
    this.conn
      .prepare(
        "UPDATE scans SET completed_at=?, total_found=?, new_found=? WHERE id=?"
      )
      .run(now(), total, newCount, scanId);
  }

  /** Insert-or-update a result. Returns true the first time this
   * (domain, target) pair is ever seen — drives "new domain" alerting. */
  saveResult(result: DomainResult, scanId: number): boolean {
    const ts = now();
    try {
      this.conn
        .prepare(
          `INSERT INTO results
            (scan_id, domain, target, source, score, first_seen,
             registrar, ips, mx_records, has_web, abuse_contact,
             screenshot_path, technique, first_discovered, last_seen)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          scanId,
          result.domain,
          result.target,
          result.source,
          result.score,
          result.firstSeen,
          result.registrar,
          JSON.stringify(result.ips),
          JSON.stringify(result.mxRecords),
          result.hasWeb ? 1 : 0,
          result.abuseContact,
          result.screenshotPath,
          result.technique,
          ts,
          ts
        );
      return true;
    } catch (err) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: string }).code === "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        this.conn
          .prepare(
            `UPDATE results
             SET scan_id=?, score=?, registrar=?, ips=?, mx_records=?,
                 has_web=?, abuse_contact=?, technique=?, last_seen=?
             WHERE domain=? AND target=?`
          )
          .run(
            scanId,
            result.score,
            result.registrar,
            JSON.stringify(result.ips),
            JSON.stringify(result.mxRecords),
            result.hasWeb ? 1 : 0,
            result.abuseContact,
            result.technique,
            ts,
            result.domain,
            result.target
          );
        return false;
      }
      throw err;
    }
  }

  updateScreenshot(domain: string, target: string, path: string): void {
    this.conn
      .prepare(
        "UPDATE results SET screenshot_path=? WHERE domain=? AND target=?"
      )
      .run(path, domain, target);
  }

  getResultById(id: number): DomainResult | null {
    const row = this.conn.prepare("SELECT * FROM results WHERE id=?").get(id) as
      | ResultRow
      | undefined;
    return row ? rowToDomainResult(row) : null;
  }

  getScanHistory(limit = 50): ScanSummary[] {
    const rows = this.conn
      .prepare("SELECT * FROM scans ORDER BY started_at DESC LIMIT ?")
      .all(limit) as ScanRow[];
    return rows.map(rowToScanSummary);
  }

  getScan(scanId: number): ScanSummary | null {
    const row = this.conn
      .prepare("SELECT * FROM scans WHERE id = ?")
      .get(scanId) as ScanRow | undefined;
    return row ? rowToScanSummary(row) : null;
  }

  getResultsForScan(scanId: number): DomainResult[] {
    const rows = this.conn
      .prepare("SELECT * FROM results WHERE scan_id=? ORDER BY score DESC")
      .all(scanId) as ResultRow[];
    return rows.map(rowToDomainResult);
  }

  getLatestCompletedScan(): ScanSummary | null {
    const row = this.conn
      .prepare(
        "SELECT * FROM scans WHERE completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1"
      )
      .get() as ScanRow | undefined;
    return row ? rowToScanSummary(row) : null;
  }

  close(): void {
    this.conn.close();
  }
}

declare global {
  var __snareDb: SnareDatabase | undefined;
}

export function getDb(): SnareDatabase {
  if (!globalThis.__snareDb) {
    globalThis.__snareDb = new SnareDatabase();
  }
  return globalThis.__snareDb;
}
