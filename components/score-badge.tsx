import { cn } from "@/lib/utils";
import { scoreLabel } from "@/lib/scoreLabel";

const STYLES: Record<string, string> = {
  Critical: "bg-risk-critical/15 text-risk-critical border-risk-critical/40",
  High: "bg-risk-high/15 text-risk-high border-risk-high/40",
  Medium: "bg-risk-medium/15 text-risk-medium border-risk-medium/40",
  Low: "bg-surface2 text-text-dim border-border",
};

export function ScoreBadge({ score }: { score: number }) {
  const lbl = scoreLabel(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums",
        STYLES[lbl]
      )}
    >
      {score}
      <span className="font-normal opacity-80">{lbl}</span>
    </span>
  );
}
