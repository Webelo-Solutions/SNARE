import "server-only";

export const QWERTY_ADJACENT: Record<string, string> = {
  a: "qwsz", b: "vghn", c: "xdfv", d: "ersfxc",
  e: "wsdr", f: "rtgdcv", g: "tyhfvb", h: "yujgnb",
  i: "ujko", j: "uikhbn", k: "iolmj", l: "opk",
  m: "nkj", n: "bhjm", o: "iklp", p: "ol",
  q: "wa", r: "etdf", s: "wedxza", t: "ryfg",
  u: "yhji", v: "cfgb", w: "qase", x: "zsdc",
  y: "tghu", z: "asx",
};

export const HOMOGLYPHS: Record<string, string[]> = {
  a: ["à", "á", "â", "ä"],
  e: ["è", "é", "ê", "ë"],
  i: ["ì", "í", "î"],
  o: ["ò", "ó", "ô"],
  u: ["ù", "ú", "û", "ü"],
  c: ["ç"],
  n: ["ñ"],
};

// Leet-speak number substitutions (bidirectional)
export const NUMBER_SUBS: Record<string, string[]> = {
  a: ["4"], b: ["8"], e: ["3"], g: ["9"], i: ["1"],
  l: ["1"], o: ["0"], s: ["5"], t: ["7"], z: ["2"],
};

// Cyrillic look-alikes used in IDN homograph attacks. Each Cyrillic
// character is visually indistinguishable from its Latin counterpart in
// most fonts, making these the most dangerous squatting vectors.
export const CYRILLIC_SUBS: Record<string, string[]> = {
  a: ["а"], c: ["с"], e: ["е"], i: ["і"], j: ["ј"],
  o: ["о"], p: ["р"], s: ["ѕ"], x: ["х"], y: ["у"],
};

export const COMMON_TLDS = [
  ".com", ".net", ".org", ".io", ".co", ".info",
  ".biz", ".us", ".online", ".site", ".app", ".dev",
];

export const COMMON_PREFIXES = [
  "login-", "secure-", "my-", "mail-", "auth-",
  "account-", "support-", "portal-", "www-",
  "signin-", "verify-", "update-", "confirm-",
  "help-", "service-", "customer-", "online-",
  "access-", "connect-", "id-", "go-",
];

export const COMMON_SUFFIXES = [
  "-login", "-secure", "-account", "-support",
  "-help", "-online", "-portal", "-verify",
  "-signin", "-update", "-confirm", "-service",
  "-customer", "-access", "-connect", "-id",
  "-app", "-web", "-site", "-official",
];

// Labels used to generate subdomain-position combosquat variants:
// e.g. login.acme.com, acme.secure-site.net
export const SUBDOMAIN_PREFIXES = [
  "login", "secure", "auth", "mail", "portal",
  "support", "account", "www", "app", "api",
  "signin", "verify", "update", "confirm",
  "help", "service", "customer", "access",
];

function splitDomain(domain: string): [string, string] {
  const idx = domain.lastIndexOf(".");
  if (idx === -1) return [domain, ""];
  return [domain.slice(0, idx), domain.slice(idx)];
}

export function customStubVariants(
  domain: string,
  prefixes: string[],
  suffixes: string[]
): Set<string> {
  const [name, tld] = splitDomain(domain);
  const variants = new Set<string>();

  for (const raw of prefixes) {
    const stub = raw.trim().replace(/^-+|-+$/g, "").toLowerCase();
    if (!stub) continue;
    variants.add(`${stub}-${domain}`);
    variants.add(`${stub}${name}${tld}`);
    variants.add(`${stub}.${domain}`);
  }

  for (const raw of suffixes) {
    const stub = raw.trim().replace(/^-+|-+$/g, "").toLowerCase();
    if (!stub) continue;
    variants.add(`${name}-${stub}${tld}`);
    variants.add(`${name}${stub}${tld}`);
  }

  return new Set([...variants].filter((v) => v && v.length > 4 && v.includes(".")));
}

/**
 * Reverse-subdomain stub variants: the target's own label used as a
 * subdomain of a *stub-themed apex domain* — e.g. target "rate.com" + stub
 * "support" -> "rate.support.com". This catches a different phishing
 * pattern than customStubVariants(): rather than a variant of the target's
 * own domain, the attacker registers an unrelated-looking apex (support.com,
 * support.net, ...) outright and jams the brand name in front as a
 * subdomain to look like a legitimate portal.
 *
 * Deliberately kept separate from customStubVariants() — unlike those
 * patterns, an unresolved hit here isn't something the target could
 * "defensively register" (it's a subdomain of someone else's zone), so it
 * must not get the same always-surface-as-available treatment; it's only
 * meaningful once it actually resolves.
 */
export function reverseSubdomainStubVariants(domain: string, stubs: string[]): Set<string> {
  const [name, tld] = splitDomain(domain);
  const variants = new Set<string>();
  const tlds = new Set([tld, ...COMMON_TLDS]);

  for (const raw of stubs) {
    const stub = raw.trim().replace(/^-+|-+$/g, "").toLowerCase();
    if (!stub) continue;
    for (const candidateTld of tlds) {
      variants.add(`${name}.${stub}${candidateTld}`);
    }
  }

  return new Set([...variants].filter((v) => v && v.length > 4 && v.includes(".")));
}

export function generate(
  domain: string,
  extraPrefixes: string[] = [],
  extraSuffixes: string[] = []
): Set<string> {
  const [name, tld] = splitDomain(domain);
  const variants = new Set<string>();

  // Character deletion
  for (let i = 0; i < name.length; i++) {
    variants.add(name.slice(0, i) + name.slice(i + 1) + tld);
  }

  // Character doubling
  for (let i = 0; i < name.length; i++) {
    variants.add(name.slice(0, i) + name[i] + name.slice(i) + tld);
  }

  // Adjacent transposition
  for (let i = 0; i < name.length - 1; i++) {
    const chars = name.split("");
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    variants.add(chars.join("") + tld);
  }

  // QWERTY adjacent key substitution
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    for (const adj of QWERTY_ADJACENT[c] ?? "") {
      variants.add(name.slice(0, i) + adj + name.slice(i + 1) + tld);
    }
  }

  // Homoglyph, number, and Cyrillic substitutions
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    for (const table of [HOMOGLYPHS, NUMBER_SUBS, CYRILLIC_SUBS]) {
      for (const glyph of table[c] ?? []) {
        variants.add(name.slice(0, i) + glyph + name.slice(i + 1) + tld);
      }
    }
  }

  // Vowel swap
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if ("aeiou".includes(c)) {
      for (const v of "aeiou") {
        if (v !== c) {
          variants.add(name.slice(0, i) + v + name.slice(i + 1) + tld);
        }
      }
    }
  }

  // TLD variations
  for (const altTld of COMMON_TLDS) {
    if (altTld !== tld) {
      variants.add(name + altTld);
    }
  }

  // Common prefix / suffix additions
  for (const prefix of COMMON_PREFIXES) {
    variants.add(prefix + domain);
  }
  for (const suffix of COMMON_SUFFIXES) {
    variants.add(name + suffix + tld);
  }

  // Dot insertion (creates subdomain-style splits)
  for (let i = 1; i < name.length; i++) {
    variants.add(name.slice(0, i) + "." + name.slice(i) + tld);
  }

  // Hyphen insertion / removal
  variants.add(name.replaceAll("-", "") + tld);
  for (let i = 1; i < name.length; i++) {
    variants.add(name.slice(0, i) + "-" + name.slice(i) + tld);
  }

  // Combosquat — prefix position: keyword + separator + random word on same registrable domain
  for (const prefix of COMMON_PREFIXES) {
    variants.add(name + prefix.replace(/^-+|-+$/g, "") + tld);
  }

  // Combosquat — suffix position: word + separator + keyword
  for (const suffix of COMMON_SUFFIXES) {
    variants.add(suffix.replace(/^-+|-+$/g, "") + name + tld);
  }

  // Combosquat — subdomain position: label.domain.tld
  for (const label of SUBDOMAIN_PREFIXES) {
    variants.add(`${label}.${domain}`);
  }

  // User-defined custom stubs
  for (const v of customStubVariants(domain, extraPrefixes, extraSuffixes)) {
    variants.add(v);
  }

  variants.delete(domain);
  return new Set([...variants].filter((v) => v && v.length > 4 && v.includes(".")));
}
