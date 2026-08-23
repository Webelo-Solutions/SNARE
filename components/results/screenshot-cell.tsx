"use client";

import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRequestScreenshot } from "@/hooks/use-screenshot";
import { screenshotUrl } from "@/lib/screenshotUrl";
import type { DomainResult } from "@/lib/types";

export function ScreenshotCell({
  result,
  onCaptured,
}: {
  result: DomainResult;
  onCaptured?: (domain: string, path: string) => void;
}) {
  const requestScreenshot = useRequestScreenshot();

  if (result.screenshotPath) {
    return (
      <a href={screenshotUrl(result.screenshotPath)} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- local screenshot files, not a Next Image-optimizable asset */}
        <img
          src={screenshotUrl(result.screenshotPath)}
          alt={`Screenshot of ${result.domain}`}
          className="h-9 w-14 rounded border border-border object-cover"
        />
      </a>
    );
  }

  if (!result.hasWeb) {
    return <span className="text-text-dim">—</span>;
  }

  return (
    <button
      className="flex items-center gap-1 text-xs text-text-dim hover:text-primary disabled:opacity-50"
      disabled={requestScreenshot.isPending}
      onClick={() =>
        requestScreenshot.mutate(
          { domain: result.domain, target: result.target },
          {
            onSuccess: ({ screenshotPath }) => onCaptured?.(result.domain, screenshotPath),
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Screenshot capture failed"),
          }
        )
      }
    >
      {requestScreenshot.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Camera className="size-3.5" />
      )}
      Capture
    </button>
  );
}
