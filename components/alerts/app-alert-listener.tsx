"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { scoreLabel, type ScoreLabel } from "@/lib/scoreLabel";
import type { AppAlertEvent, DomainResult } from "@/lib/types";

const TIER_ORDER: ScoreLabel[] = ["Critical", "High", "Medium", "Low"];

/**
 * Builds one consolidated summary for a whole batch of alert-worthy results
 * from a single scan — a scan that finds 10 domains at once should read as
 * one digest, not fire 10 separate toasts/notifications.
 */
function buildDigest(results: DomainResult[]): { title: string; description: string } {
  const tierCounts: Record<ScoreLabel, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  let watchedCount = 0;
  let changedCount = 0;
  for (const r of results) {
    tierCounts[scoreLabel(r.score)]++;
    if (r.isCustomStubMatch) watchedCount++;
    if (r.stateChanges.length > 0) changedCount++;
  }
  const tierParts = TIER_ORDER.filter((t) => tierCounts[t] > 0).map((t) => `${tierCounts[t]} ${t}`);
  if (watchedCount > 0) tierParts.push(`${watchedCount} watched`);
  if (changedCount > 0) tierParts.push(`${changedCount} state change${changedCount !== 1 ? "s" : ""}`);

  const targets = [...new Set(results.map((r) => r.target))];
  const targetLabel = targets.length === 1 ? targets[0] : `${targets.length} targets`;

  if (results.length === 1) {
    const r = results[0];
    return {
      title: r.domain,
      description: `${scoreLabel(r.score)} risk · score ${r.score} · target ${r.target}`,
    };
  }

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const topNames = sorted.slice(0, 3).map((r) => r.domain);
  const remaining = results.length - topNames.length;

  return {
    title: `${results.length} new domains flagged — ${targetLabel}`,
    description:
      `${tierParts.join(" · ")} — ${topNames.join(", ")}` +
      (remaining > 0 ? ` +${remaining} more` : ""),
  };
}

function notifyDigest(results: DomainResult[]) {
  if (results.length === 0) return;
  const { title, description } = buildDigest(results);

  toast.warning(title, { description, duration: 20_000 });

  if (
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    new Notification("SNARE — new domains detected", {
      body: `${title}\n${description}`,
      // One tag per digest (not per domain) so a second scan's digest
      // replaces the first rather than stacking a pile of toasts.
      tag: "snare-alert-digest",
    });
  }
}

/**
 * Mounted once at the app root. Subscribes to the global (not scan-scoped)
 * alert stream for the lifetime of the tab, so a scheduled scan's findings
 * surface as a single digest toast / desktop notification no matter which
 * page is open.
 */
export function AppAlertListener() {
  useEffect(() => {
    const source = new EventSource("/api/alerts/stream");

    source.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as AppAlertEvent;
      if (event.type === "alert") {
        notifyDigest(event.results);
      }
    };

    return () => source.close();
  }, []);

  return null;
}
