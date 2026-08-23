"use client";

import { Progress } from "@/components/ui/progress";
import type { ScanEventsState } from "@/hooks/use-scan-events";

function statusLabel(state: ScanEventsState, resultCount: number): string {
  if (state.status === "idle") return "Ready";
  if (state.status === "error") return `Scan error: ${state.error}`;
  if (state.status === "done" && state.totals) {
    const { totalFound, newFound } = state.totals;
    return newFound > 0
      ? `Scan complete — ${totalFound} found, ${newFound} new`
      : `Scan complete — ${totalFound} result${totalFound !== 1 ? "s" : ""} found`;
  }
  return state.progress?.label ?? `Scanning… ${resultCount} found so far`;
}

export function ScanStatusBar({ state, resultCount }: { state: ScanEventsState; resultCount: number }) {
  const isRunning = state.status === "running";
  const progress = state.progress;
  const pct =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : null;

  return (
    <div className="flex h-9 items-center gap-3 border-t border-border bg-surface px-4 text-xs text-text-dim">
      <span className="flex-1 truncate">{statusLabel(state, resultCount)}</span>
      {isRunning && (
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 w-40" />
          {pct !== null && <span className="tabular-nums">{pct}%</span>}
        </div>
      )}
    </div>
  );
}
