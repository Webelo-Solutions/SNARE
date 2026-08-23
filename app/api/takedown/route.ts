import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "@/lib/server/config";
import { generateNotice, getAbuseContact } from "@/lib/server/takedown";
import type { DomainResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  const result = (await request.json()) as DomainResult;
  if (!result?.domain) {
    return NextResponse.json({ error: "A domain result is required" }, { status: 400 });
  }

  const config = loadConfig();
  const [notice, abuseContact] = await Promise.all([
    Promise.resolve(generateNotice(result, config.sender)),
    getAbuseContact(result.domain),
  ]);

  return NextResponse.json({ notice, abuseContact });
}
