"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, FileWarning, Loader2 } from "lucide-react";
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
import { useConfig } from "@/hooks/use-config";
import { api } from "@/lib/client/api";
import type { DomainResult } from "@/lib/types";

export function DomainDetailsModal({ result }: { result: DomainResult }) {
  const { data: config } = useConfig();
  const [open, setOpen] = useState(false);
  const [loadingNotice, setLoadingNotice] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleGenerateNotice() {
    setLoadingNotice(true);
    try {
      const res = await api.generateTakedown(result);
      setNotice(res.notice);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate takedown notice");
    } finally {
      setLoadingNotice(false);
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

  async function handleRegister() {
    if (!config) return;
    setLoadingRegister(true);
    try {
      const { url } = await api.registrarUrl(result.domain, config.preferredRegistrar);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build registrar link");
    } finally {
      setLoadingRegister(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="font-mono text-[13px] text-primary underline-offset-2 hover:underline text-left">
            {result.domain}
          </button>
        }
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{result.domain}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <div className="mb-0.5 text-xs text-text-dim">Registrar</div>
              <div>{result.registrar ?? "—"}</div>
            </div>
            <div>
              <div className="mb-0.5 text-xs text-text-dim">Abuse Contact</div>
              <div>{result.abuseContact || "—"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border pt-3">
            {result.isAvailable && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegister}
                disabled={loadingRegister}
                className="gap-1.5"
              >
                {loadingRegister ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="size-3.5" />
                )}
                Register Domain
              </Button>
            )}
            {!notice && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateNotice}
                disabled={loadingNotice}
                className="gap-1.5"
              >
                {loadingNotice ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileWarning className="size-3.5" />
                )}
                Generate Takedown Notice
              </Button>
            )}
          </div>

          {notice && (
            <div className="flex flex-col gap-2">
              <Textarea value={notice} readOnly rows={14} className="font-mono text-xs" />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
