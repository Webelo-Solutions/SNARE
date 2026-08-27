import type { Config, DomainResult, Pattern, ResultStatus, ScanSummary } from "@/lib/types";

export interface AbuseContactInfo {
  email: string | null;
  phone: string | null;
  name: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getConfig: () => fetch("/api/config").then((r) => json<Config>(r)),
  saveConfig: (config: Config) =>
    fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    }).then((r) => json<Config>(r)),

  startScan: (targets?: string[]) =>
    fetch("/api/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets }),
    }).then((r) => json<{ scanId: number }>(r)),
  stopScan: (scanId: number) =>
    fetch(`/api/scans/${scanId}/stop`, { method: "POST" }).then((r) =>
      json<{ stopped: boolean }>(r)
    ),
  getScanHistory: (limit = 50) =>
    fetch(`/api/scans?limit=${limit}`).then((r) => json<ScanSummary[]>(r)),
  getScan: (scanId: number) =>
    fetch(`/api/scans/${scanId}`).then((r) =>
      json<{ scan: ScanSummary; results: DomainResult[] }>(r)
    ),
  getLatestScan: () =>
    fetch("/api/scans/latest").then((r) =>
      json<{ scan: ScanSummary; results: DomainResult[] } | null>(r)
    ),

  getPatterns: () => fetch("/api/patterns").then((r) => json<Pattern[]>(r)),
  createPattern: (pattern: Omit<Pattern, "id">) =>
    fetch("/api/patterns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pattern),
    }).then((r) => json<Pattern>(r)),
  updatePattern: (id: string, pattern: Partial<Pattern>) =>
    fetch(`/api/patterns/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pattern),
    }).then((r) => json<Pattern>(r)),
  deletePattern: (id: string) =>
    fetch(`/api/patterns/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),

  addTarget: (domain: string) =>
    fetch("/api/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }).then((r) => json<{ targets: string[] }>(r)),
  removeTarget: (domain: string) =>
    fetch(`/api/targets/${encodeURIComponent(domain)}`, { method: "DELETE" }).then((r) =>
      json<{ targets: string[] }>(r)
    ),

  getRegistrars: () =>
    fetch("/api/registrars").then((r) =>
      json<Array<{ key: string; name: string }>>(r)
    ),
  registrarUrl: (domain: string, key: string) =>
    fetch(`/api/registrars/${key}?domain=${encodeURIComponent(domain)}`).then((r) =>
      json<{ url: string }>(r)
    ),

  generateTakedown: (result: DomainResult) =>
    fetch("/api/takedown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    }).then((r) => json<{ notice: string; abuseContact: AbuseContactInfo | Record<string, never> }>(r)),

  sendTakedown: (resultId: number | undefined, to: string, notice: string) =>
    fetch("/api/takedown/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultId, to, notice }),
    }).then((r) => json<{ sentAt: string }>(r)),

  updateResultStatus: (id: number, status: ResultStatus) =>
    fetch(`/api/results/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => json<DomainResult>(r)),

  requestScreenshot: (domain: string, target: string) =>
    fetch("/api/results/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, target }),
    }).then((r) => json<{ screenshotPath: string }>(r)),

  testAlert: (channel: "email" | "slack" | "teams") =>
    fetch(`/api/alerts/test/${channel}`, { method: "POST" }).then((r) =>
      json<{ ok: boolean; error?: string }>(r)
    ),
};
