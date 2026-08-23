"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { ResultsTable } from "@/components/results/results-table";
import { ExportCsvButton } from "@/components/results/export-csv-button";
import { useScanHistory } from "@/hooks/use-scans";
import { useScanEvents } from "@/hooks/use-scan-events";
import { cn } from "@/lib/utils";

export default function HistoryPage() {
  const { data: scans = [] } = useScanHistory(100);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedState = useScanEvents(selectedId);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[320px] shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="size-7">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <h1 className="text-sm font-bold tracking-wide">Scan History</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {scans.length === 0 && (
            <p className="px-2 py-4 text-xs text-text-dim">No scans recorded yet.</p>
          )}
          {scans.map((scan) => (
            <button
              key={scan.id}
              onClick={() => setSelectedId(scan.id)}
              className={cn(
                "mb-1 flex w-full flex-col gap-0.5 rounded-md border border-transparent px-3 py-2 text-left text-sm hover:border-border hover:bg-background",
                selectedId === scan.id && "border-border bg-background"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {scan.completedAt ? "Completed" : "In progress"}
                </span>
                <span className="text-xs text-text-dim">
                  {formatDistanceToNow(new Date(scan.startedAt), { addSuffix: true })}
                </span>
              </div>
              <span className="truncate text-xs text-text-dim">{scan.targets.join(", ")}</span>
              <span className="text-xs text-text-dim">
                {scan.totalFound} found
                {scan.newFound > 0 ? ` · ${scan.newFound} new` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedId == null ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-dim">
            Select a scan to view its results.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end border-b border-border px-3 py-2">
              <ExportCsvButton scanId={selectedId} />
            </div>
            <ResultsTable results={selectedState.results} />
          </>
        )}
      </div>
    </div>
  );
}
