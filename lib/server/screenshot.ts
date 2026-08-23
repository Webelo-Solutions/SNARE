import "server-only";
import path from "node:path";
import { SCREENSHOT_DIR, ensureDataDirs } from "./paths";

export interface CaptureResult {
  path: string | null;
  error: string | null;
}

function safeFilename(domain: string): string {
  return domain.replaceAll(".", "_").replaceAll("*", "star") + ".png";
}

/**
 * Navigate to the domain and save a PNG screenshot. Tries HTTPS first, falls
 * back to HTTP. Playwright's Node API needs no equivalent of the Python
 * version's Windows ProactorEventLoop workaround — that was purely a
 * Python-asyncio quirk.
 */
export async function capture(domain: string, timeoutMs = 12_000): Promise<CaptureResult> {
  ensureDataDirs();
  const filePath = path.join(SCREENSHOT_DIR, safeFilename(domain));

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return { path: null, error: "Playwright not installed. Run: npm install playwright" };
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    return {
      path: null,
      error: `Could not launch Chromium — run: npx playwright install chromium\n(${err instanceof Error ? err.message : err})`,
    };
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      ignoreHTTPSErrors: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    for (const scheme of ["https", "http"]) {
      try {
        await page.goto(`${scheme}://${domain}`, { timeout: timeoutMs, waitUntil: "domcontentloaded" });
        await page.screenshot({ path: filePath, fullPage: false });
        return { path: filePath, error: null };
      } catch {
        continue;
      }
    }
    return { path: null, error: `No response from ${domain} (HTTPS and HTTP both timed out)` };
  } catch (err) {
    return { path: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}

export interface DomainTargetPair {
  domain: string;
  target: string;
}

/** Capture screenshots for a list of (domain, target) pairs sequentially. */
export async function captureBatch(
  pairs: DomainTargetPair[],
  onCaptured: (domain: string, target: string, path: string) => void,
  onError?: (domain: string, error: string) => void
): Promise<void> {
  for (const { domain, target } of pairs) {
    const { path: capturedPath, error } = await capture(domain);
    if (capturedPath) onCaptured(domain, target, capturedPath);
    else if (error) onError?.(domain, error);
  }
}
