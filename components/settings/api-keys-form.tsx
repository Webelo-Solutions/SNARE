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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Passive DNS</CardTitle>
          <p className="text-xs text-text-dim">Finds domains structurally related to a target.</p>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reputation Enrichment</CardTitle>
          <p className="text-xs text-text-dim">
            Checks each discovered domain against third-party threat intel — independent
            corroboration that doesn&apos;t depend on our own structural scoring or on crt.sh
            being up.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>VirusTotal API Key</Label>
            <p className="text-xs text-text-dim">Required — every VT endpoint needs a key.</p>
            <CommittedInput
              type="password"
              value={config.apiKeys.virustotal}
              onCommit={(v) =>
                saveConfig.mutate({ ...config, apiKeys: { ...config.apiKeys, virustotal: v } })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>urlscan.io API Key (optional)</Label>
            <p className="text-xs text-text-dim">
              Works without a key (checks whether urlscan has scanned the domain at all);
              a key also unlocks its malicious/clean verdict and raises rate limits.
            </p>
            <CommittedInput
              type="password"
              value={config.apiKeys.urlscan}
              onCommit={(v) =>
                saveConfig.mutate({ ...config, apiKeys: { ...config.apiKeys, urlscan: v } })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
