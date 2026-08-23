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

class VirusTotalClient implements PassiveDnsClient {
  private static readonly BASE = "https://www.virustotal.com/api/v3";
  constructor(private apiKey: string) {}

  async similarDomains(domain: string): Promise<PassiveDnsEntry[]> {
    try {
      const resp = await fetch(`${VirusTotalClient.BASE}/domains/${encodeURIComponent(domain)}/related`, {
        headers: { "x-apikey": this.apiKey },
        signal: AbortSignal.timeout(15_000),
      });
      const data = await resp.json();
      const items: Array<{ id: string; type: string }> = data.data ?? [];
      return items.filter((i) => i.type === "domain").map((i) => ({ domain: i.id, raw: i }));
    } catch {
      return [];
    }
  }
}

export function getClients(apiKeys: ApiKeys): PassiveDnsClient[] {
  const clients: PassiveDnsClient[] = [];
  if (apiKeys.securitytrails) clients.push(new SecurityTrailsClient(apiKeys.securitytrails));
  if (apiKeys.virustotal) clients.push(new VirusTotalClient(apiKeys.virustotal));
  return clients;
}
