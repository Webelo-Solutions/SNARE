"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsvButton({ scanId }: { scanId: number | null }) {
  if (scanId == null) return null;

  return (
    <a href={`/api/scans/${scanId}/export`} download>
      <Button variant="outline" size="sm" className="gap-1.5">
        <Download className="size-3.5" />
        Export CSV
      </Button>
    </a>
  );
}
