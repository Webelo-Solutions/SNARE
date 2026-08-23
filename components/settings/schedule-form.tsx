"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CommittedInput } from "@/components/ui/committed-input";
import { useConfig, useSaveConfig } from "@/hooks/use-config";
import { formatDistanceToNow } from "date-fns";

export function ScheduleForm() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();

  if (!config) return null;
  const { schedule } = config;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Scheduled Scans</CardTitle>
        <p className="text-xs text-text-dim">
          Automatically re-scan all targets on a recurring interval, even with no browser open.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-4">
          <div className="text-sm">Enable scheduled scans</div>
          <Switch
            checked={schedule.enabled}
            onCheckedChange={(v) =>
              saveConfig.mutate({ ...config, schedule: { ...schedule, enabled: v } })
            }
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <Label>Interval (hours)</Label>
          <CommittedInput
            type="number"
            min={1}
            value={String(schedule.intervalHours)}
            onCommit={(v) =>
              saveConfig.mutate({
                ...config,
                schedule: { ...schedule, intervalHours: Number(v) || 24 },
              })
            }
            className="w-24"
          />
        </div>

        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm">Capture screenshots</div>
            <div className="text-xs text-text-dim">Screenshot web-active domains after each scan</div>
          </div>
          <Switch
            checked={schedule.screenshotsEnabled}
            onCheckedChange={(v) =>
              saveConfig.mutate({ ...config, schedule: { ...schedule, screenshotsEnabled: v } })
            }
          />
        </label>

        {schedule.lastRunAt && (
          <p className="text-xs text-text-dim">
            Last scheduled run: {formatDistanceToNow(new Date(schedule.lastRunAt), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
