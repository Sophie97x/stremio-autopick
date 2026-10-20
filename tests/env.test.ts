import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

describe("environment", () => {
  it("uses safe public-instance defaults", () => {
    const env = loadEnv({});
    expect(env.UPSTREAM_ALLOWED_HOSTS).toBe("torrentio.strem.fun");
    expect(env.TRUSTED_PROXIES).toEqual([]);
    expect(env.MAX_CONCURRENT_STREAM_REQUESTS).toBe(32);
  });

  it("uses only an explicit base URL", () => {
    const env = loadEnv({
      BASE_URL: "https://autopick.example.com",
      RENDER_EXTERNAL_URL: "https://stremio-autopick.onrender.com",
    });
    expect(env.BASE_URL).toBe("https://autopick.example.com");
  });

  it("accepts only IP and CIDR trusted proxies", () => {
    expect(loadEnv({ TRUSTED_PROXIES: "127.0.0.1, 2001:db8::/32" }).TRUSTED_PROXIES).toEqual([
      "127.0.0.1",
      "2001:db8::/32",
    ]);
    expect(() => loadEnv({ TRUSTED_PROXIES: "proxy.internal" })).toThrow();
    expect(() => loadEnv({ TRUSTED_PROXIES: "10.0.0.1/33" })).toThrow();
    expect(() => loadEnv({ TRUSTED_PROXIES: "0.0.0.0/0" })).toThrow();
    expect(() => loadEnv({ TRUSTED_PROXIES: "::/0" })).toThrow();
  });
});
