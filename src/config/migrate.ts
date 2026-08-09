import { createPresetConfig } from "./presets";
import type { PresetName } from "./schema";

type LegacyConfig = {
  v?: 0;
  version?: 0;
  profile?: "balanced" | "maximum" | "fast" | "dataSaver";
  quality?: "auto" | "4k" | "1080p" | "720p";
  fallback?: boolean;
};

const legacyPreset: Record<NonNullable<LegacyConfig["profile"]>, PresetName> = {
  balanced: "balanced4k",
  maximum: "maximumQuality",
  fast: "fastStart",
  dataSaver: "dataSaver",
};

export function migrateConfig(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const value = input as Record<string, unknown>;
  if (value.v === 1) return input;
  if (value.v === 0 || value.version === 0) {
    const legacy = value as LegacyConfig;
    const config = createPresetConfig(legacy.profile ? legacyPreset[legacy.profile] : "balanced4k");
    config.preferredQuality =
      legacy.quality === "4k" ? "2160p" : legacy.quality === "auto" || !legacy.quality ? "automatic" : legacy.quality;
    config.fallbackResolution = legacy.fallback ?? true;
    return config;
  }
  return input;
}
