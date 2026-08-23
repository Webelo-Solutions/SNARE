import { NextRequest, NextResponse } from "next/server";
import { loadConfig, updateConfig } from "@/lib/server/config";

export async function GET() {
  return NextResponse.json(loadConfig().targets);
}

export async function POST(request: NextRequest) {
  const { domain } = await request.json();
  if (typeof domain !== "string" || !domain.trim()) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }
  const normalized = domain.trim().toLowerCase();
  const config = loadConfig();
  if (!config.targets.includes(normalized)) {
    config.targets.push(normalized);
  }
  const saved = updateConfig({ targets: config.targets });
  return NextResponse.json({ targets: saved.targets });
}
