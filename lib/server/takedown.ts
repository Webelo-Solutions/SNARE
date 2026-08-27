import "server-only";
import type { DomainResult, SenderProfile } from "@/lib/types";
import { levenshtein } from "./scoring";

export { getAbuseContact } from "./rdap";

/**
 * Splits a generated notice (whose first line is `Subject: ...`, kept
 * in-body so Copy/Download produce a self-contained email a user can paste
 * elsewhere) into an actual SMTP subject header + remaining body, for the
 * one-click "Send via Email" path.
 */
export function splitNotice(notice: string): { subject: string; body: string } {
  const [firstLine, ...rest] = notice.split("\n");
  const subject = firstLine.startsWith("Subject:")
    ? firstLine.slice("Subject:".length).trim()
    : "Abuse Report";
  return { subject, body: rest.join("\n").replace(/^\n+/, "") };
}

function today(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function generateNotice(result: DomainResult, sender: SenderProfile): string {
  const registrar = result.registrar || "Unknown Registrar";
  const creation = result.firstSeen ? result.firstSeen.slice(0, 10) : "Unknown";
  const ips = result.ips.length > 0 ? result.ips.join(", ") : "None resolved";
  const mx = result.mxRecords.length > 0 ? result.mxRecords.join(", ") : "None";
  const web = result.hasWeb ? "Yes" : "No";

  const abuseSignals = describeSignals(result);
  const infrastructureNote = describeInfrastructure(result);

  return `Subject: Abuse Report — Suspected Phishing / Brand Impersonation: ${result.domain}

Dear ${registrar} Abuse Team,

I am writing to formally report a domain registered through your service that appears to be impersonating ${result.target || "our organisation"} and may be used to facilitate phishing, fraud, or trademark infringement against our customers and employees.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORTED DOMAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Domain:            ${result.domain}
  Registrar:         ${registrar}
  Registration Date: ${creation}
  Resolved IPs:      ${ips}
  MX Records:        ${mx}
  Active Web:        ${web}
  Risk Score:        ${result.score}/100
  Detection Source:  ${result.source}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEGITIMATE DOMAIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Domain:       ${result.target || "N/A"}
  Rights Holder:${sender.company ? " " + sender.company : " (see complainant below)"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESCRIPTION OF ABUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${abuseSignals}
${infrastructureNote}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUESTED ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
We respectfully request the immediate suspension or takedown of the domain ${result.domain} in accordance with your Acceptable Use Policy and ICANN's Registrar Accreditation Agreement (RAA), specifically the provisions relating to illegal activity and phishing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPLAINANT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Name:    ${sender.name || "[Your Name]"}
  Title:   ${sender.title || "[Your Title]"}
  Company: ${sender.company || "[Your Company]"}
  Email:   ${sender.email || "[Your Email]"}
  Phone:   ${sender.phone || "[Your Phone]"}
  Address: ${sender.address || "[Your Address]"}

I declare that the information in this notice is accurate to the best of my knowledge and that I am authorised to act on behalf of the rights holder identified above.

Sincerely,

${sender.name || "[Your Name]"}
${sender.title ? sender.title + ", " : ""}${sender.company || ""}
${sender.email || ""}
${today()}
`.trim();
}

function describeSignals(result: DomainResult): string {
  const lines: string[] = [];
  const targetLabel = result.target ? result.target.split(".")[0] : "";
  const label = result.domain.split(".")[0];

  if (targetLabel) {
    const dist = levenshtein(label, targetLabel);
    if (dist <= 3) {
      lines.push(
        `  • The domain '${result.domain}' is a close typographical variant of ` +
          `'${result.target}' (edit distance: ${dist}), consistent with ` +
          `typosquatting intended to deceive users.`
      );
    }
  }

  if ([...result.domain].some((c) => (c.codePointAt(0) ?? 0) >= 0x0400 && (c.codePointAt(0) ?? 0) <= 0x04ff)) {
    lines.push(
      `  • The domain contains Cyrillic Unicode characters that are visually ` +
        `indistinguishable from Latin characters (IDN homograph attack), making ` +
        `it appear identical to '${result.target}' in most browsers and email clients.`
    );
  }

  if ([..."013458"].some((c) => label.includes(c))) {
    lines.push(
      `  • The domain uses numeric character substitutions (leet-speak) to ` +
        `mimic the appearance of '${result.target}'.`
    );
  }

  if (targetLabel && targetLabel.length >= 3) {
    if (label.startsWith(targetLabel) && label !== targetLabel) {
      lines.push(
        `  • Our brand name '${targetLabel}' is used as a prefix in this domain, ` +
          `a common combosquatting technique used to impersonate login or support pages.`
      );
    } else if (label.endsWith(targetLabel) && label !== targetLabel) {
      lines.push(
        `  • Our brand name '${targetLabel}' is used as a suffix in this domain, ` +
          `a combosquatting pattern typically used to impersonate service pages.`
      );
    }
  }

  if (result.firstSeen) {
    const age = Math.floor((Date.now() - new Date(result.firstSeen).getTime()) / 86_400_000);
    if (age < 90) {
      lines.push(
        `  • This domain was registered only ${age} day${age !== 1 ? "s" : ""} ago, ` +
          `indicating it was likely registered specifically to target our organisation.`
      );
    }
  }

  if (result.source === "CT Logs") {
    lines.push(
      `  • A TLS certificate has been issued for this domain (detected via ` +
        `Certificate Transparency logs), confirming it is being actively prepared ` +
        `for use.`
    );
  }

  if (lines.length === 0) {
    lines.push(
      `  • The domain '${result.domain}' closely resembles '${result.target}' ` +
        `and scored ${result.score}/100 on our automated risk assessment, indicating ` +
        `a high likelihood of brand impersonation.`
    );
  }

  return lines.join("\n");
}

function describeInfrastructure(result: DomainResult): string {
  const parts: string[] = [];
  if (result.mxRecords.length > 0) {
    parts.push(
      `\nThis domain has active mail exchange (MX) records ` +
        `(${result.mxRecords.join(", ")}), indicating it may already be ` +
        `receiving email — a strong indicator of Business Email Compromise (BEC) ` +
        `or spear-phishing infrastructure targeting our employees or customers.`
    );
  }
  if (result.hasWeb) {
    parts.push(
      `\nThe domain is actively resolving to ${result.ips.join(", ")}, ` +
        `suggesting a web presence may already be in operation.`
    );
  }
  return parts.join("");
}
