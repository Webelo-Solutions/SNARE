// Client-safe path splitting (no node:path) — the server stores an absolute
// filesystem path; the client only ever needs the basename to build the URL.
export function screenshotUrl(screenshotPath: string): string {
  const filename = screenshotPath.split(/[\\/]/).pop();
  return `/api/screenshots/${filename}`;
}
