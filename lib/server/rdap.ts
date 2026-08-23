import "server-only";
import { whoisDomain, firstResult } from "whoiser";

const RDAP_URL = (domain: string) => `https://rdap.org/domain/${encodeURIComponent(domain)}`;
const RDAP_TIMEOUT_MS = 10_000;

export interface LookupInfo {
  registrar: string | null;
  creationDate: string | null; // ISO timestamp
  abuseEmail: string;
  raw?: unknown;
}

type VCardItem = [string, Record<string, unknown>, string, string | undefined];

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, VCardItem[]];
  entities?: RdapEntity[];
  handle?: string;
}

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapData {
  events?: RdapEvent[];
  entities?: RdapEntity[];
  [key: string]: unknown;
}

function vcardEmail(entity: RdapEntity): string {
  const vcard = entity.vcardArray;
  if (!vcard || vcard.length < 2) return "";
  for (const item of vcard[1]) {
    if (item[0] === "email") return item[3] ?? "";
  }
  return "";
}

function vcardFn(entity: RdapEntity): string | undefined {
  const vcard = entity.vcardArray;
  if (!vcard || vcard.length < 2) return undefined;
  for (const item of vcard[1]) {
    if (item[0] === "fn") return item[3];
  }
  return undefined;
}

function rdapEvent(data: RdapData, action: string): string | null {
  for (const event of data.events ?? []) {
    if (event.eventAction === action && event.eventDate) {
      const d = new Date(event.eventDate);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function rdapRegistrar(data: RdapData): string | null {
  for (const entity of data.entities ?? []) {
    if (entity.roles?.includes("registrar")) {
      return vcardFn(entity) ?? entity.handle ?? null;
    }
  }
  return null;
}

/** Walk entities (and their nested entities) for an 'abuse' role email. */
function rdapAbuseEmail(data: RdapData): string {
  for (const entity of data.entities ?? []) {
    if (entity.roles?.includes("abuse")) {
      const email = vcardEmail(entity);
      if (email) return email;
    }
    for (const nested of entity.entities ?? []) {
      if (nested.roles?.includes("abuse")) {
        const email = vcardEmail(nested);
        if (email) return email;
      }
    }
  }
  return "";
}

async function fetchRdap(domain: string): Promise<LookupInfo | null> {
  let data: RdapData;
  try {
    const resp = await fetch(RDAP_URL(domain), {
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!resp.ok) return null;
    data = await resp.json();
  } catch {
    return null;
  }

  const creationDate = rdapEvent(data, "registration");
  const registrar = rdapRegistrar(data);
  const abuseEmail = rdapAbuseEmail(data);

  if (!creationDate && !registrar) return null;

  return { registrar, creationDate, abuseEmail, raw: data };
}

async function whoisFallback(domain: string): Promise<LookupInfo | null> {
  try {
    const results = await whoisDomain(domain, { follow: 2, timeout: 10_000 });
    const info = firstResult(results);
    const registrar = (info["Registrar"] as string) || null;
    const createdRaw = info["Created Date"];
    const createdStr = Array.isArray(createdRaw) ? createdRaw[0] : createdRaw;
    let creationDate: string | null = null;
    if (createdStr) {
      const d = new Date(createdStr);
      if (!Number.isNaN(d.getTime())) creationDate = d.toISOString();
    }
    if (!registrar && !creationDate) return null;
    return { registrar, creationDate, abuseEmail: "" };
  } catch {
    return null;
  }
}

/** Return registration info for a domain. Tries RDAP first, then WHOIS. */
export async function lookup(domain: string): Promise<LookupInfo> {
  const rdap = await fetchRdap(domain);
  if (rdap) return rdap;
  const whois = await whoisFallback(domain);
  return whois ?? { registrar: null, creationDate: null, abuseEmail: "" };
}

export async function isNewlyRegistered(
  domain: string,
  days = 30
): Promise<{ isNew: boolean; info: LookupInfo }> {
  const info = await lookup(domain);
  if (!info.creationDate) return { isNew: false, info };
  const cutoff = Date.now() - days * 86_400_000;
  const isNew = new Date(info.creationDate).getTime() >= cutoff;
  return { isNew, info };
}

// ------------------------------------------------------------------ //
// Standalone abuse-contact lookup (used by the takedown-notice flow,
// independent of the enrichment path above — mirrors core/takedown.py).
// ------------------------------------------------------------------ //

export interface AbuseContact {
  email: string | null;
  phone: string | null;
  name: string | null;
}

function parseContact(entity: RdapEntity): AbuseContact {
  const contact: AbuseContact = { email: null, phone: null, name: null };
  const vcard = entity.vcardArray;
  if (!vcard || vcard.length < 2) return contact;
  for (const item of vcard[1]) {
    const [kind, , , value] = item;
    if (kind === "fn") contact.name = value ?? null;
    else if (kind === "email") contact.email = value ?? null;
    else if (kind === "tel") contact.phone = value ? value.replace(/^tel:/, "") : null;
  }
  return contact;
}

export async function getAbuseContact(domain: string): Promise<AbuseContact | Record<string, never>> {
  let data: RdapData;
  try {
    const resp = await fetch(RDAP_URL(domain), {
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!resp.ok) return {};
    data = await resp.json();
  } catch {
    return {};
  }

  for (const entity of data.entities ?? []) {
    if (entity.roles?.includes("abuse")) return parseContact(entity);
  }
  // Some registries nest abuse contact inside the registrar entity
  for (const entity of data.entities ?? []) {
    if (entity.roles?.includes("registrar")) {
      for (const sub of entity.entities ?? []) {
        if (sub.roles?.includes("abuse")) return parseContact(sub);
      }
    }
  }
  return {};
}
