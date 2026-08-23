"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfig } from "@/hooks/use-config";
import { api } from "@/lib/client/api";

export function RegisterDomainButton({ domain }: { domain: string }) {
  const { data: config } = useConfig();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!config) return;
    setLoading(true);
    try {
      const { url } = await api.registrarUrl(domain, config.preferredRegistrar);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to build registrar link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-xs text-risk-green hover:underline disabled:opacity-50"
      title="Register this domain defensively"
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ExternalLink className="size-3.5" />}
      Register
    </button>
  );
}
