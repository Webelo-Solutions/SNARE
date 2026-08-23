import "server-only";
import {
  QWERTY_ADJACENT,
  HOMOGLYPHS,
  NUMBER_SUBS,
  CYRILLIC_SUBS,
  COMMON_PREFIXES,
  COMMON_SUFFIXES,
  SUBDOMAIN_PREFIXES,
} from "./permutations";

function splitDomain(domain: string): [string, string] {
  const idx = domain.lastIndexOf(".");
  if (idx === -1) return [domain, ""];
  return [domain.slice(0, idx), domain.slice(idx)];
}

function cleanWord(raw: string): string {
  return raw.trim().replace(/^-+|-+$/g, "").toLowerCase();
}

function positionsWhereDiffer(a: string, b: string): number[] {
  if (a.length !== b.length) return [];
  const positions: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) positions.push(i);
  return positions;
}

function isCharDeletion(shorter: string, longer: string): boolean {
  // shorter must equal longer with exactly one character removed at some position
  for (let i = 0; i < longer.length; i++) {
    if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  }
  return false;
}

function isCharDoubling(longer: string, shorter: string): boolean {
  for (let i = 0; i < shorter.length; i++) {
    if (shorter.slice(0, i) + shorter[i] + shorter.slice(i) === longer) return true;
  }
  return false;
}

function isAdjacentSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diffs = positionsWhereDiffer(a, b);
  if (diffs.length !== 2 || diffs[1] !== diffs[0] + 1) return false;
  const [i, j] = diffs;
  return a[i] === b[j] && a[j] === b[i];
}

function isCyrillic(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x0400 && code <= 0x04ff;
}

function isKnownHomoglyph(original: string, replacement: string): boolean {
  return (HOMOGLYPHS[original] ?? []).includes(replacement);
}

function isKnownLeetDigit(original: string, replacement: string): boolean {
  return (NUMBER_SUBS[original] ?? []).includes(replacement);
}

function isKnownCyrillicSub(original: string, replacement: string): boolean {
  return (CYRILLIC_SUBS[original] ?? []).includes(replacement);
}

function isVowelSwap(original: string, replacement: string): boolean {
  return "aeiou".includes(original) && "aeiou".includes(replacement) && original !== replacement;
}

function isQwertyAdjacent(original: string, replacement: string): boolean {
  return (QWERTY_ADJACENT[original] ?? "").includes(replacement);
}

/**
 * Classify how a discovered domain relates to its target — inspecting the
 * *result* structurally rather than threading provenance through
 * generate(), since several distinct techniques can independently produce
 * the same string (a Set naturally dedupes those). Order matters: checks
 * run most-specific-first, falling back to a generic label so nothing goes
 * unclassified.
 */
export function classifyPermutation(domain: string, target: string, customStubs: string[]): string {
  if (domain === target) return "Exact Match";

  const [tName, tTld] = splitDomain(target);
  const stubs = customStubs.map(cleanWord).filter(Boolean);

  // Reverse-subdomain: target's own label as a subdomain of a completely
  // different apex domain (rate.support.com) — not a subdomain of the
  // target at all. Requires at least 3 labels (subdomain + apex + tld);
  // a plain 2-label TLD variation like "rate.net" would otherwise also
  // match on "first label equals target's label" alone.
  const firstLabel = domain.split(".")[0];
  if (domain.split(".").length > 2 && firstLabel === tName && !domain.endsWith(`.${target}`)) {
    return "Subdomain of Attacker Domain";
  }

  // A real subdomain of the target itself (support.rate.com, or a
  // legitimate subdomain crt.sh found like secure.rate.com).
  if (domain.endsWith(`.${target}`)) {
    const sub = domain.slice(0, domain.length - target.length - 1);
    const closestLabel = sub.split(".").pop() ?? sub;
    if (stubs.includes(closestLabel)) return "Custom Stub (Subdomain)";
    if (SUBDOMAIN_PREFIXES.includes(closestLabel)) return "Combosquat (Subdomain)";
    return "Subdomain";
  }

  const [dName, dTld] = splitDomain(domain);

  // Word (built-in list or custom stub) glued directly before/after the
  // target's label, with or without a hyphen.
  const words = [...COMMON_PREFIXES, ...COMMON_SUFFIXES].map(cleanWord).concat(stubs);
  for (const word of new Set(words)) {
    if (!word) continue;
    if (dName === `${word}${tName}` || dName === `${word}-${tName}`) return "Combosquat (Prefix)";
    if (dName === `${tName}${word}` || dName === `${tName}-${word}`) return "Combosquat (Suffix)";
  }

  if (dName === tName && dTld !== tTld) return "TLD Variation";

  if (dName.replace(/-/g, "") === tName.replace(/-/g, "") && dName !== tName) {
    return "Hyphen Variation";
  }

  if (dTld === tTld) {
    if (dName.length === tName.length - 1 && isCharDeletion(dName, tName)) {
      return "Character Deletion";
    }
    if (dName.length === tName.length + 1 && isCharDoubling(dName, tName)) {
      return "Character Doubling";
    }
    if (dName.length === tName.length) {
      const diffs = positionsWhereDiffer(dName, tName);
      if (diffs.length === 2 && isAdjacentSwap(dName, tName)) return "Adjacent Transposition";
      if (diffs.length === 1) {
        const i = diffs[0];
        const original = tName[i];
        const replacement = dName[i];
        if (isCyrillic(replacement) || isKnownCyrillicSub(original, replacement)) {
          return "Cyrillic Homoglyph";
        }
        if (isKnownHomoglyph(original, replacement)) return "Homoglyph Substitution";
        if (isKnownLeetDigit(original, replacement)) return "Leetspeak Substitution";
        if (isVowelSwap(original, replacement)) return "Vowel Swap";
        if (isQwertyAdjacent(original, replacement)) return "Keyboard-Adjacent Substitution";
        return "Character Substitution";
      }
    }

    // Dot insertion splits the target's own label into two, forming a fake
    // subdomain out of the label itself (ra.te.com from "rate") — distinct
    // from a stub-word subdomain, which was already handled above.
    const dLabelsNoTld = domain.slice(0, domain.length - dTld.length).split(".");
    if (dLabelsNoTld.length > 1 && dLabelsNoTld.join("") === tName) {
      return "Dot Insertion";
    }
  }

  return "Other";
}
