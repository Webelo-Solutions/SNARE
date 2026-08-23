"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PatternEditorDialog } from "./pattern-editor-dialog";
import {
  usePatterns,
  useCreatePattern,
  useUpdatePattern,
  useDeletePattern,
} from "@/hooks/use-patterns";
import type { Pattern } from "@/lib/types";

export function PatternList() {
  const { data: patterns = [] } = usePatterns();
  const createPattern = useCreatePattern();
  const updatePattern = useUpdatePattern();
  const deletePattern = useDeletePattern();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Pattern | null>(null);

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(pattern: Pattern) {
    setEditing(pattern);
    setDialogOpen(true);
  }

  function handleSave(pattern: Omit<Pattern, "id">) {
    if (editing) {
      updatePattern.mutate({ id: editing.id, patch: pattern });
    } else {
      createPattern.mutate(pattern);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">
          Filters
        </span>
        <Button size="icon" variant="ghost" className="size-6" onClick={openNew}>
          <Plus className="size-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-1.5 pb-3">
          {patterns.length === 0 && (
            <p className="px-1 py-2 text-xs text-text-dim">
              No filters — all discovered domains will surface.
            </p>
          )}
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              className="group flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
            >
              <Switch
                checked={pattern.enabled}
                onCheckedChange={(enabled) =>
                  updatePattern.mutate({ id: pattern.id, patch: { enabled } })
                }
                className="scale-90"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px]">{pattern.name || pattern.value}</span>
                  <Badge
                    variant="outline"
                    className={
                      pattern.mode === "Exclude"
                        ? "border-risk-critical/40 text-risk-critical text-[10px] px-1 py-0"
                        : "border-risk-green/40 text-risk-green text-[10px] px-1 py-0"
                    }
                  >
                    {pattern.mode === "Exclude" ? "EXC" : "INC"}
                  </Badge>
                </div>
                <div className="truncate text-[11px] text-text-dim">{pattern.type}</div>
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => openEdit(pattern)}
                  className="text-text-dim hover:text-primary"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => deletePattern.mutate(pattern.id)}
                  className="text-text-dim hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <PatternEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={handleSave}
      />
    </div>
  );
}
