import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const scanId = Number((await params).id);
  const db = getDb();
  const scan = db.getScan(scanId);
  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  const results = db.getResultsForScan(scanId);
  return NextResponse.json({ scan, results });
}
