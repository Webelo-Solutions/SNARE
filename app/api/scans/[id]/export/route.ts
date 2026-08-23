import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";

const HEADERS = [
  "Domain",
  "Target",
  "Source",
  "Technique",
  "Score",
  "Registrar",
  "IPs",
  "MX Records",
  "Has Web",
  "First Seen",
  "Abuse Contact",
  "Is Available",
  "Parked Service",
  "VT Malicious",
  "VT Suspicious",
  "urlscan Scanned",
  "urlscan Verdict",
  "urlscan URL",
  "CT Log Index",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

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

  const rows = [HEADERS.join(",")];
  for (const r of results) {
    rows.push(
      [
        r.domain,
        r.target,
        r.source,
        r.technique,
        String(r.score),
        r.registrar ?? "",
        r.ips.join("; "),
        r.mxRecords.join("; "),
        r.hasWeb ? "Yes" : "No",
        r.firstSeen ?? "",
        r.abuseContact,
        r.isAvailable ? "Yes" : "No",
        r.parkedService ?? "",
        r.vtMaliciousCount === null ? "" : String(r.vtMaliciousCount),
        r.vtSuspiciousCount === null ? "" : String(r.vtSuspiciousCount),
        r.urlscanScanned ? "Yes" : "No",
        r.urlscanMalicious === null ? "" : r.urlscanMalicious ? "Malicious" : "Clean",
        r.urlscanUrl ?? "",
        r.ctLogIndex ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="snare-scan-${scanId}.csv"`,
    },
  });
}
