import { describe, expect, it } from "vitest";
import { AvailabilityHealthChecker, CachedHealthChecker, type CandidateHealthChecker } from "../src/core/health";
import { makeCandidate } from "./helpers";

describe("candidate health", () => {
  it("uses reported peers when seeders are unavailable", async () => {
    const result = await new AvailabilityHealthChecker().check(makeCandidate("Movie.1080p.WEB-DL", { peers: 4 }));
    expect(result.health).toBe("healthy");
  });

  it("caches health results briefly", async () => {
    let checks = 0;
    const inner: CandidateHealthChecker = {
      check: async () => {
        checks += 1;
        return { health: "healthy", reason: "test" };
      },
    };
    const checker = new CachedHealthChecker(inner, 1_000);
    const candidate = makeCandidate("Movie.1080p.WEB-DL", { seeders: 20 });
    await checker.check(candidate);
    await checker.check(candidate);
    expect(checks).toBe(1);
  });
});
