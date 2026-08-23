"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { scoreLabel } from "@/lib/scoreLabel";
import type { AppAlertEvent, DomainResult } from "@/lib/types";

function notifyOne(result: DomainResult) {
  const label = scoreLabel(result.score);
  const tag = result.isCustomStubMatch ? "Watched keyword match" : `${label} risk`;

  toast.warning(`${result.domain}`, {
    description: `${tag} · score ${result.score} · target ${result.target}`,
    duration: 15_000,
  });

  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    new Notification("SNARE — new domain detected", {
      body: `${result.domain} (${tag}, score ${result.score})`,
      tag: result.domain, // collapses repeats for the same domain instead of stacking
    });
  }
}

/**
 * Mounted once at the app root. Subscribes to the global (not scan-scoped)
 * alert stream for the lifetime of the tab, so a scheduled scan's findings
 * surface as a toast / desktop notification no matter which page is open.
 */
export function AppAlertListener() {
  useEffect(() => {
    const source = new EventSource("/api/alerts/stream");

    source.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as AppAlertEvent;
      if (event.type === "alert") {
        for (const result of event.results) notifyOne(result);
      }
    };

    return () => source.close();
  }, []);

  return null;
}
