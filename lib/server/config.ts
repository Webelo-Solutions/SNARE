import "server-only";
import fs from "node:fs";
import { z } from "zod";
import { CONFIG_PATH, ensureDataDirs } from "./paths";
import type { Config } from "@/lib/types";

const PatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["Regex", "Keyword", "Edit Distance", "Combosquat"]),
  value: z.string(),
  mode: z.enum(["Include", "Exclude"]),
  enabled: z.boolean().default(true),
});

const SourceConfigSchema = z.object({
  ctLogs: z.boolean().default(true),
  dnsPermutation: z.boolean().default(true),
  whoisNrd: z.boolean().default(true),
  passiveDns: z.boolean().default(false),
});

const ApiKeysSchema = z.object({
  securitytrails: z.string().default(""),
  virustotal: z.string().default(""),
});

const SenderProfileSchema = z.object({
  name: z.string().default(""),
  title: z.string().default(""),
  company: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  address: z.string().default(""),
});

const ScheduleConfigSchema = z.object({
  enabled: z.boolean().default(false),
  intervalHours: z.number().int().positive().default(24),
  lastRunAt: z.string().default(""),
  screenshotsEnabled: z.boolean().default(false),
});

const AlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  minScore: z.number().int().min(0).max(100).default(50),
  emailTo: z.string().default(""),
  smtpHost: z.string().default(""),
  smtpPort: z.number().int().default(587),
  smtpUser: z.string().default(""),
  smtpPass: z.string().default(""),
  smtpTls: z.boolean().default(true),
  slackWebhook: z.string().default(""),
  teamsWebhook: z.string().default(""),
});

const RegistrarKeySchema = z.enum([
  "namecheap",
  "godaddy",
  "porkbun",
  "dynadot",
  "hover",
  "squarespace",
]);

const ConfigSchema = z.object({
  targets: z.array(z.string()).default([]),
  sources: SourceConfigSchema.default(SourceConfigSchema.parse({})),
  apiKeys: ApiKeysSchema.default(ApiKeysSchema.parse({})),
  patterns: z.array(PatternSchema).default([]),
  sender: SenderProfileSchema.default(SenderProfileSchema.parse({})),
  nrdDays: z.number().int().positive().default(30),
  showUnresolved: z.boolean().default(false),
  schedule: ScheduleConfigSchema.default(ScheduleConfigSchema.parse({})),
  alerts: AlertConfigSchema.default(AlertConfigSchema.parse({})),
  preferredRegistrar: RegistrarKeySchema.default("namecheap"),
  customStubs: z.array(z.string()).default([]),
  includeAvailable: z.boolean().default(true),
});

export function defaultConfig(): Config {
  return ConfigSchema.parse({});
}

export function loadConfig(): Config {
  ensureDataDirs();
  if (!fs.existsSync(CONFIG_PATH)) {
    return defaultConfig();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const parsed = ConfigSchema.safeParse(raw);
    return parsed.success ? parsed.data : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: Config): Config {
  ensureDataDirs();
  const parsed = ConfigSchema.parse(config);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(parsed, null, 2), "utf-8");
  return parsed;
}

export function updateConfig(partial: Partial<Config>): Config {
  const current = loadConfig();
  return saveConfig({ ...current, ...partial });
}

export { ConfigSchema, PatternSchema };
