"use client";

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CommittedInput } from "@/components/ui/committed-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfig, useSaveConfig } from "@/hooks/use-config";
import type { Config } from "@/lib/types";

const SOURCE_LABELS: Array<{ key: keyof Config["sources"]; label: string; hint: string }> = [
  { key: "ctLogs", label: "Certificate Transparency Logs", hint: "Search crt.sh for issued certificates" },
  { key: "dnsPermutation", label: "DNS Permutation Scanning", hint: "Generate and resolve typosquat variants" },
  { key: "whoisNrd", label: "WHOIS / RDAP Enrichment", hint: "Registrar, creation date, abuse contact" },
  { key: "passiveDns", label: "Passive DNS", hint: "SecurityTrails / VirusTotal (requires API keys)" },
];

export function SourceTogglesForm() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();

  if (!config) return null;

  function updateSource(key: keyof Config["sources"], value: boolean) {
    if (!config) return;
    saveConfig.mutate({ ...config, sources: { ...config.sources, [key]: value } });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Scan Sources</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {SOURCE_LABELS.map(({ key, label, hint }) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm">{label}</div>
                <div className="text-xs text-text-dim">{hint}</div>
              </div>
              <Switch
                checked={config.sources[key]}
                onCheckedChange={(v) => updateSource(key, v)}
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detection Thresholds</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Newly-registered domain window</Label>
              <div className="text-xs text-text-dim">Days since registration to flag as new</div>
            </div>
            <CommittedInput
              type="number"
              min={1}
              value={String(config.nrdDays)}
              onCommit={(v) => saveConfig.mutate({ ...config, nrdDays: Number(v) || 30 })}
              className="w-24"
            />
          </div>

          <label className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm">Show unresolved domains</div>
              <div className="text-xs text-text-dim">
                Surface permutations with no DNS record at all
              </div>
            </div>
            <Switch
              checked={config.showUnresolved}
              onCheckedChange={(v) => saveConfig.mutate({ ...config, showUnresolved: v })}
            />
          </label>

          <label className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm">Include available domains</div>
              <div className="text-xs text-text-dim">
                Surface unregistered variants worth defensive registration
              </div>
            </div>
            <Switch
              checked={config.includeAvailable}
              onCheckedChange={(v) => saveConfig.mutate({ ...config, includeAvailable: v })}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferred Registrar</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={config.preferredRegistrar}
            onValueChange={(v) =>
              saveConfig.mutate({ ...config, preferredRegistrar: v as Config["preferredRegistrar"] })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="namecheap">Namecheap</SelectItem>
              <SelectItem value="godaddy">GoDaddy</SelectItem>
              <SelectItem value="porkbun">Porkbun</SelectItem>
              <SelectItem value="dynadot">Dynadot</SelectItem>
              <SelectItem value="hover">Hover</SelectItem>
              <SelectItem value="squarespace">Squarespace Domains</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
