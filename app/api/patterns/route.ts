import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { loadConfig, updateConfig } from "@/lib/server/config";
import type { Pattern } from "@/lib/types";

export async function GET() {
  return NextResponse.json(loadConfig().patterns);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const pattern: Pattern = {
    id: randomUUID(),
    name: body.name ?? "",
    type: body.type,
    value: body.value ?? "",
    mode: body.mode,
    enabled: body.enabled ?? true,
  };
  const config = loadConfig();
  const patterns = [...config.patterns, pattern];
  updateConfig({ patterns });
  return NextResponse.json(pattern);
}
