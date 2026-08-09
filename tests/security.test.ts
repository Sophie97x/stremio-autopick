import { describe, expect, it } from "vitest";
import { safeJsonFetch, validateUpstreamUrl } from "../src/security/safeFetch";

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
});
