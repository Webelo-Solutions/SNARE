import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import type { ResultStatus } from "@/lib/types";

const VALID_STATUSES: ResultStatus[] = ["open", "reviewed", "ignored", "false_positive"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid result id" }, { status: 400 });
  }

  const { status } = (await request.json()) as { status?: string };
  if (!status || !VALID_STATUSES.includes(status as ResultStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = getDb().updateResultStatus(id, status as ResultStatus);
  if (!updated) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
