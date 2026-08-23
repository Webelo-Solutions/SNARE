"use client";

import { useState } from "react";
import { Plus, X, Play, Square, Settings, History, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StubEditor } from "./stub-editor";
import { PatternList } from "@/components/patterns/pattern-list";
import { useConfig, useAddTarget, useRemoveTarget } from "@/hooks/use-config";
import { useStartScan, useStopScan } from "@/hooks/use-scans";
import { toast } from "sonner";

interface TargetPanelProps {
  scanning: boolean;
  activeScanId: number | null;
  onScanStarted: (scanId: number) => void;
}

export function TargetPanel({ scanning, activeScanId, onScanStarted }: TargetPanelProps) {
  const { data: config } = useConfig();
  const addTarget = useAddTarget();
  const removeTarget = useRemoveTarget();
  const startScan = useStartScan();
  const stopScan = useStopScan();
  const [newTarget, setNewTarget] = useState("");

  const targets = config?.targets ?? [];

  function handleAdd() {
    const domain = newTarget.trim().toLowerCase();
    if (!domain) return;
    addTarget.mutate(domain, { onSuccess: () => setNewTarget("") });
  }

  function handleStart() {
    if (targets.length === 0) {
      toast.error("Add at least one domain before scanning.");
      return;
    }
    startScan.mutate(undefined, {
      onSuccess: ({ scanId }) => onScanStarted(scanId),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to start scan"),
    });
  }

  function handleStop() {
    if (activeScanId == null) return;
    stopScan.mutate(activeScanId);
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-bold tracking-wide text-foreground">SNARE</h1>
        <div className="flex gap-1">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="size-7" title="Dashboard">
              <LayoutDashboard className="size-4" />
            </Button>
          </Link>
          <Link href="/history">
            <Button variant="ghost" size="icon" className="size-7" title="Scan History">
              <History className="size-4" />
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="size-7" title="Settings">
              <Settings className="size-4" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {!scanning ? (
          <Button onClick={handleStart} disabled={startScan.isPending} className="w-full gap-1.5">
            <Play className="size-3.5" />
            Start Scan
          </Button>
        ) : (
          <Button
            onClick={handleStop}
            variant="destructive"
            disabled={stopScan.isPending}
            className="w-full gap-1.5"
          >
            <Square className="size-3.5" />
            Stop Scan
          </Button>
        )}
      </div>

      <Tabs defaultValue="targets" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList className="mx-3 grid grid-cols-3">
          <TabsTrigger value="targets" className="text-xs">
            Targets
          </TabsTrigger>
          <TabsTrigger value="stubs" className="text-xs">
            Stubs
          </TabsTrigger>
          <TabsTrigger value="filters" className="text-xs">
            Filters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="targets" className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1.5 px-3 pb-2 pt-2">
            <Input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="acme.com"
              className="h-8 text-sm"
            />
            <Button
              size="icon"
              className="size-8 shrink-0"
              onClick={handleAdd}
              disabled={addTarget.isPending}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 px-3">
            <div className="flex flex-col gap-1 pb-3">
              {targets.length === 0 && (
                <p className="px-1 py-2 text-xs text-text-dim">
                  No targets yet. Add a domain to start monitoring.
                </p>
              )}
              {targets.map((domain) => (
                <div
                  key={domain}
                  className="group flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <span className="truncate font-mono text-[13px]">{domain}</span>
                  <button
                    onClick={() => removeTarget.mutate(domain)}
                    className="text-text-dim opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title="Remove target"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="stubs" className="flex min-h-0 flex-1 flex-col">
          <StubEditor />
        </TabsContent>

        <TabsContent value="filters" className="flex min-h-0 flex-1 flex-col">
          <PatternList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
