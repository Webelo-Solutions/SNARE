import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json(getDb().getAggregateStats());
}
