import "server-only";
import type { DomainResult } from "@/lib/types";
import { scoreLabel } from "@/lib/scoreLabel";

// Free/abused TLDs routinely used for throwaway phishing infrastructure
const HIGH_RISK_TLDS = new Set([
  ".tk", ".ml", ".ga", ".cf", ".gq", ".pw", ".cc", ".ws", ".su", ".buzz",
]);
const MEDIUM_RISK_TLDS = new Set([
  ".xyz", ".top", ".club", ".online", ".site",
  ".info", ".biz", ".click", ".link", ".live",
  ".icu", ".cyou", ".cfd",
]);

/**
 * Return a 0–100 risk score for a domain result. Weights are additive; the
 * total is capped at 100.
 *
 * Signal                          Max pts
 * ──────────────────────────────────────────
 * Edit distance 1 from target      40
 * Edit distance 2                  25
 * Edit distance 3                  15
 * Edit distance 4–5                 8
 * Registered < 7 days              30
 * Registered 7–30 days             20
 * Registered 30–90 days            10
 * Has MX records                   15
 * Has web (A record)               10
 * Cyrillic characters              20
 * Number substitutions (leet)      10
 * High-risk TLD                    15
 * Medium-risk TLD                   5
 * CT Logs source (cert issued)      5
 * Brand name embedded (combosquat) 10
 * ──────────────────────────────────────────
 * Cap                             100
 */
export function score(result: DomainResult): number {
  let pts = 0;

  const label = result.domain.split(".")[0];
  const targetLabel = result.target ? result.target.split(".")[0] : "";
  const dotIdx = result.domain.lastIndexOf(".");
  const tld = dotIdx !== -1 ? "." + result.domain.slice(dotIdx + 1) : "";

  // Edit distance
  if (targetLabel) {
    const dist = levenshtein(label, targetLabel);
    if (dist === 1) pts += 40;
    else if (dist === 2) pts += 25;
    else if (dist === 3) pts += 15;
    else if (dist <= 5) pts += 8;
  }

  // Registration age
  if (result.firstSeen) {
    const creation = new Date(result.firstSeen);
    const ageDays = Math.floor((Date.now() - creation.getTime()) / 86_400_000);
    if (ageDays < 7) pts += 30;
    else if (ageDays < 30) pts += 20;
    else if (ageDays < 90) pts += 10;
  }

  // Active infrastructure
  if (result.mxRecords.length > 0) pts += 15;
  if (result.hasWeb) pts += 10;

  // Character trickery
  if (hasCyrillic(result.domain)) pts += 20;
  if (hasNumberSub(label)) pts += 10;

  // TLD risk
  if (HIGH_RISK_TLDS.has(tld)) pts += 15;
  else if (MEDIUM_RISK_TLDS.has(tld)) pts += 5;

  // Source confidence — a real cert was issued
  if (result.source === "CT Logs") pts += 5;

  // Brand name embedded in the label (combosquat)
  if (targetLabel && targetLabel.length >= 3) {
    if (
      (label.startsWith(targetLabel) || label.endsWith(targetLabel)) &&
      label !== targetLabel
    ) {
      pts += 10;
    }
  }

  return Math.min(pts, 100);
}

export const label = scoreLabel;

export function levenshtein(a: string, b: string): number {
  if (a.length < b.length) [a, b] = [b, a];
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (const c1 of a) {
    const newRow = [row[0] + 1];
    for (let j = 0; j < b.length; j++) {
      const c2 = b[j];
      newRow.push(
        Math.min(row[j + 1] + 1, newRow[newRow.length - 1] + 1, row[j] + (c1 !== c2 ? 1 : 0))
      );
    }
    row = newRow;
  }
  return row[row.length - 1];
}

export function hasCyrillic(s: string): boolean {
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0400 && code <= 0x04ff) return true;
  }
  return false;
}

export function hasNumberSub(name: string): boolean {
  return [..."013458"].some((c) => name.includes(c));
}
