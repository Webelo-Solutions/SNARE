import { NextResponse } from "next/server";
import { REGISTRAR_KEYS, displayName } from "@/lib/server/registrar";

export async function GET() {
  return NextResponse.json(REGISTRAR_KEYS.map((key) => ({ key, name: displayName(key) })));
}
