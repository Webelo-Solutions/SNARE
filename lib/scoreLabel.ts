// Shared between server (scoring.ts) and client (ScoreBadge) — no "server-only"
// guard here since the client needs these thresholds too.
export type ScoreLabel = "Critical" | "High" | "Medium" | "Low";

export function scoreLabel(scoreVal: number): ScoreLabel {
  if (scoreVal >= 70) return "Critical";
  if (scoreVal >= 50) return "High";
  if (scoreVal >= 30) return "Medium";
  return "Low";
}
