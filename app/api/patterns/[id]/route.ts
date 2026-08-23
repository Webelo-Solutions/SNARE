import { NextRequest, NextResponse } from "next/server";
import { loadConfig, updateConfig } from "@/lib/server/config";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const body = await request.json();
  const config = loadConfig();
  let updated = null;
  const patterns = config.patterns.map((p) => {
    if (p.id !== id) return p;
    updated = { ...p, ...body, id: p.id };
    return updated;
  });
  if (!updated) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
  }
  updateConfig({ patterns });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const config = loadConfig();
  const patterns = config.patterns.filter((p) => p.id !== id);
  updateConfig({ patterns });
  return NextResponse.json({ ok: true });
}
