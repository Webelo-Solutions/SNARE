"use client";

import { useState } from "react";
import { TargetPanel } from "@/components/target-panel/target-panel";
import { ResultsTable } from "@/components/results/results-table";
import { ExportCsvButton } from "@/components/results/export-csv-button";
import { ScanStatusBar } from "@/components/status/scan-status-bar";
import { useScanEvents } from "@/hooks/use-scan-events";
import { useLatestScan } from "@/hooks/use-scans";

export default function DashboardPage() {
  const [manualScanId, setManualScanId] = useState<number | null>(null);
  const { data: latest } = useLatestScan();

  // Auto-load the most recent completed scan on first load, mirroring the
  // desktop app's _auto_load_last_scan() — derived directly at render time
  // rather than synced via an effect, since it's plain state derivation.
  const activeScanId = manualScanId ?? latest?.scan?.id ?? null;

  const scanState = useScanEvents(activeScanId);
  const scanning = scanState.status === "running";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        <TargetPanel
          scanning={scanning}
          activeScanId={activeScanId}
          onScanStarted={setManualScanId}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-end border-b border-border px-3 py-2">
            <ExportCsvButton scanId={activeScanId} />
          </div>
          <ResultsTable results={scanState.results} />
        </div>
      </div>
      <ScanStatusBar state={scanState} resultCount={scanState.results.length} />
    </div>
  );
}
