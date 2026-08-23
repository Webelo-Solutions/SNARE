import "server-only";
import { fetchWithRetry } from "./retry";

export interface VirusTotalReputation {
  maliciousCount: number;
  suspiciousCount: number;
  reputation: number;
}

export interface UrlscanSignal {
  scanned: boolean;
  /** e.g. "certstream-suspicious" — urlscan's own automated system flagged
   * this domain as suspicious from a newly-issued certificate and scanned
   * it unprompted, independent of anyone submitting it manually. */
  source: string | null;
  scanUrl: string | null;
  /** Only populated with an API key — the public search endpoint doesn't
   * include verdicts, only the authenticated result-detail endpoint does. */
  malicious: boolean | null;
}

/**
 * VirusTotal domain reputation — requires an API key (every VT v3 endpoint
 * does; there's no public/unauthenticated tier). Standard, stable endpoint:
 * GET /api/v3/domains/{domain} -> data.attributes.last_analysis_stats.
 */
export async function getVirusTotalReputation(
  domain: string,
  apiKey: string
): Promise<VirusTotalReputation | null> {
  if (!apiKey) return null;
  try {
    const resp = await fetchWithRetry(
      `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(domain)}`,
      { headers: { "x-apikey": apiKey } },
      { attempts: 2, baseDelayMs: 1_000, timeoutMs: 10_000 }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const stats = data?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;
    return {
      maliciousCount: Number(stats.malicious ?? 0),
      suspiciousCount: Number(stats.suspicious ?? 0),
      reputation: Number(data.data.attributes.reputation ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * urlscan.io signal. The search endpoint (`task.domain:{domain}` — the
 * domain as actually submitted/scanned, not just referenced by a page) is
 * public and needs no API key, verified against the live API. It does NOT
 * include a malicious verdict, though — that's only on the authenticated
 * result-detail endpoint (confirmed: unauthenticated requests to
 * /api/v1/result/{uuid}/ return only {"warning": "You're not logged in!"}).
 * With an API key, this also fetches that detail for the real verdict —
 * that path is built from urlscan's documented response shape but wasn't
 * exercised against a live key during development, so treat `malicious`
 * as best-effort (null on any unexpected shape, never thrown).
 */
export async function getUrlscanSignal(domain: string, apiKey: string): Promise<UrlscanSignal> {
  const empty: UrlscanSignal = { scanned: false, source: null, scanUrl: null, malicious: null };

  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers["API-Key"] = apiKey;

    const searchResp = await fetchWithRetry(
      `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(`task.domain:${domain}`)}&size=1`,
      { headers },
      { attempts: 2, baseDelayMs: 1_000, timeoutMs: 10_000 }
    );
    if (!searchResp.ok) return empty;
    const searchData = await searchResp.json();
    const top = searchData?.results?.[0];
    if (!top) return empty;

    const signal: UrlscanSignal = {
      scanned: true,
      source: top.task?.source ?? null,
      scanUrl: top._id ? `https://urlscan.io/result/${top._id}/` : null,
      malicious: null,
    };

    if (apiKey && top._id) {
      try {
        const detailResp = await fetchWithRetry(
          `https://urlscan.io/api/v1/result/${top._id}/`,
          { headers },
          { attempts: 1, timeoutMs: 10_000 }
        );
        if (detailResp.ok) {
          const detail = await detailResp.json();
          const malicious = detail?.verdicts?.overall?.malicious;
          if (typeof malicious === "boolean") signal.malicious = malicious;
        }
      } catch {
        // Verdict is a bonus on top of the already-useful "scanned" signal —
        // failing to fetch it shouldn't drop what we already have.
      }
    }

    return signal;
  } catch {
    return empty;
  }
}
