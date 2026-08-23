// Shared client/server types — mirrors snare/models/domain.py and snare/config.py

// Mirrors snare/models/domain.py MatchSource. Only CT_LOGS, DNS_PERMUTATION,
// and PASSIVE_DNS are ever assigned as a result's source in practice —
// WHOIS/NRD enrichment augments a result rather than sourcing one — but the
// full enum is kept for parity with the original.
export type MatchSource = "CT Logs" | "DNS Permutation" | "WHOIS/NRD" | "Passive DNS";

export interface DomainResult {
  id?: number;
  domain: string;
  source: MatchSource;
  target: string;
  firstSeen: string | null; // ISO timestamp
  registrar: string | null;
  ips: string[];
  mxRecords: string[];
  hasWeb: boolean;
  score: number;
  abuseContact: string;
  screenshotPath: string;
  isNew: boolean;
  isAvailable: boolean;
  /** True when this domain matches a user-defined custom stub (any of the
   * prefix/suffix/subdomain-of-target/subdomain-of-stub shapes) — such
   * matches bypass the alert score threshold, since they're explicit
   * keywords the user asked to always be notified about. */
  isCustomStubMatch: boolean;
  raw?: unknown;
}

export type PatternType = "Regex" | "Keyword" | "Edit Distance" | "Combosquat";
export type PatternMode = "Include" | "Exclude";

export interface Pattern {
  id: string;
  name: string;
  type: PatternType;
  value: string;
  mode: PatternMode;
  enabled: boolean;
}

export interface SourceConfig {
  ctLogs: boolean;
  dnsPermutation: boolean;
  whoisNrd: boolean;
  passiveDns: boolean;
}

export interface ApiKeys {
  securitytrails: string;
  virustotal: string;
}

export interface SenderProfile {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  address: string;
}

export interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  lastRunAt: string; // ISO-8601 UTC, "" if never run
  screenshotsEnabled: boolean;
}

export interface AlertConfig {
  enabled: boolean;
  minScore: number;
  emailTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpTls: boolean;
  slackWebhook: string;
  teamsWebhook: string;
}

export type RegistrarKey =
  | "namecheap"
  | "godaddy"
  | "porkbun"
  | "dynadot"
  | "hover"
  | "squarespace";

export interface Config {
  targets: string[];
  sources: SourceConfig;
  apiKeys: ApiKeys;
  patterns: Pattern[];
  sender: SenderProfile;
  nrdDays: number;
  showUnresolved: boolean;
  schedule: ScheduleConfig;
  alerts: AlertConfig;
  preferredRegistrar: RegistrarKey;
  customStubs: string[];
  includeAvailable: boolean;
}

export interface ScanSummary {
  id: number;
  startedAt: string;
  completedAt: string | null;
  targets: string[];
  totalFound: number;
  newFound: number;
}

export interface ScanProgressEvent {
  type: "progress";
  current: number;
  total: number;
  label: string;
}

export interface ScanResultEvent {
  type: "result";
  result: DomainResult;
}

export interface ScanErrorEvent {
  type: "error";
  message: string;
}

/** Non-fatal, post-scan issue (e.g. an alert channel failed to send) — does
 * not end the scan or change its status, unlike ScanErrorEvent. */
export interface ScanWarningEvent {
  type: "warning";
  message: string;
}

export interface ScanDoneEvent {
  type: "done";
  totalFound: number;
  newFound: number;
}

export type ScanEvent =
  | ScanProgressEvent
  | ScanResultEvent
  | ScanErrorEvent
  | ScanWarningEvent
  | ScanDoneEvent;
