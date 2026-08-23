import "server-only";
import type { Pattern } from "@/lib/types";
import { levenshtein } from "./scoring";
import { ALL_COMBOSQUAT_POSITIONS as ALL_POSITIONS } from "@/lib/comboSquat";

export { parseCombosquatValue, decodeCombosquatValue } from "@/lib/comboSquat";

// Combosquat value format: "keyword|prefix,suffix,subdomain"
// If no "|", defaults to all three positions.
export function combosquatMatch(domain: string, value: string): boolean {
  let keyword: string;
  let positions: Set<string>;

  if (value.includes("|")) {
    const [kw, posStr] = value.split("|", 2);
    keyword = kw;
    positions = new Set(posStr.split(","));
  } else {
    keyword = value;
    positions = ALL_POSITIONS;
  }

  keyword = keyword.toLowerCase().trim();
  if (!keyword) return false;

  const labels = domain.toLowerCase().split(".");
  if (labels.length < 2) return false;

  const first = labels[0];

  if (positions.has("prefix")) {
    if (first.startsWith(keyword) && first.length > keyword.length) return true;
  }
  if (positions.has("suffix")) {
    if (first.endsWith(keyword) && first.length > keyword.length) return true;
  }
  if (positions.has("subdomain")) {
    // keyword is an exact label somewhere above the registrable part
    // e.g. acme.evil.com -> labels[:-2] = ["acme"]
    if (labels.length > 2 && labels.slice(0, -2).includes(keyword)) return true;
  }

  return false;
}

export function matches(pattern: Pattern, domain: string, target = ""): boolean {
  if (!pattern.enabled) return false;

  switch (pattern.type) {
    case "Regex": {
      try {
        return new RegExp(pattern.value, "i").test(domain);
      } catch {
        return false;
      }
    }
    case "Keyword":
      return domain.toLowerCase().includes(pattern.value.toLowerCase());
    case "Edit Distance": {
      const threshold = Number.parseInt(pattern.value, 10);
      if (Number.isNaN(threshold)) return false;
      const a = domain.split(".")[0];
      const b = target.split(".")[0];
      return levenshtein(a, b) <= threshold;
    }
    case "Combosquat":
      return combosquatMatch(domain, pattern.value);
    default:
      return false;
  }
}

/** Return true if domain passes all active pattern filters. */
export function apply(domain: string, target: string, patterns: Pattern[]): boolean {
  const active = patterns.filter((p) => p.enabled);
  if (active.length === 0) return true;

  const excludes = active.filter((p) => p.mode === "Exclude");
  const includes = active.filter((p) => p.mode === "Include");

  if (excludes.some((p) => matches(p, domain, target))) return false;
  if (includes.length > 0) return includes.some((p) => matches(p, domain, target));
  return true;
}
