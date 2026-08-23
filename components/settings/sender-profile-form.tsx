"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CommittedInput } from "@/components/ui/committed-input";
import { useConfig, useSaveConfig } from "@/hooks/use-config";
import type { SenderProfile } from "@/lib/types";

const FIELDS: Array<{ key: keyof SenderProfile; label: string }> = [
  { key: "name", label: "Full Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
];

export function SenderProfileForm() {
  const { data: config } = useConfig();
  const saveConfig = useSaveConfig();

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Complainant Profile</CardTitle>
        <p className="text-xs text-text-dim">
          Used to populate takedown notices sent to registrar abuse teams.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <Label>{label}</Label>
            <CommittedInput
              value={config.sender[key]}
              onCommit={(v) =>
                saveConfig.mutate({ ...config, sender: { ...config.sender, [key]: v } })
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
