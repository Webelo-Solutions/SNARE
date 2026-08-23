import "server-only";
import { fetchWithRetry } from "./retry";

export interface CtLogEntry {
  domain: string;
  firstSeen: string | null; // ISO date
  /** Which CT-log index(es) surfaced this domain — e.g. ["crt.sh"],
   * ["crt.name"], or both when the same subdomain appears in each
   * independently-maintained index. */
  sources: string[];
  raw: unknown;
}

interface CrtShEntry {
  name_value?: string;
  not_before?: string;
  [key: string]: unknown;
}

/** crt.sh — the original CT-log source. Has been observed returning
 * transient 502s, hence fetchWithRetry rather than treating that
 * identically to "no results". */
async function fetchCrtSh(domain: string, signal?: AbortSignal): Promise<CtLogEntry[]> {
  const url = `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`;
  let entries: CrtShEntry[];
  try {
    const resp = await fetchWithRetry(
      url,
      { headers: { Accept: "application/json" } },
      { signal, attempts: 3, baseDelayMs: 1_000, timeoutMs: 20_000 }
    );
    if (!resp.ok) return [];
    entries = await resp.json();
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const results: CtLogEntry[] = [];

  for (const entry of entries) {
    if (signal?.aborted) break;
    const nameValue = entry.name_value ?? "";
    for (const rawName of nameValue.split("\n")) {
      const name = rawName.trim().replace(/^\*\./, "");
      if (!name || seen.has(name) || name === domain) continue;
      seen.add(name);

      let firstSeen: string | null = null;
      const notBefore = entry.not_before ?? "";
      const datePart = notBefore.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const d = new Date(`${datePart}T00:00:00Z`);
        if (!Number.isNaN(d.getTime())) firstSeen = d.toISOString();
      }

      results.push({ domain: name, firstSeen, sources: ["crt.sh"], raw: entry });
    }
  }

  return results;
}

interface CrtNameEntry {
  sub?: string;
  first_seen?: string;
}

/** crt.name — a second, independently-maintained CT-log subdomain index.
 * Verified live: GET /v1/search?apex={eTLD+1}&format=json&dates=1, free,
 * no token, 1000 req/IP/day. Same job as crt.sh (subdomains of a given
 * apex via Certificate Transparency), not a "similar domain" discovery
 * source — merged here purely for resilience against crt.sh's observed
 * transient outages, not as a replacement for Passive DNS. */
async function fetchCrtName(domain: string, signal?: AbortSignal): Promise<CtLogEntry[]> {
  const url = `https://crt.name/v1/search?apex=${encodeURIComponent(domain)}&format=json&dates=1`;
  let entries: CrtNameEntry[];
  try {
    const resp = await fetchWithRetry(
      url,
      { headers: { Accept: "application/json" } },
      { signal, attempts: 2, baseDelayMs: 1_000, timeoutMs: 15_000 }
    );
    if (!resp.ok) return [];
    entries = await resp.json();
  } catch {
    return [];
  }

  const results: CtLogEntry[] = [];
  for (const entry of entries) {
    if (signal?.aborted) break;
    const name = (entry.sub ?? "").trim().replace(/^\*\./, "");
    if (!name || name === domain) continue;

    let firstSeen: string | null = null;
    if (entry.first_seen) {
      const d = new Date(entry.first_seen);
      if (!Number.isNaN(d.getTime())) firstSeen = d.toISOString();
    }

    results.push({ domain: name, firstSeen, sources: ["crt.name"], raw: entry });
  }

  return results;
}

/**
 * Queries both CT-log indexes concurrently and merges them: a subdomain
 * found in only one index is tagged with just that source; one found in
 * both gets both source names and the earlier (more accurate) firstSeen
 * date. If one index is down, the scan still gets full coverage from the
 * other rather than silently returning nothing for this phase.
 */
export async function fetchCtLogs(domain: string, signal?: AbortSignal): Promise<CtLogEntry[]> {
  const [crtSh, crtName] = await Promise.all([
    fetchCrtSh(domain, signal),
    fetchCrtName(domain, signal),
  ]);

  const merged = new Map<string, CtLogEntry>();

  for (const entry of [...crtSh, ...crtName]) {
    const existing = merged.get(entry.domain);
    if (!existing) {
      merged.set(entry.domain, entry);
      continue;
    }

    const earlier =
      existing.firstSeen && entry.firstSeen
        ? existing.firstSeen < entry.firstSeen
          ? existing.firstSeen
          : entry.firstSeen
        : (existing.firstSeen ?? entry.firstSeen);

    merged.set(entry.domain, {
      domain: entry.domain,
      firstSeen: earlier,
      sources: [...new Set([...existing.sources, ...entry.sources])],
      raw: existing.raw,
    });
  }

  return [...merged.values()];
}
