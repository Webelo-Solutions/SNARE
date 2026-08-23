import "server-only";
import type { RegistrarKey } from "@/lib/types";

export const REGISTRARS: Record<RegistrarKey, { name: string; urlTemplate: string }> = {
  namecheap: {
    name: "Namecheap",
    urlTemplate: "https://www.namecheap.com/domains/registration/results/?domain={domain}",
  },
  godaddy: {
    name: "GoDaddy",
    urlTemplate: "https://www.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck={domain}",
  },
  porkbun: {
    name: "Porkbun",
    urlTemplate: "https://porkbun.com/checkout/registerDomain?domain={domain}",
  },
  dynadot: {
    name: "Dynadot",
    urlTemplate: "https://www.dynadot.com/domain/search.html?domain={domain}",
  },
  hover: {
    name: "Hover",
    urlTemplate: "https://www.hover.com/domains/results?q={domain}",
  },
  squarespace: {
    name: "Squarespace Domains",
    urlTemplate: "https://domains.squarespace.com/search?query={domain}",
  },
};

export const REGISTRAR_KEYS = Object.keys(REGISTRARS) as RegistrarKey[];

export function displayName(key: RegistrarKey): string {
  return (REGISTRARS[key] ?? REGISTRARS.namecheap).name;
}

export function registrationUrl(domain: string, key: RegistrarKey): string {
  const template = (REGISTRARS[key] ?? REGISTRARS.namecheap).urlTemplate;
  return template.replace("{domain}", encodeURIComponent(domain));
}
