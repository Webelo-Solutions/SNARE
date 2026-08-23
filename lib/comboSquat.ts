// Shared between server (patterns.ts) and client (pattern editor dialog) —
// no "server-only" guard since the client needs to encode/decode the same
// "keyword|prefix,suffix,subdomain" value string.
export const ALL_COMBOSQUAT_POSITIONS = new Set(["prefix", "suffix", "subdomain"]);

export function parseCombosquatValue(keyword: string, positions: Set<string>): string {
  const posStr = [...positions]
    .filter((p) => ALL_COMBOSQUAT_POSITIONS.has(p))
    .sort()
    .join(",");
  const isAll = [...ALL_COMBOSQUAT_POSITIONS].every((p) => positions.has(p));
  return isAll ? keyword : `${keyword}|${posStr}`;
}

export function decodeCombosquatValue(value: string): { keyword: string; positions: Set<string> } {
  if (value.includes("|")) {
    const [keyword, posStr] = value.split("|", 2);
    return { keyword, positions: new Set(posStr.split(",")) };
  }
  return { keyword: value, positions: new Set(ALL_COMBOSQUAT_POSITIONS) };
}
