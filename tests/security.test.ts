import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/defaults";
import { safeJsonFetch, validateUpstreamUrl } from "../src/security/safeFetch";
import {
  assertConfigSourcesAllowed,
  isUpstreamUrlAllowed,
  parseAllowedUpstreamHosts,
} from "../src/security/upstreamPolicy";

describe("upstream SSRF protection", () => {
  it("requires HTTPS for remote hosts", () => {
    expect(() => validateUpstreamUrl("http://example.com/manifest.json")).toThrow(/HTTPS/);
  });

  it("rejects credentials and arbitrary protocols", () => {
    expect(() => validateUpstreamUrl("https://user:pass@example.com/manifest.json")).toThrow(/credentials/);
    expect(() => validateUpstreamUrl("file:///etc/passwd")).toThrow(/HTTP/);
  });

  it("blocks localhost outside explicit development mode", async () => {
    await expect(safeJsonFetch("http://127.0.0.1:9/test.json", { allowPrivate: false, timeoutMs: 250 })).rejects.toThrow(/HTTPS|blocked/);
  });

  it("permits localhost URL validation in explicit development mode", () => {
    expect(validateUpstreamUrl("http://127.0.0.1:7001/manifest.json", true).hostname).toBe("127.0.0.1");
  });

  it("enforces exact upstream host allowlist matches", () => {
    expect(isUpstreamUrlAllowed("https://torrentio.strem.fun/manifest.json", "torrentio.strem.fun")).toBe(true);
    expect(isUpstreamUrlAllowed("https://torrentio.strem.fun./manifest.json", "torrentio.strem.fun")).toBe(true);
    expect(isUpstreamUrlAllowed("https://evil.torrentio.strem.fun/manifest.json", "torrentio.strem.fun")).toBe(false);
    expect(isUpstreamUrlAllowed("https://torrentio.strem.fun.evil.example/manifest.json", "torrentio.strem.fun")).toBe(false);
    expect(parseAllowedUpstreamHosts("EXAMPLE.COM, example.com").hosts).toEqual(["example.com"]);
  });

  it("rejects enabled sources outside the server allowlist", () => {
    const config = structuredClone(defaultConfig);
    config.sources = [{ url: "https://example.com/manifest.json", enabled: true, priority: 0 }];
    expect(() => assertConfigSourcesAllowed(config, "torrentio.strem.fun")).toThrow(/not allowed/);
  });
});
