import { NextRequest, NextResponse } from "next/server";
import { loadConfig, saveConfig } from "@/lib/server/config";

export async function GET() {
  return NextResponse.json(loadConfig());
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  try {
    const saved = saveConfig(body);
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid config" },
      { status: 400 }
    );
  }
}
