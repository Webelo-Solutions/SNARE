"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { columns } from "./columns";
import type { DomainResult } from "@/lib/types";

export function ResultsTable({ results }: { results: DomainResult[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  // Screenshots (and, later, takedown state) are captured via row actions
  // that mutate the server directly — this overlay lets those actions
  // reflect immediately in the table without the parent's SSE-driven
  // `results` array knowing about them.
  const [screenshotOverrides, setScreenshotOverrides] = useState<Record<string, string>>({});

  const data = useMemo(
    () =>
      results.map((r) =>
        screenshotOverrides[r.domain] ? { ...r, screenshotPath: screenshotOverrides[r.domain] } : r
      ),
    [results, screenshotOverrides]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.domain,
    meta: {
      onScreenshotCaptured: (domain: string, path: string) =>
        setScreenshotOverrides((prev) => ({ ...prev, [domain]: path })),
    },
  });

  if (results.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-dim text-sm">
        No results yet — start a scan to begin monitoring.
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-surface2">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDir = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="cursor-pointer select-none whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortDir === "asc" && <ArrowUp className="size-3" />}
                      {sortDir === "desc" && <ArrowDown className="size-3" />}
                      {!sortDir && <ArrowUpDown className="size-3 opacity-30" />}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
