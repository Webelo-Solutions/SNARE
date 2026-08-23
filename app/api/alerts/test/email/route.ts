import { NextResponse } from "next/server";
import { loadConfig } from "@/lib/server/config";
import { testEmail } from "@/lib/server/alerting";

export async function POST() {
  const config = loadConfig();
  const error = await testEmail(config.alerts);
  return NextResponse.json({ ok: !error, error: error ?? undefined });
}
