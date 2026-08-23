"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CommittedInput } from "@/components/ui/committed-input";
import { useConfig, useSaveConfig } from "@/hooks/use-config";

export function ApiKeysForm() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Passive DNS API Keys</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>SecurityTrails API Key</Label>
          <CommittedInput
            type="password"
            value={config.apiKeys.securitytrails}
            onCommit={(v) =>
              saveConfig.mutate({ ...config, apiKeys: { ...config.apiKeys, securitytrails: v } })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>VirusTotal API Key</Label>
          <CommittedInput
            type="password"
            value={config.apiKeys.virustotal}
            onCommit={(v) =>
              saveConfig.mutate({ ...config, apiKeys: { ...config.apiKeys, virustotal: v } })
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
