import "server-only";
import { Resolver } from "node:dns/promises";
import pLimit from "p-limit";

// Use public DNS servers for reliable external resolution. Internal
// nameservers (10.x, 192.168.x) often time out for domains outside the
// local network, which is exactly what SNARE queries.
const PUBLIC_DNS = ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"];
const TIMEOUT_MS = 3_000;

function newResolver(): Resolver {
  const resolver = new Resolver({ timeout: TIMEOUT_MS, tries: 1 });
  resolver.setServers(PUBLIC_DNS);
  return resolver;
}

export interface DnsInfo {
  ips: string[];
  mx: string[];
  hasWeb: boolean;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ETIMEOUT")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export async function resolveDomain(domain: string): Promise<DnsInfo> {
  const resolver = newResolver();
  const result: DnsInfo = { ips: [], mx: [], hasWeb: false };

  try {
    const answers = await withTimeout(resolver.resolve4(domain), TIMEOUT_MS + 500);
    result.ips = answers;
    result.hasWeb = true;
  } catch {
    // NXDOMAIN / NODATA / timeout / no nameservers — leave ips empty
  }

  try {
    const answers = await withTimeout(resolver.resolveMx(domain), TIMEOUT_MS + 500);
    result.mx = answers
      .sort((a, b) => a.priority - b.priority)
      .map((r) => r.exchange.replace(/\.$/, ""));
  } catch {
    // no MX records
  }

  return result;
}

export async function resolveBatch(
  domains: string[],
  onResolved: (domain: string, info: DnsInfo) => void | Promise<void>,
  signal?: AbortSignal,
  concurrency = 50
): Promise<void> {
  const limit = pLimit(concurrency);
  await Promise.all(
    domains.map((domain) =>
      limit(async () => {
        if (signal?.aborted) return;
        try {
          const info = await resolveDomain(domain);
          // Awaited here (not fire-and-forget) so callback work — e.g.
          // per-domain WHOIS/RDAP enrichment — stays bounded by the same
          // concurrency limit as the DNS lookups themselves.
          if (!signal?.aborted) await onResolved(domain, info);
        } catch {
          // swallow — a single lookup failure shouldn't abort the batch
        }
      })
    )
  );
}
