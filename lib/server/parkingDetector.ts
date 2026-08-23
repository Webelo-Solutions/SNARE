import "server-only";

// Hostnames (or hostname suffixes) known parking/domain-marketplace
// services redirect to. Matched against the *final* URL after following
// redirects, not the original request — a parked domain typically does a
// client-side or server-side redirect through its own landing page first
// (see e.g. rate.servicedesk.info's window.onload -> /lander -> 307 to
// forsale.godaddy.com).
const PARKING_HOSTS: Array<{ suffix: string; name: string }> = [
  { suffix: "forsale.godaddy.com", name: "GoDaddy Parking" },
  { suffix: "dan.com", name: "DAN.com" },
  { suffix: "afternic.com", name: "Afternic" },
  { suffix: "hugedomains.com", name: "HugeDomains" },
  { suffix: "sedoparking.com", name: "Sedo Parking" },
  { suffix: "sedo.com", name: "Sedo" },
  { suffix: "parkingcrew.net", name: "ParkingCrew" },
  { suffix: "bodis.com", name: "Bodis" },
  { suffix: "above.com", name: "Above.com" },
  { suffix: "parklogic.com", name: "ParkLogic" },
  { suffix: "uniregistry.com", name: "Uniregistry Market" },
];

// Body-text fallback for parking pages whose redirect chain terminates
// somewhere not in the list above (e.g. a registrar's own unbranded
// parking page) but that unambiguously self-identify as for-sale/parked.
const BODY_MARKERS = [
  "this domain is for sale",
  "buy this domain",
  "make an offer on this domain",
  "domain is parked",
];

// Registrar parking pages commonly redirect via client-side JS rather than
// an HTTP 3xx (see rate.servicedesk.info: a bare `window.onload` handler
// navigating to /lander, which only *then* issues a real 307 to GoDaddy's
// parking page) — `fetch()` never executes that JS, so without unwinding
// it manually here, this entire common pattern would be invisible to a
// plain fetch-and-follow-redirects check.
const JS_REDIRECT_PATTERNS = [
  /location\.href\s*=\s*['"]([^'"]+)['"]/i,
  /location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i,
  /<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^;]*;\s*url=([^"'>]+)["']/i,
];

function matchHost(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  for (const { suffix, name } of PARKING_HOSTS) {
    if (lower === suffix || lower.endsWith(`.${suffix}`)) return name;
  }
  return null;
}

function findJsRedirectTarget(body: string): string | null {
  for (const pattern of JS_REDIRECT_PATTERNS) {
    const match = body.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchOnce(url: string): Promise<{ finalUrl: string; body: string } | null> {
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return { finalUrl: resp.url, body: (await resp.text()).slice(0, 20_000) };
  } catch {
    return null;
  }
}

function checkResult(finalUrl: string, body: string): string | null {
  const byHost = matchHost(new URL(finalUrl).hostname);
  if (byHost) return byHost;
  const lowerBody = body.toLowerCase();
  if (BODY_MARKERS.some((marker) => lowerBody.includes(marker))) {
    return "Unbranded Parking Page";
  }
  return null;
}

/**
 * Returns the parking service name if `domain` redirects to (or otherwise
 * renders as) a known domain-parking/marketplace page, else null. A quick
 * fetch-and-follow-redirects check (with one manual hop for a client-side
 * JS/meta-refresh redirect) — not a full browser render like screenshot
 * capture, so it stays cheap enough to run inline during a scan for every
 * web-active result.
 */
export async function detectParking(domain: string): Promise<string | null> {
  for (const scheme of ["https", "http"]) {
    const first = await fetchOnce(`${scheme}://${domain}/`);
    if (!first) continue;

    const direct = checkResult(first.finalUrl, first.body);
    if (direct) return direct;

    const jsTarget = findJsRedirectTarget(first.body);
    if (jsTarget) {
      const resolvedUrl = new URL(jsTarget, first.finalUrl).toString();
      const second = await fetchOnce(resolvedUrl);
      if (second) {
        const viaJs = checkResult(second.finalUrl, second.body);
        if (viaJs) return viaJs;
      }
    }

    return null;
  }
  return null;
}
