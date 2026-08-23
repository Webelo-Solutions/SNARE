import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { capture } from "@/lib/server/screenshot";

export async function POST(request: NextRequest) {
  const { domain, target } = await request.json();
  if (typeof domain !== "string" || typeof target !== "string") {
    return NextResponse.json({ error: "domain and target are required" }, { status: 400 });
  }

  const { path, error } = await capture(domain);
  if (!path) {
    return NextResponse.json({ error: error ?? "Screenshot capture failed" }, { status: 502 });
  }

  getDb().updateScreenshot(domain, target, path);
  return NextResponse.json({ screenshotPath: path });
}
