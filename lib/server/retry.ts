import "server-only";

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  /** External cancellation (e.g. the scan was stopped) — combined with the
   * per-attempt timeout so either one aborts the in-flight request. */
  signal?: AbortSignal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch() with retry + exponential backoff — built specifically because
 * crt.sh has been observed returning transient 502s during real scans, with
 * the original implementation treating that identically to "no results" and
 * silently moving on. Retries on network errors, 429, and 5xx; a genuine
 * 4xx (bad request, not found) fails fast since retrying won't help.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { attempts = 3, baseDelayMs = 500, timeoutMs = 15_000, signal }: RetryOptions = {}
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
      const resp = await fetch(url, { ...init, signal: combined });
      if (resp.ok || (resp.status >= 400 && resp.status < 500 && resp.status !== 429)) {
        return resp;
      }
      lastError = new Error(`HTTP ${resp.status}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt < attempts && !signal?.aborted) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
