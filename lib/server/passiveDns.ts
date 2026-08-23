import "server-only";
import type { ApiKeys } from "@/lib/types";

export interface PassiveDnsEntry {
  domain: string;
  raw: unknown;
}

export interface PassiveDnsClient {
  similarDomains(domain: string): Promise<PassiveDnsEntry[]>;
}

class SecurityTrailsClient implements PassiveDnsClient {
  private static readonly BASE = "https://api.securitytrails.com/v1";
  constructor(private apiKey: string) {}

  async similarDomains(domain: string): Promise<PassiveDnsEntry[]> {
    try {
      // The Python original issues this as a GET with a JSON body (a
      // `requests`-specific quirk); `fetch` rejects a body on GET, and
      // SecurityTrails' own docs specify POST for this search endpoint.
      const resp = await fetch(`${SecurityTrailsClient.BASE}/domains/list`, {
        method: "POST",
        headers: { APIKEY: this.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ filter: { apex_domain: domain } }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await resp.json();
      const records: string[] = data.records ?? [];
      return records.map((d) => ({ domain: d, raw: d }));
    } catch {
      return [];
    }
  }
}

// VirusTotal previously had a client here calling /domains/{domain}/related
// as a "similar domains" discovery source — that endpoint doesn't actually
// exist in VT's v3 API (there's no "related" relationship type for
// domains), so it would have silently returned nothing every time. VT's
// real strength is domain reputation, not fuzzy name-based discovery — see
// reputation.ts, which uses the correct, well-documented /domains/{domain}
// endpoint as a scoring/enrichment signal on domains already found here.

export function getClients(apiKeys: ApiKeys): PassiveDnsClient[] {
  const clients: PassiveDnsClient[] = [];
  if (apiKeys.securitytrails) clients.push(new SecurityTrailsClient(apiKeys.securitytrails));
  return clients;
}
