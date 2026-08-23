"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/score-badge";
import { ScreenshotCell } from "./screenshot-cell";
import { TakedownNoticeModal } from "@/components/dialogs/takedown-notice-modal";
import { RegisterDomainButton } from "@/components/dialogs/register-domain-button";
import type { DomainResult } from "@/lib/types";

const columnHelper = createColumnHelper<DomainResult>();

export const columns = [
  columnHelper.accessor("domain", {
    header: "Domain",
    cell: (info) => (
      <div className="flex items-center gap-1.5 font-mono text-[13px]">
        <span>{info.getValue()}</span>
        {info.row.original.isNew && (
          <Badge className="bg-primary/15 text-primary border-primary/40 text-[10px] px-1.5 py-0">
            NEW
          </Badge>
        )}
        {info.row.original.isAvailable && (
          <Badge className="bg-risk-green/15 text-risk-green border-risk-green/40 text-[10px] px-1.5 py-0">
            AVAILABLE
          </Badge>
        )}
        {info.row.original.isCustomStubMatch && (
          <Badge
            className="bg-risk-high/15 text-risk-high border-risk-high/40 text-[10px] px-1.5 py-0"
            title="Matches a custom stub keyword — always alerts regardless of score"
          >
            WATCHED
          </Badge>
        )}
        {info.row.original.parkedService && (
          <Badge
            className="bg-surface2 text-text-dim border-border text-[10px] px-1.5 py-0"
            title={`Redirects to a domain-parking/marketplace page (${info.row.original.parkedService}) — likely not live phishing infrastructure yet`}
          >
            PARKED · {info.row.original.parkedService}
          </Badge>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("target", {
    header: "Target",
    cell: (info) => <span className="text-text-dim text-[13px]">{info.getValue()}</span>,
  }),
  columnHelper.accessor("source", {
    header: "Source",
    cell: (info) => <span className="text-[13px] text-text-dim">{info.getValue()}</span>,
  }),
  columnHelper.accessor("technique", {
    header: "Technique",
    cell: (info) => {
      const value = info.getValue();
      if (!value) return <span className="text-text-dim">—</span>;
      const highSignal = value === "Cyrillic Homoglyph" || value === "Subdomain of Attacker Domain";
      return (
        <span className={`text-[13px] ${highSignal ? "text-risk-critical font-medium" : ""}`}>
          {value}
        </span>
      );
    },
  }),
  columnHelper.accessor("score", {
    header: "Score",
    cell: (info) => <ScoreBadge score={info.getValue()} />,
    sortDescFirst: true,
  }),
  columnHelper.accessor("registrar", {
    header: "Registrar",
    cell: (info) => <span className="text-[13px]">{info.getValue() ?? "—"}</span>,
  }),
  columnHelper.accessor("ips", {
    header: "IPs",
    cell: (info) => {
      const ips = info.getValue();
      if (ips.length === 0) return <span className="text-text-dim">—</span>;
      return (
        <div className="flex flex-col text-[13px] font-mono leading-tight">
          {ips.map((ip) => (
            <span key={ip}>{ip}</span>
          ))}
        </div>
      );
    },
  }),
  columnHelper.accessor("mxRecords", {
    header: "MX",
    cell: (info) => (info.getValue().length > 0 ? "Yes" : "No"),
  }),
  columnHelper.accessor("hasWeb", {
    header: "Web",
    cell: (info) => (info.getValue() ? "Yes" : "No"),
  }),
  columnHelper.accessor("firstSeen", {
    header: "Age",
    cell: (info) => {
      const v = info.getValue();
      return (
        <span className="text-[13px] text-text-dim">
          {v ? formatDistanceToNow(new Date(v), { addSuffix: true }) : "—"}
        </span>
      );
    },
  }),
  columnHelper.accessor("abuseContact", {
    header: "Abuse Contact",
    cell: (info) => <span className="text-[13px]">{info.getValue() || "—"}</span>,
  }),
  columnHelper.display({
    id: "screenshot",
    header: "Screenshot",
    cell: (info) => (
      <ScreenshotCell
        result={info.row.original}
        onCaptured={info.table.options.meta?.onScreenshotCaptured}
      />
    ),
  }),
  columnHelper.display({
    id: "actions",
    header: "Actions",
    cell: (info) => {
      const result = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <TakedownNoticeModal result={result} />
          {result.isAvailable && <RegisterDomainButton domain={result.domain} />}
        </div>
      );
    },
  }),
];
