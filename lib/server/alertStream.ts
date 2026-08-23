import "server-only";
import { EventEmitter } from "node:events";
import type { AppAlertEvent } from "@/lib/types";

// Global (not scoped to a scanId) pub-sub for alert-worthy results, so any
// open SNARE tab can show an in-app toast regardless of which scan it's
// currently viewing. Ephemeral by design — there's no replay-on-connect
// like the per-scan SSE channel, since a missed live ping is still fully
// recoverable from scan history; this is just the "someone's watching
// right now" notification path.
declare global {
  var __snareAlertEmitter: EventEmitter | undefined;
}

function emitter(): EventEmitter {
  if (!globalThis.__snareAlertEmitter) {
    globalThis.__snareAlertEmitter = new EventEmitter();
    globalThis.__snareAlertEmitter.setMaxListeners(50);
  }
  return globalThis.__snareAlertEmitter;
}

export function emitAppAlert(event: AppAlertEvent): void {
  emitter().emit("alert", event);
}

export function subscribeAppAlerts(onEvent: (event: AppAlertEvent) => void): () => void {
  const em = emitter();
  em.on("alert", onEvent);
  return () => em.off("alert", onEvent);
}
