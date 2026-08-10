import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env";

describe("environment", () => {
  it("uses safe public-instance defaults", () => {
    const env = loadEnv({});
    expect(env.UPSTREAM_ALLOWED_HOSTS).toBe("torrentio.strem.fun");
    expect(env.MAX_CONCURRENT_STREAM_REQUESTS).toBe(32);
  });

  it("uses only an explicit base URL", () => {
    const env = loadEnv({
      BASE_URL: "https://autopick.example.com",
      RENDER_EXTERNAL_URL: "https://stremio-autopick.onrender.com",
    });
    expect(env.BASE_URL).toBe("https://autopick.example.com");
  });
});
