"use client";

import Link from "next/link";
import { ArrowLeft, Globe, ShieldAlert, ShoppingBag, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RiskTierBars } from "@/components/dashboard/risk-tier-bars";
import { TechniqueBars } from "@/components/dashboard/technique-bars";
import { useStats } from "@/hooks/use-stats";

function criticalCount(stats: { byRiskTier: Array<{ tier: string; count: number }> }): number {
  return stats.byRiskTier.find((r) => r.tier === "Critical")?.count ?? 0;
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useStats();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">Dashboard</h1>
      </div>

      {isLoading || !stats ? (
        <p className="text-sm text-text-dim">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <StatTile label="Domains tracked" value={stats.totalDomains} icon={Globe} />
            <StatTile
              label="Critical risk"
              value={criticalCount(stats)}
              icon={ShieldAlert}
              tone="critical"
            />
            <StatTile
              label="Available to register"
              value={stats.availableCount}
              icon={CircleCheck}
              tone="good"
            />
            <StatTile label="Parked / for sale" value={stats.parkedCount} icon={ShoppingBag} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">New domains discovered — last 30 days</CardTitle>
            </CardHeader>
            <CardContent>
              <TrendChart newPerDay={stats.newPerDay} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By risk tier</CardTitle>
              </CardHeader>
              <CardContent>
                <RiskTierBars byRiskTier={stats.byRiskTier} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By technique</CardTitle>
              </CardHeader>
              <CardContent>
                <TechniqueBars byTechnique={stats.byTechnique} />
              </CardContent>
            </Card>
          </div>

          {stats.byTarget.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">By target</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  {stats.byTarget.map((t) => (
                    <div key={t.target} className="flex items-center justify-between text-sm">
                      <span className="font-mono">{t.target}</span>
                      <span className="tabular-nums text-text-dim">{t.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-text-dim">
            {stats.totalScans} scan{stats.totalScans !== 1 ? "s" : ""} run
            {stats.lastScanAt ? ` · last completed ${new Date(stats.lastScanAt).toLocaleString()}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
