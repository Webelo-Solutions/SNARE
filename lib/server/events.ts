import "server-only";
import { EventEmitter } from "node:events";
import type { ScanEvent, ScanProgressEvent } from "@/lib/types";

interface ScanChannel {
  emitter: EventEmitter;
  lastProgress: ScanProgressEvent | null;
  done: boolean;
}

declare global {
  var __snareScanChannels: Map<number, ScanChannel> | undefined;
}

function channels(): Map<number, ScanChannel> {
  if (!globalThis.__snareScanChannels) {
    globalThis.__snareScanChannels = new Map();
  }
  return globalThis.__snareScanChannels;
}

function getOrCreateChannel(scanId: number): ScanChannel {
  let ch = channels().get(scanId);
  if (!ch) {
    ch = { emitter: new EventEmitter(), lastProgress: null, done: false };
    ch.emitter.setMaxListeners(50);
    channels().set(scanId, ch);
  }
  return ch;
}

export function emitScanEvent(scanId: number, event: ScanEvent): void {
  const ch = getOrCreateChannel(scanId);
  if (event.type === "progress") ch.lastProgress = event;
  if (event.type === "done" || event.type === "error") ch.done = true;
  ch.emitter.emit("event", event);
}

export function getLastProgress(scanId: number): ScanProgressEvent | null {
  return channels().get(scanId)?.lastProgress ?? null;
}

export function isScanChannelDone(scanId: number): boolean {
  return channels().get(scanId)?.done ?? true;
}

export function subscribeScan(
  scanId: number,
  onEvent: (event: ScanEvent) => void
): () => void {
  const ch = getOrCreateChannel(scanId);
  ch.emitter.on("event", onEvent);
  return () => ch.emitter.off("event", onEvent);
}

// Periodically drop channels for scans nobody will query again, so the map
// doesn't grow unbounded across a long-running process. Called opportunistically.
export function pruneChannel(scanId: number): void {
  const ch = channels().get(scanId);
  if (ch && ch.done && ch.emitter.listenerCount("event") === 0) {
    channels().delete(scanId);
  }
}
