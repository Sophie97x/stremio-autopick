import { describe, expect, it } from "vitest";
import { createPresetConfig } from "../src/config/presets";
import { dedupeCandidates } from "../src/core/dedupe";
import type { CandidateHealthChecker } from "../src/core/health";
import { selectCandidates } from "../src/core/selector";
import { config, makeCandidate } from "./helpers";

const noPreflight = {
  preflightEnabled: false,
  preflightTimeoutMs: 500,
  preflightMaxCandidates: 3,
  healthChecker: { check: async () => ({ health: "unknown" as const, reason: "not checked" }) },
};

describe("ranking and selection", () => {
  it("chooses sensible 4K over a huge unreliable 4K", async () => {
    const huge = makeCandidate("Movie.2160p.Remux.HEVC.TrueHD", { sizeBytes: 90 * 1024 ** 3, seeders: 2 });
    const sensible = makeCandidate("Movie.2160p.WEB-DL.DV.HEVC.EAC3", { sizeBytes: 24 * 1024 ** 3, seeders: 120 });
    const result = await selectCandidates([huge, sensible], createPresetConfig("balanced4k"), "movie", noPreflight);
    expect(result.winner?.originalTitle).toBe(sensible.originalTitle);
  });

  it("can choose excellent 1080p over poor 4K in Balanced", async () => {
    const poor4k = makeCandidate("Movie.2160p.WEB-DL.HEVC", { sizeBytes: 35 * 1024 ** 3, seeders: 5 });
    const excellent1080 = makeCandidate("Movie.1080p.WEB-DL.x264.EAC3", { sizeBytes: 9 * 1024 ** 3, seeders: 350 });
    const result = await selectCandidates([poor4k, excellent1080], createPresetConfig("balanced4k"), "movie", noPreflight);
    expect(result.winner?.originalTitle).toBe(excellent1080.originalTitle);
  });

  it("Maximum Quality favors a healthy high-quality Remux", async () => {
    const remux = makeCandidate("Movie.2160p.Remux.DV.HEVC.TrueHD.Atmos", { sizeBytes: 68 * 1024 ** 3, seeders: 20 });
    const web = makeCandidate("Movie.2160p.WEB-DL.DV.HEVC.EAC3", { sizeBytes: 24 * 1024 ** 3, seeders: 200 });
    const healthy: CandidateHealthChecker = { check: async () => ({ health: "healthy", reason: "test" }) };
    const result = await selectCandidates([web, remux], createPresetConfig("maximumQuality"), "movie", {
      ...noPreflight,
      preflightEnabled: true,
      healthChecker: healthy,
    });
    expect(result.winner?.originalTitle).toBe(remux.originalTitle);
  });

  it("Fast Start favors a smaller highly available release", async () => {
    const remux = makeCandidate("Movie.1080p.Remux.x264.TrueHD", { sizeBytes: 14 * 1024 ** 3, seeders: 20 });
    const web = makeCandidate("Movie.1080p.WEB-DL.HEVC.EAC3", { sizeBytes: 5 * 1024 ** 3, seeders: 300 });
    const result = await selectCandidates([remux, web], createPresetConfig("fastStart"), "movie", noPreflight);
    expect(result.winner?.originalTitle).toBe(web.originalTitle);
  });

  it("uses 1080p when 4K is absent and fallback is on", async () => {
    const only = makeCandidate("Movie.1080p.WEB-DL.x264", { seeders: 50, sizeBytes: 8 * 1024 ** 3 });
    const selectedConfig = config({ preferredQuality: "2160p", fallbackResolution: true });
    expect((await selectCandidates([only], selectedConfig, "movie", noPreflight)).winner).toBeDefined();
  });

  it("returns no candidate when fallback is off", async () => {
    const only = makeCandidate("Movie.1080p.WEB-DL.x264", { seeders: 50, sizeBytes: 8 * 1024 ** 3 });
    const selectedConfig = config({ preferredQuality: "2160p", fallbackResolution: false });
    expect((await selectCandidates([only], selectedConfig, "movie", noPreflight)).winner).toBeUndefined();
  });

  it("never permits a file over the hard maximum", async () => {
    const tooLarge = makeCandidate("Movie.2160p.Remux.DV.HEVC.Atmos", { seeders: 500, sizeBytes: 41 * 1024 ** 3 });
    const okay = makeCandidate("Movie.1080p.WEB-DL.x264", { seeders: 6, sizeBytes: 8 * 1024 ** 3 });
    const result = await selectCandidates([tooLarge, okay], config(), "movie", noPreflight);
    expect(result.winner?.originalTitle).toBe(okay.originalTitle);
    expect(result.rejected[0]?.reasons.join(" ")).toMatch(/hard limit/);
  });

  it("rejects CAM by default", async () => {
    const cam = makeCandidate("Movie.2160p.CAM.HEVC", { seeders: 500, sizeBytes: 2 * 1024 ** 3 });
    const result = await selectCandidates([cam], config(), "movie", noPreflight);
    expect(result.winner).toBeUndefined();
  });

  it("falls back when the top preflight candidate fails", async () => {
    const top = makeCandidate("Movie.2160p.WEB-DL.DV.HEVC.Atmos", { seeders: 200, sizeBytes: 20 * 1024 ** 3 });
    const second = makeCandidate("Movie.2160p.WEB-DL.HDR10.HEVC.EAC3", { seeders: 180, sizeBytes: 18 * 1024 ** 3 });
    const checker: CandidateHealthChecker = {
      check: async (candidate) => ({ health: candidate.originalTitle === top.originalTitle ? "failed" : "healthy", reason: "test" }),
    };
    const result = await selectCandidates([top, second], config(), "movie", {
      preflightEnabled: true,
      preflightTimeoutMs: 500,
      preflightMaxCandidates: 3,
      healthChecker: checker,
    });
    expect(result.winner?.originalTitle).toBe(second.originalTitle);
  });

  it("deduplicates infoHash + fileIdx and merges metadata", () => {
    const first = makeCandidate("Movie.1080p.WEB-DL.x264", {
      infoHash: "a".repeat(40), fileIdx: 0, seeders: 10, trackers: ["tracker:one"], sourceName: "One", contributingSources: ["One"],
    });
    const second = makeCandidate("Movie.1080p.WEB-DL.x264.English", {
      infoHash: "a".repeat(40), fileIdx: 0, seeders: 50, trackers: ["tracker:two"], sourceName: "Two", contributingSources: ["Two"],
    });
    const result = dedupeCandidates([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ seeders: 50, trackers: ["tracker:one", "tracker:two"] });
    expect(result[0]?.contributingSources).toEqual(["One", "Two"]);
  });

  it("returns manual backups only when enabled", async () => {
    const candidates = [1, 2, 3, 4].map((value) => makeCandidate(`Movie.1080p.WEB-DL.x264.G${value}`, { seeders: 20 + value, fileIdx: value }));
    expect((await selectCandidates(candidates, config(), "movie", noPreflight)).selected).toHaveLength(1);
    expect((await selectCandidates(candidates, config({ showBackups: true, backupCount: 2 }), "movie", noPreflight)).selected).toHaveLength(3);
  });

  it("honors advanced resolution order and higher-resolution blocking", async () => {
    const advanced = config({
      mode: "advanced",
      preferredQuality: "2160p",
      resolutionOrder: ["1080p", "2160p", "720p", "480p"],
      enabledResolutions: ["2160p", "1080p", "720p"],
      allowHigherResolution: false,
    });
    const release4k = makeCandidate("Movie.2160p.WEB-DL.HEVC", { seeders: 100, sizeBytes: 20 * 1024 ** 3 });
    const release1080 = makeCandidate("Movie.1080p.WEB-DL.HEVC", { seeders: 20, sizeBytes: 8 * 1024 ** 3 });
    const result = await selectCandidates([release4k, release1080], advanced, "movie", noPreflight);
    expect(result.winner?.resolution).toBe("1080p");
    expect(result.rejected.some((entry) => entry.candidate.resolution === "2160p")).toBe(true);
  });
});
