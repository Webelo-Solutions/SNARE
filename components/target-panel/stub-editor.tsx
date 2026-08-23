"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConfig, useSaveConfig } from "@/hooks/use-config";

/**
 * Custom prefix/suffix "stubs" — e.g. "vpn" generates vpn-acme.com,
 * vpnacme.com, vpn.acme.com — always surfaced regardless of score
 * (see MIN_AVAILABLE_SCORE bypass in scanEngine.ts).
 */
export function StubEditor() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();
  const [newStub, setNewStub] = useState("");

  const stubs = config?.customStubs ?? [];

  function addStub() {
    const stub = newStub.trim().toLowerCase();
    if (!stub || !config) return;
    if (config.customStubs.includes(stub)) {
      setNewStub("");
      return;
    }
    saveConfig.mutate({ ...config, customStubs: [...config.customStubs, stub] });
    setNewStub("");
  }

  function removeStub(stub: string) {
    if (!config) return;
    saveConfig.mutate({ ...config, customStubs: config.customStubs.filter((s) => s !== stub) });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-text-dim">
        Custom Stubs
      </div>
      <p className="px-3 pb-2 text-[11px] text-text-dim">
        Extra prefixes/suffixes (e.g. &quot;vpn&quot;) always surfaced, regardless of score.
      </p>
      <div className="flex gap-1.5 px-3 pb-2">
        <Input
          value={newStub}
          onChange={(e) => setNewStub(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addStub()}
          placeholder="vpn"
          className="h-8 text-sm"
        />
        <Button size="icon" className="size-8 shrink-0" onClick={addStub}>
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-1 pb-3">
          {stubs.length === 0 && (
            <p className="px-1 py-2 text-xs text-text-dim">No custom stubs configured.</p>
          )}
          {stubs.map((stub) => (
            <div
              key={stub}
              className="group flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <span className="truncate font-mono text-[13px]">{stub}</span>
              <button
                onClick={() => removeStub(stub)}
                className="text-text-dim opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
