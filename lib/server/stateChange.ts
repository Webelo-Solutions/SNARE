import type { DomainResult } from "@/lib/types";

/**
 * Diffs a domain's previously stored state against the values about to be
 * saved this scan, returning human-readable descriptions of any meaningful
 * transition worth alerting on. Pure — no I/O — so `db.ts` can call it with
 * the row it just SELECTed, before overwriting it.
 */
export function detectStateChange(oldRow: DomainResult, next: DomainResult): string[] {
  const changes: string[] = [];

  if (!oldRow.hasWeb && next.hasWeb) {
    changes.push("started resolving to a live web server (previously did not respond)");
  }

  if (oldRow.parkedService && !next.parkedService) {
    changes.push(`is no longer parked (was ${oldRow.parkedService}) — may now be repurposed`);
  }

  if (oldRow.mxRecords.length === 0 && next.mxRecords.length > 0) {
    changes.push("gained mail (MX) records — possible phishing/BEC infrastructure");
  }

  const oldVtMalicious = oldRow.vtMaliciousCount ?? 0;
  const nextVtMalicious = next.vtMaliciousCount ?? 0;
  if (oldVtMalicious === 0 && nextVtMalicious > 0) {
    changes.push(
      `was flagged malicious by ${nextVtMalicious} VirusTotal vendor${nextVtMalicious !== 1 ? "s" : ""}`
    );
  }

  if (oldRow.urlscanMalicious !== true && next.urlscanMalicious === true) {
    changes.push("was flagged malicious by urlscan.io");
  }

  return changes;
}
