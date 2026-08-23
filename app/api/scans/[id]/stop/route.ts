import { NextResponse } from "next/server";
import { stopScan } from "@/lib/server/scanEngine";

export async function POST() {
  const stopped = stopScan();
  return NextResponse.json({ stopped });
}
