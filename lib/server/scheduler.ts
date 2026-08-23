import "server-only";
import { loadConfig } from "./config";
import { startScan, isScanRunning } from "./scanEngine";

const CHECK_INTERVAL_MS = 60_000;

/** Mirrors the desktop app's 60s QTimer that checks whether a scheduled scan is due. */
function checkAndRunSchedule(): void {
  const config = loadConfig();
  if (!config.schedule.enabled) return;
  if (isScanRunning()) return;
  if (config.targets.length === 0) return;

  if (config.schedule.lastRunAt) {
    const lastRun = new Date(config.schedule.lastRunAt).getTime();
    const nextDue = lastRun + config.schedule.intervalHours * 3_600_000;
    if (Date.now() < nextDue) return;
  }

  try {
    startScan(config.targets, config, config.patterns);
  } catch {
    // Another scan raced in between the isScanRunning() check and here —
    // harmless, the next 60s tick will retry if still due.
  }
}

declare global {
  var __snareSchedulerStarted: boolean | undefined;
}

export function startScheduleLoop(): void {
  if (globalThis.__snareSchedulerStarted) return;
  globalThis.__snareSchedulerStarted = true;
  setInterval(checkAndRunSchedule, CHECK_INTERVAL_MS);
}
