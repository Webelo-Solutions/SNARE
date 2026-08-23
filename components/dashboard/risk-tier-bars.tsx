"use client";

const TIER_ORDER = ["Critical", "High", "Medium", "Low"] as const;

const TIER_COLOR: Record<(typeof TIER_ORDER)[number], string> = {
  Critical: "bg-risk-critical",
  High: "bg-risk-high",
  Medium: "bg-risk-medium",
  Low: "bg-risk-low",
};

export function RiskTierBars({ byRiskTier }: { byRiskTier: Array<{ tier: string; count: number }> }) {
  const counts = new Map(byRiskTier.map((r) => [r.tier, r.count]));
  const max = Math.max(1, ...TIER_ORDER.map((t) => counts.get(t) ?? 0));

  return (
    <div className="flex flex-col gap-2.5">
      {TIER_ORDER.map((tier) => {
        const count = counts.get(tier) ?? 0;
        const widthPct = Math.max(count > 0 ? 4 : 0, (count / max) * 100);
        return (
          <div key={tier} className="flex items-center gap-3">
            <div className="flex w-16 shrink-0 items-center gap-1.5">
              <span className={`size-2 shrink-0 rounded-sm ${TIER_COLOR[tier]}`} aria-hidden />
              <span className="text-xs text-text-dim">{tier}</span>
            </div>
            <div className="h-4 flex-1">
              <div
                className={`h-full rounded-r-sm ${TIER_COLOR[tier]}`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-foreground">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
