import { createHash } from "node:crypto";
import { defaultConfig } from "../src/config/defaults";
import type { AutoPickConfig } from "../src/config/schema";
import type { StreamCandidate } from "../src/core/candidate";
import { parseReleaseName } from "../src/core/parser";
import { loadEnv, type AppEnv } from "../src/env";

export function makeCandidate(title: string, overrides: Partial<StreamCandidate> = {}): StreamCandidate {
  const parsed = parseReleaseName(title);
  return {
    ...parsed,
    sourceId: "test",
    sourceName: "Test Source",
    sourcePriority: 0,
    contributingSources: ["Test Source"],
    originalTitle: title,
    infoHash: createHash("sha1").update(`${title}:${JSON.stringify(overrides)}`).digest("hex"),
    health: "unknown",
    ...overrides,
  };
}

export function config(overrides: Partial<AutoPickConfig> = {}): AutoPickConfig {
  return { ...structuredClone(defaultConfig), ...overrides };
}

export function testEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    ...loadEnv({
      PORT: "7000",
      BASE_URL: "http://127.0.0.1:7000",
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      PREFLIGHT_ENABLED: "false",
      PREFLIGHT_TIMEOUT_MS: "500",
      PREFLIGHT_MAX_CANDIDATES: "3",
      ENABLE_DEBUG: "false",
      UPSTREAM_TIMEOUT_MS: "1000",
      UPSTREAM_MAX_RESPONSE_BYTES: "1048576",
      UPSTREAM_ALLOWED_HOSTS: "*",
      MAX_CONCURRENT_STREAM_REQUESTS: "32",
    }),
    ...overrides,
  };
}
