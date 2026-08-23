import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SCREENSHOT_DIR } from "@/lib/server/paths";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const filename = path.basename((await params).filename);
  if (!filename.endsWith(".png")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(path.join(SCREENSHOT_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
