import { NextRequest, NextResponse } from "next/server";
import { registrationUrl, REGISTRAR_KEYS } from "@/lib/server/registrar";
import type { RegistrarKey } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const key = (await params).key as RegistrarKey;
  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain query param is required" }, { status: 400 });
  }
  if (!REGISTRAR_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown registrar" }, { status: 404 });
  }
  return NextResponse.json({ url: registrationUrl(domain, key) });
}
