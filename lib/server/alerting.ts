import "server-only";
import nodemailer from "nodemailer";
import type { AlertConfig, DomainResult } from "@/lib/types";
import { scoreLabel } from "@/lib/scoreLabel";

/** Send alerts for new high-risk domains. Returns error strings (empty = all channels succeeded or were skipped). */
export async function dispatch(newResults: DomainResult[], cfg: AlertConfig): Promise<string[]> {
  if (!cfg.enabled || newResults.length === 0) return [];

  const hits = newResults.filter((r) => r.score >= cfg.minScore);
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

async function sendEmail(
  hits: DomainResult[],
  cfg: AlertConfig,
  test = false
): Promise<string | null> {
  const subject = test
    ? "SNARE — Test notification"
    : `SNARE Alert — ${hits.length} new high-risk domain${hits.length !== 1 ? "s" : ""} detected`;

  try {
    const transport = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: !cfg.smtpTls, // implicit TLS (smtps) when not using STARTTLS
      auth: cfg.smtpUser && cfg.smtpPass ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
    });
    await transport.sendMail({
      from: cfg.smtpUser || "snare@localhost",
      to: cfg.emailTo,
      subject,
      html: emailBody(hits, test),
    });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

function emailBody(hits: DomainResult[], test: boolean): string {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

  if (test) {
    return `
      <html><body style="font-family:Arial,sans-serif;background:#12121e;color:#cdd6f4;padding:24px;">
      <h2 style="color:#89b4fa;">SNARE — Test Notification</h2>
      <p>Your alert configuration is working correctly.</p>
      <p style="color:#6c7086;font-size:12px;">${ts}</p>
      </body></html>
    `;
  }

  const rows = hits
    .map((r) => {
      const color = r.score >= 70 ? "#f38ba8" : r.score >= 50 ? "#fab387" : "#f9e2af";
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;">${r.domain}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;">${r.target}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;color:${color};font-weight:bold;">
            ${r.score} — ${scoreLabel(r.score)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;">${r.source}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;">${r.ips.join(", ") || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #313244;">${r.hasWeb ? "Yes" : "No"}</td>
        </tr>`;
    })
    .join("");

  return `
    <html><body style="font-family:Arial,sans-serif;background:#12121e;color:#cdd6f4;padding:24px;">
    <h2 style="color:#89b4fa;">SNARE Alert</h2>
    <p>${hits.length} new high-risk domain${hits.length !== 1 ? "s" : ""} detected — ${ts}</p>
    <table style="border-collapse:collapse;width:100%;background:#1e1e2e;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#313244;color:#cdd6f4;">
          <th style="padding:10px 12px;text-align:left;">Domain</th>
          <th style="padding:10px 12px;text-align:left;">Target</th>
          <th style="padding:10px 12px;text-align:left;">Score</th>
          <th style="padding:10px 12px;text-align:left;">Source</th>
          <th style="padding:10px 12px;text-align:left;">IPs</th>
          <th style="padding:10px 12px;text-align:left;">Web</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#6c7086;font-size:12px;margin-top:24px;">
      Sent by SNARE — Domain Surveillance</p>
    </body></html>
  `;
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
    const lines = [
      `*SNARE Alert* — ${hits.length} new high-risk domain${hits.length !== 1 ? "s" : ""} detected\n`,
    ];
    for (const r of hits) {
      const icon = r.score >= 70 ? ":rotating_light:" : ":warning:";
      lines.push(
        `${icon} \`${r.domain}\` → _${r.target}_ ` +
          `| Score: *${r.score}* (${scoreLabel(r.score)}) ` +
          `| ${r.source}` +
          `${r.hasWeb ? " | Web: Yes" : ""}` +
          `${r.mxRecords.length > 0 ? " | MX: Yes" : ""}`
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
        `${r.hasWeb ? " | Web active" : ""}`,
    }));
    payload = {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: `SNARE Alert — ${hits.length} new domains`,
      themeColor: "f38ba8",
      title: `SNARE Alert — ${hits.length} new high-risk domain${hits.length !== 1 ? "s" : ""} detected`,
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
