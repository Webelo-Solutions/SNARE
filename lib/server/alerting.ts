import "server-only";
import fs from "node:fs";
import nodemailer from "nodemailer";
import { formatDistanceToNow } from "date-fns";
import type { AlertConfig, DomainResult } from "@/lib/types";
import { scoreLabel } from "@/lib/scoreLabel";

/**
 * Which of a scan's new results qualify for alerting. Shared between the
 * webhook/email dispatch below and the in-app notification path in
 * scanEngine.ts, so both channels agree on what counts as "alert-worthy".
 *
 * A custom-stub match always qualifies regardless of score — it's an
 * explicit keyword the user asked to always be notified about (e.g. a
 * brand name showing up as a subdomain of a stub-themed apex domain), and
 * such matches often score low on the edit-distance signal since the
 * target's own label is untouched.
 */
export function filterAlertHits(results: DomainResult[], cfg: AlertConfig): DomainResult[] {
  if (!cfg.enabled || results.length === 0) return [];
  return results.filter((r) => r.score >= cfg.minScore || r.isCustomStubMatch);
}

/** Send alerts for new high-risk domains. Returns error strings (empty = all channels succeeded or were skipped). */
export async function dispatch(newResults: DomainResult[], cfg: AlertConfig): Promise<string[]> {
  const hits = filterAlertHits(newResults, cfg);
  if (hits.length === 0) return [];

  const errors: string[] = [];

  if (cfg.emailTo && cfg.smtpHost) {
    const err = await sendEmail(hits, cfg);
    if (err) errors.push(`Email: ${err}`);
  }
  if (cfg.slackWebhook) {
    const err = await sendSlack(hits, cfg);
    if (err) errors.push(`Slack: ${err}`);
  }
  if (cfg.teamsWebhook) {
    const err = await sendTeams(hits, cfg);
    if (err) errors.push(`Teams: ${err}`);
  }

  return errors;
}

export function testEmail(cfg: AlertConfig): Promise<string | null> {
  return sendEmail([], cfg, true);
}
export function testSlack(cfg: AlertConfig): Promise<string | null> {
  return sendSlack([], cfg, true);
}
export function testTeams(cfg: AlertConfig): Promise<string | null> {
  return sendTeams([], cfg, true);
}

// ------------------------------------------------------------------ //
// Email
// ------------------------------------------------------------------ //

/** Shared SMTP transport construction — used both for the alert email below
 * and for the one-click takedown-notice send path (app/api/takedown/send),
 * which reuses the same configured SMTP account rather than needing its own. */
export function buildTransport(
  cfg: Pick<AlertConfig, "smtpHost" | "smtpPort" | "smtpTls" | "smtpUser" | "smtpPass">
) {
  return nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: !cfg.smtpTls, // implicit TLS (smtps) when not using STARTTLS
    auth: cfg.smtpUser && cfg.smtpPass ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  });
}

async function sendEmail(
  hits: DomainResult[],
  cfg: AlertConfig,
  test = false
): Promise<string | null> {
  const subject = test
    ? "SNARE — Test notification"
    : `SNARE Alert — ${hits.length} domain${hits.length !== 1 ? "s" : ""} require attention`;

  const { html, attachments } = buildEmailContent(hits, test);

  try {
    const transport = buildTransport(cfg);
    await transport.sendMail({
      from: cfg.smtpUser || "snare@localhost",
      to: cfg.emailTo,
      subject,
      html,
      attachments,
    });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** label/value row for the per-domain field table — value is pre-escaped
 * by the caller since some values are HTML (badges, colored spans). */
function fieldRow(label: string, valueHtml: string): string {
  return `
    <tr>
      <td style="padding:5px 12px;color:#6c7086;font-size:12px;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:5px 12px;font-size:13px;">${valueHtml}</td>
    </tr>`;
}

function badge(text: string, color: string): string {
  return `<span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}66;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:bold;margin-right:4px;">${text}</span>`;
}

interface EmailAttachment {
  filename: string;
  path: string;
  cid: string;
}

export function buildEmailContent(
  hits: DomainResult[],
  test: boolean
): { html: string; attachments: EmailAttachment[] } {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  if (test) {
    return {
      html: `
        <html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#12121e;color:#cdd6f4;padding:24px;">
        <h2 style="color:#89b4fa;">SNARE — Test Notification</h2>
        <p>Your alert configuration is working correctly.</p>
        <p style="color:#6c7086;font-size:12px;">${ts}</p>
        </body></html>
      `,
      attachments: [],
    };
  }

  const attachments: EmailAttachment[] = [];

  const cards = hits
    .map((r, i) => {
      const color = r.score >= 70 ? "#f38ba8" : r.score >= 50 ? "#fab387" : "#f9e2af";

      const badges = [
        r.isNew ? badge("NEW", "#89b4fa") : "",
        r.stateChanges.length > 0 ? badge("STATE CHANGE", "#f38ba8") : "",
        r.isCustomStubMatch ? badge("WATCHED", "#fab387") : "",
        r.isAvailable ? badge("AVAILABLE", "#a6e3a1") : "",
        r.parkedService ? badge(`PARKED · ${escapeHtml(r.parkedService)}`, "#6c7086") : "",
      ]
        .filter(Boolean)
        .join("");

      const age = r.firstSeen
        ? `${escapeHtml(r.firstSeen.slice(0, 10))} (${formatDistanceToNow(new Date(r.firstSeen), { addSuffix: true })})`
        : "—";

      const vt =
        r.vtMaliciousCount === null
          ? "—"
          : `${r.vtMaliciousCount} malicious, ${r.vtSuspiciousCount ?? 0} suspicious`;

      const urlscan = !r.urlscanScanned
        ? "Not scanned"
        : r.urlscanMalicious === true
          ? `<a href="${escapeHtml(r.urlscanUrl ?? "")}" style="color:#f38ba8;">Malicious</a>`
          : r.urlscanMalicious === false
            ? `<a href="${escapeHtml(r.urlscanUrl ?? "")}" style="color:#a6e3a1;">Clean</a>`
            : r.urlscanUrl
              ? `<a href="${escapeHtml(r.urlscanUrl)}" style="color:#cdd6f4;">Scanned${r.urlscanSource === "certstream-suspicious" ? " (auto-flagged suspicious)" : ""}</a>`
              : "Scanned";

      let screenshotHtml = "";
      if (r.screenshotPath && fs.existsSync(r.screenshotPath)) {
        const cid = `screenshot${i}@snare`;
        attachments.push({ filename: `${r.domain}.png`, path: r.screenshotPath, cid });
        screenshotHtml = `<div style="margin-top:10px;"><img src="cid:${cid}" style="max-width:100%;border-radius:6px;border:1px solid #313244;" /></div>`;
      } else {
        screenshotHtml = `<p style="color:#6c7086;font-size:12px;margin-top:8px;">No screenshot available.</p>`;
      }

      const rows = [
        fieldRow(
          "Score",
          `<span style="color:${color};font-weight:bold;">${r.score} — ${scoreLabel(r.score)}</span>`
        ),
        ...(r.stateChanges.length > 0
          ? [
              fieldRow(
                "What Changed",
                `<span style="color:#f38ba8;">${r.stateChanges.map(escapeHtml).join("; ")}</span>`
              ),
            ]
          : []),
        fieldRow("Target", escapeHtml(r.target)),
        fieldRow(
          "Source",
          escapeHtml(r.source) + (r.ctLogIndex ? ` <span style="color:#6c7086;">(${escapeHtml(r.ctLogIndex)})</span>` : "")
        ),
        fieldRow("Technique", r.technique ? escapeHtml(r.technique) : "—"),
        fieldRow("Registered", age),
        fieldRow("Registrar", r.registrar ? escapeHtml(r.registrar) : "—"),
        fieldRow("IPs", r.ips.length > 0 ? escapeHtml(r.ips.join(", ")) : "—"),
        fieldRow("MX Records", r.mxRecords.length > 0 ? escapeHtml(r.mxRecords.join(", ")) : "—"),
        fieldRow("Web Active", r.hasWeb ? "Yes" : "No"),
        fieldRow("Abuse Contact", r.abuseContact ? escapeHtml(r.abuseContact) : "—"),
        fieldRow("VirusTotal", vt),
        fieldRow("urlscan.io", urlscan),
      ].join("");

      return `
        <div style="background:#1e1e2e;border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="font-family:monospace;font-size:15px;font-weight:bold;margin-bottom:6px;">
            ${escapeHtml(r.domain)} ${badges}
          </div>
          <table style="border-collapse:collapse;width:100%;">${rows}</table>
          ${screenshotHtml}
        </div>`;
    })
    .join("");

  return {
    html: `
      <html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;background:#12121e;color:#cdd6f4;padding:24px;">
      <h2 style="color:#89b4fa;">SNARE Alert</h2>
      <p>${hits.length} domain${hits.length !== 1 ? "s" : ""} require attention — ${ts}</p>
      ${cards}
      <p style="color:#6c7086;font-size:12px;margin-top:8px;">
        Sent by SNARE — Domain Surveillance</p>
      </body></html>
    `,
    attachments,
  };
}

// ------------------------------------------------------------------ //
// Slack
// ------------------------------------------------------------------ //

async function sendSlack(
  hits: DomainResult[],
  cfg: AlertConfig,
  test = false
): Promise<string | null> {
  let payload: unknown;
  if (test) {
    payload = { text: "SNARE — test notification. Your Slack webhook is configured correctly." };
  } else {
    const lines = [`*SNARE Alert* — ${hits.length} domain${hits.length !== 1 ? "s" : ""} require attention\n`];
    for (const r of hits) {
      const icon = r.stateChanges.length > 0 || r.score >= 70 ? ":rotating_light:" : ":warning:";
      lines.push(
        `${icon} \`${r.domain}\` → _${r.target}_ ` +
          `| Score: *${r.score}* (${scoreLabel(r.score)}) ` +
          `| ${r.source}` +
          `${r.hasWeb ? " | Web: Yes" : ""}` +
          `${r.mxRecords.length > 0 ? " | MX: Yes" : ""}` +
          `${r.stateChanges.length > 0 ? ` | ⚠ ${r.stateChanges.join("; ")}` : ""}`
      );
    }
    payload = { text: lines.join("\n") };
  }

  try {
    const resp = await fetch(cfg.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return `HTTP ${resp.status}`;
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// ------------------------------------------------------------------ //
// Microsoft Teams
// ------------------------------------------------------------------ //

async function sendTeams(
  hits: DomainResult[],
  cfg: AlertConfig,
  test = false
): Promise<string | null> {
  let payload: Record<string, unknown>;
  if (test) {
    payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: "SNARE test",
      themeColor: "89b4fa",
      title: "SNARE — Test Notification",
      text: "Your Teams webhook is configured correctly.",
    };
  } else {
    const facts = hits.map((r) => ({
      name: r.domain,
      value:
        `Target: ${r.target} | Score: ${r.score} (${scoreLabel(r.score)}) ` +
        `| ${r.source}` +
        `${r.hasWeb ? " | Web active" : ""}` +
        `${r.stateChanges.length > 0 ? ` | Changed: ${r.stateChanges.join("; ")}` : ""}`,
    }));
    payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: `SNARE Alert — ${hits.length} domains`,
      themeColor: "f38ba8",
      title: `SNARE Alert — ${hits.length} domain${hits.length !== 1 ? "s" : ""} require attention`,
      sections: [{ facts }],
    };
  }

  try {
    const resp = await fetch(cfg.teamsWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return `HTTP ${resp.status}`;
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
