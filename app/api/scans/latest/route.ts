import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET() {
  const db = getDb();
  const scan = db.getLatestCompletedScan();
  if (!scan) return NextResponse.json(null);
  const results = db.getResultsForScan(scan.id);
  return NextResponse.json({ scan, results });
}
