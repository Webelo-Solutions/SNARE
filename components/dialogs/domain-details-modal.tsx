"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, FileWarning, Loader2, Send } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { useConfig } from "@/hooks/use-config";
import { useUpdateResultStatus } from "@/hooks/use-result-status";
import { useSendTakedown } from "@/hooks/use-takedown-send";
import { api } from "@/lib/client/api";
import type { DomainResult, ResultStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: ResultStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "ignored", label: "Ignored" },
  { value: "false_positive", label: "False Positive" },
];

export function DomainDetailsModal({
  result,
  onStatusChanged,
}: {
  result: DomainResult;
  onStatusChanged?: (domain: string, status: ResultStatus) => void;
}) {
  const { data: config } = useConfig();
  const [open, setOpen] = useState(false);
  const [loadingNotice, setLoadingNotice] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [notice, setNotice] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(result.takedownSentAt);
  const updateStatus = useUpdateResultStatus();
  const sendTakedown = useSendTakedown();

  async function handleGenerateNotice() {
    setLoadingNotice(true);
    try {
      const res = await api.generateTakedown(result);
      setNotice(res.notice);
      const contactEmail = "email" in res.abuseContact ? res.abuseContact.email : null;
      setSendTo(contactEmail || result.abuseContact || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate takedown notice");
    } finally {
      setLoadingNotice(false);
    }
  }

  function handleStatusChange(status: ResultStatus) {
    if (!result.id) return;
    updateStatus.mutate(
      { id: result.id, status },
      {
        onSuccess: () => onStatusChanged?.(result.domain, status),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to update status"),
      }
    );
  }

  function handleSendTakedown() {
    sendTakedown.mutate(
      { resultId: result.id, to: sendTo, notice },
      {
        onSuccess: ({ sentAt }) => {
          setSentAt(sentAt);
          toast.success(`Takedown notice sent to ${sendTo}`);
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to send takedown notice"),
      }
    );
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

          <div>
            <div className="mb-1.5 text-xs text-text-dim">Triage Status</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={result.status === opt.value ? "default" : "outline"}
                  size="sm"
                  disabled={!result.id || updateStatus.isPending}
                  onClick={() => handleStatusChange(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
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
              <div className="flex items-center gap-2">
                <Input
                  value={sendTo}
                  onChange={(e) => setSendTo(e.target.value)}
                  placeholder="abuse@registrar.com"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  <Copy className="size-3.5" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                  <Download className="size-3.5" />
                  Download .txt
                </Button>
                <Button
                  size="sm"
                  onClick={handleSendTakedown}
                  disabled={!config?.alerts.smtpHost || !sendTo || sendTakedown.isPending}
                  className="gap-1.5"
                  title={!config?.alerts.smtpHost ? "Configure SMTP in Settings to send notices directly" : undefined}
                >
                  {sendTakedown.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Send via Email
                </Button>
              </div>
              {!config?.alerts.smtpHost && (
                <p className="text-xs text-text-dim">
                  Configure SMTP in Settings to send notices directly.
                </p>
              )}
              {sentAt && (
                <p className="text-xs text-text-dim">
                  Sent on {new Date(sentAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
