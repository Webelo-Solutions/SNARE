"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { ComponentProps } from "react";

/**
 * A text input that only calls onCommit once editing settles (blur or
 * Enter), not on every keystroke. Settings forms save straight to a JSON
 * config file on every commit — saving per-keystroke would fire a PUT per
 * character and race full-config snapshots against each other, silently
 * dropping keystrokes typed faster than a round trip.
 */
export function CommittedInput({
  value,
  onCommit,
  ...props
}: Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [trackedValue, setTrackedValue] = useState(value);

  // Adjust local draft when the upstream value changes for a reason other
  // than our own edits (e.g. config reloaded) — render-time state
  // adjustment, not an effect.
  if (value !== trackedValue && draft === trackedValue) {
    setTrackedValue(value);
    setDraft(value);
  } else if (value !== trackedValue) {
    setTrackedValue(value);
  }

  function commit() {
    if (draft !== value) onCommit(draft);
  }

  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
