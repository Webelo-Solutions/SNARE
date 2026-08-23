import { getDb } from "@/lib/server/db";
import { subscribeScan, getLastProgress, isScanChannelDone, pruneChannel } from "@/lib/server/events";
import type { ScanEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sseLine(event: ScanEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scanId = Number((await params).id);
  const db = getDb();
  const encoder = new TextEncoder();

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ScanEvent) => {
        try {
          controller.enqueue(encoder.encode(sseLine(event)));
        } catch {
          // controller already closed
        }
      };

      // Replay already-persisted results so a browser refresh mid-scan (or a
      // client connecting after the scan finished) doesn't lose rows.
      for (const result of db.getResultsForScan(scanId)) {
        send({ type: "result", result });
      }
      const lastProgress = getLastProgress(scanId);
      if (lastProgress) send(lastProgress);

      if (isScanChannelDone(scanId)) {
        const scan = db.getScan(scanId);
        send({
          type: "done",
          totalFound: scan?.totalFound ?? 0,
          newFound: scan?.newFound ?? 0,
        });
        controller.close();
        return;
      }

      unsubscribe = subscribeScan(scanId, (event) => {
        send(event);
        if (event.type === "done" || event.type === "error") {
          controller.close();
        }
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // controller already closed
        }
      }, 15_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
      pruneChannel(scanId);
    },
  });

  request.signal.addEventListener("abort", () => {
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
    pruneChannel(scanId);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
