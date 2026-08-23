import "server-only";

export interface CtLogEntry {
  domain: string;
  firstSeen: string | null; // ISO date
  raw: unknown;
}

interface CrtShEntry {
  name_value?: string;
  not_before?: string;
  [key: string]: unknown;
}

export async function fetchCtLogs(domain: string, signal?: AbortSignal): Promise<CtLogEntry[]> {
  const url = `https://crt.sh/?q=%.${encodeURIComponent(domain)}&output=json`;
  let entries: CrtShEntry[];
  try {
    const resp = await fetch(url, { signal, headers: { Accept: "application/json" } });
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

      results.push({ domain: name, firstSeen, raw: entry });
    }
  }

  return results;
}
