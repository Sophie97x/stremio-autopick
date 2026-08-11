import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/defaults";
import {
  ConfigError,
  MAX_ENCODED_CONFIG_LENGTH,
  decodeConfig,
  encodeConfig,
  validateConfig,
} from "../src/config/encode";
import { createPresetConfig } from "../src/config/presets";

describe("configuration", () => {
  it("validates the default config", () => {
    expect(validateConfig(defaultConfig)).toEqual(defaultConfig);
    expect(defaultConfig.includeDemoSource).toBe(false);
    expect(defaultConfig.sources).toEqual([
      { url: "https://torrentio.strem.fun/manifest.json", enabled: true, priority: 0 },
    ]);
  });

  it("round-trips JSON through Base64URL", () => {
    const encoded = encodeConfig(defaultConfig);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeConfig(encoded)).toEqual(defaultConfig);
  });

  it("creates the TV Stick reliability preset", () => {
    expect(createPresetConfig("tvStick")).toMatchObject({
      preset: "tvStick",
      resolutionOrder: ["1080p", "720p", "480p", "2160p"],
      enabledResolutions: ["1080p", "720p", "480p"],
      hdrOrder: ["sdr", "hdr10", "hlg", "hdr10plus", "dolbyVision"],
      enabledHdr: ["sdr"],
      codecOrder: ["h264", "hevc", "av1"],
      enabledCodecs: ["h264", "hevc"],
      audioOrder: ["ac3", "eac3", "aac", "dts", "atmos", "dtshd", "dtshdma", "dtsx", "truehd", "atmosTruehd"],
      sizes: { movie: { softGb: 6, hardGb: 12 }, episode: { softGb: 2, hardGb: 4 } },
      availability: { minimumSeeders: 20, unknownSeeders: "penalise" },
      showBackups: true,
      backupCount: 3,
      healthCandidates: 5,
    });
  });

  it("rejects invalid Base64URL", () => {
    expect(() => decodeConfig("not+base64/URL==")).toThrow(ConfigError);
  });

  it("rejects strict-schema violations", () => {
    expect(() => validateConfig({ ...defaultConfig, unexpected: true })).toThrow(/unrecognized/i);
    expect(() => validateConfig({ ...defaultConfig, fallbackResolution: "yes" })).toThrow(ConfigError);
  });

  it("migrates version zero settings", () => {
    const encoded = encodeConfig({ v: 0, profile: "fast", quality: "1080p", fallback: false });
    const migrated = decodeConfig(encoded);
    expect(migrated.v).toBe(1);
    expect(migrated.preset).toBe("fastStart");
    expect(migrated.preferredQuality).toBe("1080p");
    expect(migrated.fallbackResolution).toBe(false);
  });

  it("rejects oversized configuration before decoding", () => {
    expect(() => decodeConfig("A".repeat(MAX_ENCODED_CONFIG_LENGTH + 1))).toThrow(/too large/i);
  });

  it("rejects unsafe source URL protocols and credentials", () => {
    expect(() => validateConfig({ ...defaultConfig, sources: [{ url: "ftp://example.com/manifest.json", enabled: true, priority: 0 }] })).toThrow();
    expect(() => validateConfig({ ...defaultConfig, sources: [{ url: "https://user:pass@example.com/manifest.json", enabled: true, priority: 0 }] })).toThrow();
  });

  it("allows HTTPS and local development HTTP source URLs", () => {
    expect(
      validateConfig({
        ...defaultConfig,
        sources: [
          { url: "https://example.com/manifest.json", enabled: true, priority: 0 },
          { url: "http://127.0.0.1:9999/manifest.json", enabled: true, priority: 1 },
        ],
      }).sources,
    ).toHaveLength(2);
  });
});
