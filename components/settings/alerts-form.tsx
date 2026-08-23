"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommittedInput } from "@/components/ui/committed-input";
import { useConfig, useSaveConfig } from "@/hooks/use-config";
import { api } from "@/lib/client/api";
import type { AlertConfig } from "@/lib/types";

function TestButton({ channel }: { channel: "email" | "slack" | "teams" }) {
  const [pending, setPending] = useState(false);

  async function handleTest() {
    setPending(true);
    try {
      const result = await api.testAlert(channel);
      if (result.ok) toast.success(`Test ${channel} notification sent.`);
      else toast.error(result.error ?? `Failed to send test ${channel} notification.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test send failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleTest} disabled={pending}>
      Send Test
    </Button>
  );
}

export function AlertsForm() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();

  if (!config) return null;
  const { alerts } = config;

  function update(patch: Partial<AlertConfig>) {
    if (!config) return;
    saveConfig.mutate({ ...config, alerts: { ...alerts, ...patch } });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Alert Notifications</CardTitle>
        <p className="text-xs text-text-dim">
          Notify on newly-discovered domains meeting a minimum risk score, after each scan.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <label className="flex items-center justify-between gap-4">
          <div className="text-sm">Enable alerts</div>
          <Switch checked={alerts.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </label>

        <div className="flex items-center justify-between gap-4">
          <Label>Minimum score to alert</Label>
          <CommittedInput
            type="number"
            min={0}
            max={100}
            value={String(alerts.minScore)}
            onCommit={(v) => update({ minScore: Math.min(100, Math.max(0, Number(v) || 0)) })}
            className="w-24"
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Email (SMTP)</span>
            <TestButton channel="email" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>To</Label>
              <CommittedInput value={alerts.emailTo} onCommit={(v) => update({ emailTo: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>SMTP Host</Label>
              <CommittedInput value={alerts.smtpHost} onCommit={(v) => update({ smtpHost: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>SMTP Port</Label>
              <CommittedInput
                type="number"
                value={String(alerts.smtpPort)}
                onCommit={(v) => update({ smtpPort: Number(v) || 587 })}
              />
            </div>
            <label className="flex items-end gap-2 pb-1.5">
              <Switch checked={alerts.smtpTls} onCheckedChange={(v) => update({ smtpTls: v })} />
              <span className="text-sm">Use TLS</span>
            </label>
            <div className="flex flex-col gap-1.5">
              <Label>SMTP User</Label>
              <CommittedInput value={alerts.smtpUser} onCommit={(v) => update({ smtpUser: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>SMTP Password</Label>
              <CommittedInput
                type="password"
                value={alerts.smtpPass}
                onCommit={(v) => update({ smtpPass: v })}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Slack Webhook</span>
            <TestButton channel="slack" />
          </div>
          <CommittedInput
            placeholder="https://hooks.slack.com/services/…"
            value={alerts.slackWebhook}
            onCommit={(v) => update({ slackWebhook: v })}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Microsoft Teams Webhook</span>
            <TestButton channel="teams" />
          </div>
          <CommittedInput
            placeholder="https://outlook.office.com/webhook/…"
            value={alerts.teamsWebhook}
            onCommit={(v) => update({ teamsWebhook: v })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
