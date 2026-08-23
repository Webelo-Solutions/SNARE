"use client";

import { useState } from "react";
import { Copy, Download, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client/api";
import type { DomainResult } from "@/lib/types";

interface AbuseContact {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
}

export function TakedownNoticeModal({ result }: { result: DomainResult }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [abuseContact, setAbuseContact] = useState<AbuseContact | null>(null);

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !notice) {
      setLoading(true);
      try {
        const res = await api.generateTakedown(result);
        setNotice(res.notice);
        setAbuseContact((res.abuseContact as AbuseContact) ?? null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to generate takedown notice");
      } finally {
        setLoading(false);
      }
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(notice);
    toast.success("Notice copied to clipboard");
  }

  function handleDownload() {
    const blob = new Blob([notice], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `takedown-${result.domain}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            className="flex items-center gap-1 text-xs text-text-dim hover:text-primary"
            title="Generate takedown notice"
          >
            <FileWarning className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Takedown Notice — {result.domain}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-text-dim">
            <Loader2 className="size-4 animate-spin" />
            Generating notice…
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {abuseContact && (abuseContact.email || abuseContact.phone) && (
              <div className="rounded-md border border-border bg-surface2 px-3 py-2 text-xs">
                <span className="font-semibold">Abuse Contact:</span>{" "}
                {abuseContact.name ? `${abuseContact.name} — ` : ""}
                {abuseContact.email ?? "—"}
                {abuseContact.phone ? ` · ${abuseContact.phone}` : ""}
              </div>
            )}
            <Textarea value={notice} readOnly rows={18} className="font-mono text-xs" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                <Copy className="size-3.5" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                <Download className="size-3.5" />
                Download .txt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
