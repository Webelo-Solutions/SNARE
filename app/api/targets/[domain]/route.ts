import { NextResponse } from "next/server";
import { loadConfig, updateConfig } from "@/lib/server/config";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  const domain = decodeURIComponent((await params).domain);
  const config = loadConfig();
  const targets = config.targets.filter((t) => t !== domain);
  const saved = updateConfig({ targets });
  return NextResponse.json({ targets: saved.targets });
}
