import { z } from "zod";
import { isIP } from "node:net";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

function isTrustedProxyList(value: string): boolean {
  return value.split(",").every((entry) => {
    const candidate = entry.trim();
    if (candidate === "") return true;
    const parts = candidate.split("/");
    if (parts.length > 2 || isIP(parts[0] ?? "") === 0) return false;
    if (parts.length === 1) return true;
    const addressFamily = isIP(parts[0] ?? "");
    const prefix = parts[1] ?? "";
    return /^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (addressFamily === 4 ? 32 : 128);
  });
}

const trustedProxyList = z.string().default("")
  .refine(isTrustedProxyList, "TRUSTED_PROXIES must be a comma-separated list of IP addresses or CIDRs")
  .transform((value) => value.split(",").map((entry) => entry.trim()).filter(Boolean));

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(7000),
  BASE_URL: z.string().url().default("http://127.0.0.1:7000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PREFLIGHT_ENABLED: booleanString,
  PREFLIGHT_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(3_000),
  PREFLIGHT_MAX_CANDIDATES: z.coerce.number().int().min(1).max(5).default(3),
  ENABLE_DEBUG: booleanString,
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(250).max(10_000).default(2_500),
  UPSTREAM_MAX_RESPONSE_BYTES: z.coerce.number().int().min(16_384).max(5_242_880).default(1_048_576),
  UPSTREAM_ALLOWED_HOSTS: z.string().trim().min(1).default("torrentio.strem.fun"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100_000).default(240),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(60_000),
  TRUSTED_PROXIES: trustedProxyList,
  MAX_CONCURRENT_STREAM_REQUESTS: z.coerce.number().int().min(1).max(1_024).default(32),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
