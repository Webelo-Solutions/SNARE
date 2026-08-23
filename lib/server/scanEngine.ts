import "server-only";
import type { Config, DomainResult, MatchSource, Pattern } from "@/lib/types";
import * as permutations from "./permutations";
import * as resolver from "./resolver";
import * as ctLogs from "./ctLogs";
import * as passiveDns from "./passiveDns";
import * as rdap from "./rdap";
import * as scoring from "./scoring";
import * as patternsLib from "./patterns";
import { getDb } from "./db";
import { emitScanEvent } from "./events";
import { loadConfig, updateConfig } from "./config";
import { dispatch as dispatchAlerts, filterAlertHits } from "./alerting";
import { emitAppAlert } from "./alertStream";
import { captureBatch } from "./screenshot";
import { classifyPermutation } from "./classifyPermutation";
import { detectParking } from "./parkingDetector";
import { getVirusTotalReputation, getUrlscanSignal } from "./reputation";

// Minimum structure-only score for an unresolved domain to be surfaced as an
// available defensive-registration candidate. Edit distance 2 = 25 pts.
const MIN_AVAILABLE_SCORE = 25;

function blankResult(domain: string, source: MatchSource, target: string): DomainResult {
  return {
    domain,
    source,
    target,
    firstSeen: null,
    registrar: null,
    ips: [],
    mxRecords: [],
    hasWeb: false,
    score: 0,
    abuseContact: "",
    screenshotPath: "",
    isNew: false,
    isAvailable: false,
    isCustomStubMatch: false,
    technique: "",
    parkedService: null,
    vtMaliciousCount: null,
    vtSuspiciousCount: null,
    urlscanScanned: false,
    urlscanSource: null,
    urlscanUrl: null,
    urlscanMalicious: null,
    ctLogIndex: null,
  };
}

interface WhoisEnrichment {
  registrar: string | null;
  creationDate: string | null;
  abuseEmail: string;
}

class ScanRun {
  private seen = new Set<string>();
  private newResults: DomainResult[] = [];
  private db = getDb();

  constructor(
    private scanId: number,
    private targets: string[],
    private config: Config,
    private patterns: Pattern[],
    private signal: AbortSignal
  ) {}

  get results(): DomainResult[] {
    return this.newResults;
  }

  async run(): Promise<void> {
    for (const target of this.targets) {
      if (this.signal.aborted) break;
      if (this.config.sources.ctLogs) await this.ctLogsPhase(target);
      if (this.signal.aborted) break;
      if (this.config.sources.dnsPermutation) await this.dnsPermutationPhase(target);
      if (this.signal.aborted) break;
      if (this.config.sources.passiveDns) await this.passiveDnsPhase(target);
    }
  }

  private passesPatterns(domain: string, target: string): boolean {
    return patternsLib.apply(domain, target, this.patterns);
  }

  private emit(result: DomainResult): void {
    if (this.seen.has(result.domain)) return;
    if (!this.passesPatterns(result.domain, result.target)) return;
    this.seen.add(result.domain);
    result.score = scoring.score(result);
    const isNew = this.db.saveResult(result, this.scanId);
    result.isNew = isNew;
    if (isNew) this.newResults.push(result);
    emitScanEvent(this.scanId, { type: "result", result });
  }

  private progress(current: number, total: number, label: string): void {
    emitScanEvent(this.scanId, { type: "progress", current, total, label });
  }

  /** Union of every custom-stub-derived variant shape for this target —
   * used to tag results so alerting can bypass the score threshold for
   * explicitly user-requested keyword matches. */
  private stubMatchSet(target: string): Set<string> {
    const stubs = this.config.customStubs;
    return new Set([
      ...permutations.customStubVariants(target, stubs, stubs),
      ...permutations.reverseSubdomainStubVariants(target, stubs),
    ]);
  }

  private technique(domain: string, target: string): string {
    return classifyPermutation(domain, target, this.config.customStubs);
  }

  private async checkParking(domain: string, hasWeb: boolean): Promise<string | null> {
    if (!hasWeb) return null;
    try {
      return await detectParking(domain);
    } catch {
      return null;
    }
  }

  /** Third-party reputation corroboration for a domain that actually
   * resolved — VirusTotal self-gates on having an API key configured;
   * urlscan's search runs regardless (its unauthenticated tier is real and
   * useful on its own — see reputation.ts), a key only unlocks its verdict. */
  private async checkReputation(
    domain: string,
    resolved: boolean
  ): Promise<
    Pick<
      DomainResult,
      | "vtMaliciousCount"
      | "vtSuspiciousCount"
      | "urlscanScanned"
      | "urlscanSource"
      | "urlscanUrl"
      | "urlscanMalicious"
    >
  > {
    const empty = {
      vtMaliciousCount: null,
      vtSuspiciousCount: null,
      urlscanScanned: false,
      urlscanSource: null,
      urlscanUrl: null,
      urlscanMalicious: null,
    } as const;
    if (!resolved) return empty;

    const [vt, urlscan] = await Promise.all([
      getVirusTotalReputation(domain, this.config.apiKeys.virustotal),
      getUrlscanSignal(domain, this.config.apiKeys.urlscan),
    ]);

    return {
      vtMaliciousCount: vt?.maliciousCount ?? null,
      vtSuspiciousCount: vt?.suspiciousCount ?? null,
      urlscanScanned: urlscan.scanned,
      urlscanSource: urlscan.source,
      urlscanUrl: urlscan.scanUrl,
      urlscanMalicious: urlscan.malicious,
    };
  }

  private async enrichWhois(domain: string): Promise<WhoisEnrichment> {
    if (!this.config.sources.whoisNrd) {
      return { registrar: null, creationDate: null, abuseEmail: "" };
    }
    try {
      const info = await rdap.lookup(domain);
      return {
        registrar: info.registrar,
        creationDate: info.creationDate,
        abuseEmail: info.abuseEmail,
      };
    } catch {
      return { registrar: null, creationDate: null, abuseEmail: "" };
    }
  }

  // ------------------------------------------------------------------ //

  private async ctLogsPhase(target: string): Promise<void> {
    this.progress(0, 0, `CT Logs — querying crt.sh + crt.name for ${target}`);
    const entries = await ctLogs.fetchCtLogs(target, this.signal);
    const stubMatches = this.stubMatchSet(target);

    for (let i = 0; i < entries.length; i++) {
      if (this.signal.aborted) break;
      const entry = entries[i];
      const domain = entry.domain;
      const dnsInfo = await resolver.resolveDomain(domain);
      const hasHit = dnsInfo.ips.length > 0;

      if (!hasHit && !this.config.showUnresolved) {
        this.progress(i + 1, entries.length, `CT Logs — ${domain}`);
        continue;
      }

      let whois: WhoisEnrichment = { registrar: null, creationDate: null, abuseEmail: "" };
      if (hasHit) whois = await this.enrichWhois(domain);

      const result = blankResult(domain, "CT Logs", target);
      result.firstSeen = entry.firstSeen ?? whois.creationDate;
      result.registrar = whois.registrar;
      result.ips = dnsInfo.ips;
      result.mxRecords = dnsInfo.mx;
      result.hasWeb = dnsInfo.hasWeb;
      result.abuseContact = whois.abuseEmail;
      result.raw = entry.raw;
      result.ctLogIndex = entry.sources.join(", ");
      result.isCustomStubMatch = stubMatches.has(domain);
      result.technique = this.technique(domain, target);
      result.parkedService = await this.checkParking(domain, result.hasWeb);
      Object.assign(result, await this.checkReputation(domain, hasHit));
      this.emit(result);
      this.progress(i + 1, entries.length, `CT Logs — ${domain}`);
    }
  }

  private async dnsPermutationPhase(target: string): Promise<void> {
    const stubs = this.config.customStubs;
    // customDomains gates the "always show as available" bypass below — an
    // unresolved reverse-subdomain candidate isn't something the target
    // could defensively register (it'd be a subdomain of someone else's
    // zone), so reverseSubStubDomains is deliberately excluded from it.
    const customDomains = permutations.customStubVariants(target, stubs, stubs);
    const reverseSubStubDomains = permutations.reverseSubdomainStubVariants(target, stubs);
    const allStubDomains = new Set([...customDomains, ...reverseSubStubDomains]);
    const variants = [
      ...new Set([...permutations.generate(target, stubs, stubs), ...reverseSubStubDomains]),
    ];
    const total = variants.length;
    this.progress(0, total, `DNS Permutation — ${total} variants for ${target}`);
    let resolvedCount = 0;

    await resolver.resolveBatch(
      variants,
      async (domain, dnsInfo) => {
        resolvedCount += 1;
        this.progress(resolvedCount, total, `DNS Permutation — ${domain}`);

        if (dnsInfo.ips.length === 0) {
          if (!this.config.includeAvailable) return;
          const candidate = blankResult(domain, "DNS Permutation", target);
          candidate.isAvailable = true;
          candidate.isCustomStubMatch = allStubDomains.has(domain);
          candidate.technique = this.technique(domain, target);
          candidate.score = scoring.score(candidate);
          // Custom-stub domains always surface (user explicitly asked for
          // them). Other unresolved domains need a minimum structural score
          // or the "show unresolved" toggle to avoid flooding results with noise.
          const isCustom = customDomains.has(domain);
          if (isCustom || candidate.score >= MIN_AVAILABLE_SCORE || this.config.showUnresolved) {
            this.emit(candidate);
          }
          return;
        }

        const whois = await this.enrichWhois(domain);
        const result = blankResult(domain, "DNS Permutation", target);
        result.firstSeen = whois.creationDate;
        result.registrar = whois.registrar;
        result.ips = dnsInfo.ips;
        result.mxRecords = dnsInfo.mx;
        result.hasWeb = dnsInfo.hasWeb;
        result.abuseContact = whois.abuseEmail;
        result.isCustomStubMatch = allStubDomains.has(domain);
        result.technique = this.technique(domain, target);
        result.parkedService = await this.checkParking(domain, result.hasWeb);
        Object.assign(result, await this.checkReputation(domain, true));
        this.emit(result);
      },
      this.signal
    );
  }

  private async passiveDnsPhase(target: string): Promise<void> {
    const clients = passiveDns.getClients(this.config.apiKeys);
    if (clients.length === 0) return;
    this.progress(0, 0, `Passive DNS — querying APIs for ${target}`);
    const stubMatches = this.stubMatchSet(target);

    for (const client of clients) {
      if (this.signal.aborted) break;
      const entries = await client.similarDomains(target);
      for (const entry of entries) {
        if (this.signal.aborted) break;
        const domain = entry.domain;
        const dnsInfo = await resolver.resolveDomain(domain);
        if (dnsInfo.ips.length === 0 && !this.config.showUnresolved) continue;

        const result = blankResult(domain, "Passive DNS", target);
        result.ips = dnsInfo.ips;
        result.mxRecords = dnsInfo.mx;
        result.hasWeb = dnsInfo.hasWeb;
        result.raw = entry.raw;
        result.isCustomStubMatch = stubMatches.has(domain);
        result.technique = this.technique(domain, target);
        result.parkedService = await this.checkParking(domain, result.hasWeb);
        Object.assign(result, await this.checkReputation(domain, dnsInfo.ips.length > 0));
        this.emit(result);
      }
    }
  }
}

interface ScanTask {
  controller: AbortController;
  promise: Promise<void>;
}

declare global {
  var __snareActiveScan: ScanTask | undefined;
}

export function isScanRunning(): boolean {
  return globalThis.__snareActiveScan !== undefined;
}

export function stopScan(): boolean {
  const active = globalThis.__snareActiveScan;
  if (!active) return false;
  active.controller.abort();
  return true;
}

/**
 * Start a scan against the given targets. Returns the scanId immediately;
 * the scan itself keeps running against the Node event loop after the
 * caller (an API route) has already sent its response — the async
 * equivalent of the Python ScannerThread.
 */
export function startScan(targets: string[], config: Config, patterns: Pattern[]): number {
  if (isScanRunning()) {
    throw new Error("A scan is already running");
  }

  const db = getDb();
  const scanId = db.beginScan(targets);
  const controller = new AbortController();
  const run = new ScanRun(scanId, targets, config, patterns, controller.signal);

  const promise = run
    .run()
    .catch((err) => {
      emitScanEvent(scanId, {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(async () => {
      const total = db.getResultsForScan(scanId).length;
      const newCount = run.results.length;
      db.completeScan(scanId, total, newCount);

      // Every scan (manual or scheduled) resets the schedule timer, mirroring
      // the desktop app's _post_scan_processing().
      const latest = loadConfig();
      updateConfig({ schedule: { ...latest.schedule, lastRunAt: new Date().toISOString() } });

      if (latest.alerts.enabled && run.results.length > 0) {
        const hits = filterAlertHits(run.results, latest.alerts);
        if (latest.alerts.inApp && hits.length > 0) {
          emitAppAlert({ type: "alert", scanId, results: hits });
        }

        const errors = await dispatchAlerts(run.results, latest.alerts);
        if (errors.length > 0) {
          emitScanEvent(scanId, {
            type: "warning",
            message: `Alert delivery errors: ${errors.join("; ")}`,
          });
        }
      }

      emitScanEvent(scanId, { type: "done", totalFound: total, newFound: newCount });
      globalThis.__snareActiveScan = undefined;

      // Fire-and-forget: screenshot capture is slow (up to ~12s/domain,
      // sequential) and shouldn't delay "done". Results pick up the new
      // screenshotPath next time that scan's data is fetched.
      if (latest.schedule.screenshotsEnabled) {
        const webActive = db
          .getResultsForScan(scanId)
          .filter((r) => r.hasWeb && !r.screenshotPath)
          .map((r) => ({ domain: r.domain, target: r.target }));
        if (webActive.length > 0) {
          captureBatch(webActive, (domain, target, path) => {
            db.updateScreenshot(domain, target, path);
          }).catch(() => {
            // Best-effort background job — failures are per-domain and
            // already swallowed inside captureBatch.
          });
        }
      }
    });

  globalThis.__snareActiveScan = { controller, promise };
  return scanId;
}
