"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { DomainResult, ScanEvent } from "@/lib/types";

export type ScanStatus = "idle" | "running" | "done" | "error";

export interface ScanEventsState {
  results: DomainResult[];
  progress: { current: number; total: number; label: string } | null;
  status: ScanStatus;
  error: string | null;
  totals: { totalFound: number; newFound: number } | null;
}

function initialState(scanId: number | null): ScanEventsState {
  return {
    results: [],
    progress: null,
    status: scanId == null ? "idle" : "running",
    error: null,
    totals: null,
  };
}

/**
 * Subscribes to a scan's SSE stream. Works both for a scan actively running
 * (live progress + result events) and for viewing a past scan (the server
 * replays its persisted results immediately, then closes with a "done"
 * event) — so this single hook drives both the live dashboard and the scan
 * history viewer.
 */
export function useScanEvents(scanId: number | null): ScanEventsState {
  const [trackedScanId, setTrackedScanId] = useState(scanId);
  const [state, setState] = useState<ScanEventsState>(() => initialState(scanId));

  // Reset state synchronously during render when scanId changes — the
  // React-recommended "adjusting state when a prop changes" pattern —
  // rather than resetting it from inside the effect below.
  if (scanId !== trackedScanId) {
    setTrackedScanId(scanId);
    setState(initialState(scanId));
  }

  useEffect(() => {
    if (scanId == null) return;

    const byDomain = new Map<string, DomainResult>();
    const source = new EventSource(`/api/scans/${scanId}/events`);

    source.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as ScanEvent;

      if (event.type === "result") {
        byDomain.set(event.result.domain, event.result);
        setState((prev) => ({ ...prev, results: [...byDomain.values()] }));
      } else if (event.type === "progress") {
        setState((prev) => ({ ...prev, progress: event }));
      } else if (event.type === "done") {
        setState((prev) => ({
          ...prev,
          status: "done",
          totals: { totalFound: event.totalFound, newFound: event.newFound },
        }));
        source.close();
      } else if (event.type === "error") {
        setState((prev) => ({ ...prev, status: "error", error: event.message }));
        source.close();
      } else if (event.type === "warning") {
        toast.warning(event.message);
      }
    };

    source.onerror = () => {
      // EventSource will auto-retry on transient network errors; if the
      // server already closed the stream deliberately (scan done/error) the
      // handlers above already fired and called source.close().
    };

    return () => source.close();
  }, [scanId]);

  return state;
}
