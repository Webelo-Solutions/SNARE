"use client";

import { useMemo, useState, type PointerEvent } from "react";

interface DayPoint {
  day: string;
  count: number;
}

const WIDTH = 600;
const HEIGHT = 140;
const PAD_LEFT = 4;
const PAD_RIGHT = 4;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** New domains discovered per day, last 30 days — a single series, so no
 * legend box (the title already names it); accent hue + area wash per the
 * dataviz skill's trend-over-time spec. */
export function TrendChart({ newPerDay }: { newPerDay: DayPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const series = useMemo(() => {
    const counts = new Map(newPerDay.map((p) => [p.day, p.count]));
    return lastNDays(30).map((day) => ({ day, count: counts.get(day) ?? 0 }));
  }, [newPerDay]);

  const max = Math.max(1, ...series.map((p) => p.count));
  const innerW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const innerH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = series.length > 1 ? innerW / (series.length - 1) : 0;
  const baselineY = PAD_TOP + innerH;

  const points = series.map((p, i) => ({
    ...p,
    x: PAD_LEFT + i * stepX,
    y: baselineY - (p.count / max) * innerH,
  }));

  const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`
      : "";

  // The chart has no y-axis ticks, so the peak — the one point the reader
  // most needs a scale reference for — gets a direct label instead (the
  // "label the extreme" case from the dataviz skill).
  const peakIdx = points.reduce(
    (best, pt, i) => (pt.count > points[best].count ? i : best),
    0
  );

  function handleMove(e: PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let best = Infinity;
    points.forEach((pt, i) => {
      const d = Math.abs(pt.x - relX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  if (series.every((p) => p.count === 0)) {
    return <p className="text-xs text-text-dim">No new domains discovered in the last 30 days.</p>;
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ height: HEIGHT }}
        preserveAspectRatio="none"
      >
        <line
          x1={PAD_LEFT}
          y1={baselineY}
          x2={WIDTH - PAD_RIGHT}
          y2={baselineY}
          className="text-border"
          stroke="currentColor"
          strokeWidth={1}
        />
        <path d={areaPath} className="text-primary" fill="currentColor" fillOpacity={0.1} />
        <path
          d={linePath}
          className="text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {hoverIdx !== peakIdx && (
          <text
            x={points[peakIdx].x}
            y={Math.max(10, points[peakIdx].y - 6)}
            fontSize={10}
            textAnchor={peakIdx > points.length / 2 ? "end" : "start"}
            className="fill-text-dim tabular-nums"
          >
            {points[peakIdx].count}
          </text>
        )}
        {hovered && (
          <>
            <line
              x1={hovered.x}
              y1={PAD_TOP}
              x2={hovered.x}
              y2={baselineY}
              className="text-border"
              stroke="currentColor"
              strokeWidth={1}
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={4}
              className="text-primary"
              fill="currentColor"
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          </>
        )}
        <text x={PAD_LEFT} y={HEIGHT - 6} fontSize={10} className="fill-text-dim">
          {series[0]?.day.slice(5)}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 6}
          fontSize={10}
          textAnchor="end"
          className="fill-text-dim"
        >
          {series[series.length - 1]?.day.slice(5)}
        </text>
        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverIdx(null)}
        />
      </svg>
      {hovered && (
        <div
          className="pointer-events-none absolute rounded-md border border-border bg-surface2 px-2 py-1 text-xs shadow-md"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: 0,
            transform: "translate(-50%, -110%)",
          }}
        >
          <div className="font-semibold tabular-nums text-foreground">{hovered.count}</div>
          <div className="text-text-dim">{hovered.day}</div>
        </div>
      )}
    </div>
  );
}
