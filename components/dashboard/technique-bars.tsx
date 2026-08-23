"use client";

const MAX_ROWS = 8;

export function TechniqueBars({
  byTechnique,
}: {
  byTechnique: Array<{ technique: string; count: number }>;
}) {
  if (byTechnique.length === 0) {
    return <p className="text-xs text-text-dim">No classified results yet.</p>;
  }

  const top = byTechnique.slice(0, MAX_ROWS);
  const otherCount = byTechnique.slice(MAX_ROWS).reduce((sum, r) => sum + r.count, 0);
  const rows = otherCount > 0 ? [...top, { technique: "Other", count: otherCount }] : top;
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const widthPct = Math.max(4, (row.count / max) * 100);
        return (
          <div key={row.technique} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-xs text-text-dim" title={row.technique}>
              {row.technique}
            </span>
            <div className="h-3.5 flex-1">
              <div className="h-full rounded-r-sm bg-primary" style={{ width: `${widthPct}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-foreground">
              {row.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
