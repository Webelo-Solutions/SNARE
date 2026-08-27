import { NextRequest, NextResponse } from "next/server";
import { loadConfig } from "@/lib/server/config";
import { splitNotice } from "@/lib/server/takedown";
import { buildTransport } from "@/lib/server/alerting";
import { getDb } from "@/lib/server/db";

export async function POST(request: NextRequest) {
  const { resultId, to, notice } = (await request.json()) as {
    resultId?: number;
    to?: string;
    notice?: string;
  };

  if (!to || !notice) {
    return NextResponse.json({ error: "A recipient (to) and notice text are required" }, { status: 400 });
  }

  const config = loadConfig();
  if (!config.alerts.smtpHost) {
    return NextResponse.json(
      { error: "Configure SMTP settings in Settings before sending takedown notices." },
      { status: 400 }
    );
  }

  const { subject, body } = splitNotice(notice);

  try {
    const transport = buildTransport(config.alerts);
    await transport.sendMail({
      from: config.alerts.smtpUser || "snare@localhost",
      to,
      replyTo: config.sender.email || undefined,
      subject,
      text: body,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 502 }
    );
  }

  const sentAt = new Date().toISOString();
  if (typeof resultId === "number") {
    getDb().markTakedownSent(resultId, sentAt);
  }

  return NextResponse.json({ sentAt });
}
