import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "critical" | "high" | "good" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  critical: "text-risk-critical",
  high: "text-risk-high",
  good: "text-risk-green",
  neutral: "text-foreground",
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1000)}K`;
  if (value >= 1_000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
      <Icon className={cn("size-5 shrink-0", TONE_TEXT[tone])} />
      <div className="min-w-0">
        <div className={cn("text-2xl font-semibold leading-tight", TONE_TEXT[tone])}>
          {formatCompact(value)}
        </div>
        <div className="truncate text-xs text-text-dim">{label}</div>
      </div>
    </div>
  );
}
