import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { loadConfig } from "@/lib/server/config";
import { classifyPermutation } from "@/lib/server/classifyPermutation";

/**
 * One-off maintenance endpoint: recompute `technique` for every existing
 * result, for databases with rows saved before the classifier existed.
 * Safe to call repeatedly (idempotent — recomputes unconditionally).
 */
export async function POST() {
  const config = loadConfig();
  const db = getDb();
  const updated = db.backfillTechniques((domain, target) =>
    classifyPermutation(domain, target, config.customStubs)
  );
  return NextResponse.json({ updated });
}
