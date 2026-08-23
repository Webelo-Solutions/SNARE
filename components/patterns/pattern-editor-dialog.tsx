"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { decodeCombosquatValue, parseCombosquatValue } from "@/lib/comboSquat";
import type { Pattern, PatternMode, PatternType } from "@/lib/types";

const TYPES: PatternType[] = ["Regex", "Keyword", "Edit Distance", "Combosquat"];
const MODES: PatternMode[] = ["Include", "Exclude"];

const VALUE_HINTS: Record<PatternType, string> = {
  Regex: "e.g. ^secure-.*\\.tk$",
  Keyword: "e.g. login",
  "Edit Distance": "e.g. 2 (max Levenshtein distance from target)",
  Combosquat: "e.g. acme",
};

export interface PatternEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Pattern | null;
  onSave: (pattern: Omit<Pattern, "id">) => void;
}

export function PatternEditorDialog({ open, onOpenChange, initial, onSave }: PatternEditorDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PatternType>("Keyword");
  const [mode, setMode] = useState<PatternMode>("Exclude");
  const [value, setValue] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [comboKeyword, setComboKeyword] = useState("");
  const [comboPositions, setComboPositions] = useState<Set<string>>(
    new Set(["prefix", "suffix", "subdomain"])
  );

  // Reset the form's fields whenever the dialog opens for a different
  // pattern (or opens fresh for a new one) — done synchronously during
  // render, guarded by comparing against the last-applied key, rather than
  // via an effect (React's "adjusting state when a prop changes" pattern).
  const resetKey = open ? (initial ? `edit:${initial.id}` : "new") : null;
  const [appliedResetKey, setAppliedResetKey] = useState<string | null>(null);

  // Clear the applied marker on close so reopening the *same* pattern (e.g.
  // after cancelling an in-progress edit) still re-applies fresh values.
  if (resetKey === null && appliedResetKey !== null) {
    setAppliedResetKey(null);
  } else if (resetKey !== null && resetKey !== appliedResetKey) {
    setAppliedResetKey(resetKey);
    if (initial) {
      setName(initial.name);
      setType(initial.type);
      setMode(initial.mode);
      setValue(initial.value);
      setEnabled(initial.enabled);
      if (initial.type === "Combosquat") {
        const { keyword, positions } = decodeCombosquatValue(initial.value);
        setComboKeyword(keyword);
        setComboPositions(positions);
      } else {
        setComboKeyword("");
        setComboPositions(new Set(["prefix", "suffix", "subdomain"]));
      }
    } else {
      setName("");
      setType("Keyword");
      setMode("Exclude");
      setValue("");
      setEnabled(true);
      setComboKeyword("");
      setComboPositions(new Set(["prefix", "suffix", "subdomain"]));
    }
  }

  function toggleComboPosition(pos: string, checked: boolean) {
    setComboPositions((prev) => {
      const next = new Set(prev);
      if (checked) next.add(pos);
      else next.delete(pos);
      return next;
    });
  }

  function handleSave() {
    const finalValue =
      type === "Combosquat" ? parseCombosquatValue(comboKeyword, comboPositions) : value;
    onSave({ name: name || finalValue, type, mode, value: finalValue, enabled });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Pattern" : "New Pattern"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional label" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as PatternType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as PatternMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {type === "Combosquat" ? (
            <div className="flex flex-col gap-2">
              <Label>Keyword</Label>
              <Input
                value={comboKeyword}
                onChange={(e) => setComboKeyword(e.target.value)}
                placeholder="e.g. acme"
              />
              <Label className="mt-1">Match position</Label>
              <div className="flex flex-col gap-1.5">
                {["prefix", "suffix", "subdomain"].map((pos) => (
                  <label key={pos} className="flex items-center gap-2 text-sm capitalize">
                    <Checkbox
                      checked={comboPositions.has(pos)}
                      onCheckedChange={(checked) => toggleComboPosition(pos, checked === true)}
                    />
                    {pos}
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label>Value</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={VALUE_HINTS[type]}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            Enabled
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
