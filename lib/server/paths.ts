import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Windows-idiomatic replacement for the desktop app's ~/.snare/ directory.
// SNARE_DATA_DIR overrides this explicitly — needed when running as a
// Windows service, since services run under Local System by default, whose
// %APPDATA% resolves to a different profile than the interactive user's.
const DATA_DIR =
  process.env.SNARE_DATA_DIR ||
  (process.platform === "win32"
    ? path.join(process.env.APPDATA ?? os.homedir(), "snare")
    : path.join(os.homedir(), ".snare"));

export const CONFIG_PATH = path.join(DATA_DIR, "config.json");
export const DB_PATH = path.join(DATA_DIR, "snare.db");
export const SCREENSHOT_DIR = path.join(DATA_DIR, "screenshots");

export function ensureDataDirs(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
