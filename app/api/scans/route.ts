import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { loadConfig } from "@/lib/server/config";
import { startScan, isScanRunning } from "@/lib/server/scanEngine";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const db = getDb();
  return NextResponse.json(db.getScanHistory(limit));
}

export async function POST(request: NextRequest) {
  if (isScanRunning()) {
    return NextResponse.json({ error: "A scan is already running" }, { status: 409 });
  }

  const config = loadConfig();
  let targets = config.targets;
  try {
    const body = await request.json();
    if (Array.isArray(body?.targets) && body.targets.length > 0) {
      targets = body.targets;
    }
  } catch {
    // no body / not JSON — fall back to configured targets
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: "No targets configured" }, { status: 400 });
  }

  try {
    const scanId = startScan(targets, config, config.patterns);
    return NextResponse.json({ scanId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to start scan" },
      { status: 409 }
    );
  }
}
