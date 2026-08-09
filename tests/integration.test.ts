import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/server";
import { encodeConfig } from "../src/config/encode";
import { createPresetConfig } from "../src/config/presets";
import { StreamService } from "../src/addon/streamHandler";
import { DiscoveryService } from "../src/sources/discovery";
import { createLogger } from "../src/logger";
import type { MetadataResolver } from "../src/metadata/types";
import { testEnv } from "./helpers";

describe("configured Stremio stream integration", () => {
  let upstream: http.Server;
  let addon: http.Server;
  let upstreamBase = "";
  let addonBase = "";
  let upstreamRequests = 0;

  beforeAll(async () => {
    const streams = [
      { name: "Source A", description: "Movie.2160p.WEB-DL.DV.HEVC.EAC3 • 24 GB • Seeders: 120", infoHash: "1".repeat(40), fileIdx: 0, sources: ["tracker:one"] },
      { name: "Duplicate", description: "Movie.2160p.WEB-DL.DV.HEVC.EAC3 • 24 GB • Seeders: 100", infoHash: "1".repeat(40), fileIdx: 0, sources: ["tracker:two"] },
      { name: "Huge", description: "Movie.2160p.Remux.HEVC.TrueHD • 39 GB • Seeders: 5", infoHash: "2".repeat(40), fileIdx: 0 },
      { name: "Reliable", description: "Movie.1080p.WEB-DL.x264.EAC3 • 9 GB • Seeders: 350", infoHash: "3".repeat(40), fileIdx: 0 },
      { name: "CAM", description: "Movie.2160p.CAM.x264 • 2 GB • Seeders: 500", infoHash: "4".repeat(40), fileIdx: 0 },
      { name: "720", description: "Movie.720p.WEBRip.x264.AAC • 2 GB • Seeders: 90", infoHash: "5".repeat(40), fileIdx: 0 },
      { name: "BluRay", description: "Movie.1080p.BluRay.x264.DTS-HD.MA • 14 GB • Seeders: 60", infoHash: "6".repeat(40), fileIdx: 0 },
      { name: "HDR", description: "Movie.2160p.WEB-DL.HDR10.HEVC.EAC3 • 22 GB • Seeders: 80", infoHash: "7".repeat(40), fileIdx: 0 },
      { name: "Unknown size", description: "Movie.1080p.WEBRip.x264 • Seeders: 30", infoHash: "8".repeat(40), fileIdx: 0 },
      { name: "DVD", description: "Movie.480p.DVD.AAC • 1 GB • Seeders: 15", infoHash: "9".repeat(40), fileIdx: 0 },
    ];
    upstream = http.createServer((_request, response) => {
      upstreamRequests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ streams }));
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    upstreamBase = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;

    const env = testEnv({ NODE_ENV: "development", ENABLE_DEBUG: true, BASE_URL: "http://127.0.0.1:7000" });
    const resolver: MetadataResolver = {
      resolveMovie: async (imdbId) => ({ imdbId, title: "Test Movie" }),
      resolveEpisode: async (imdbId, season, episode) => ({ imdbId, title: "Test Episode", season, episode }),
    };
    const logger = createLogger(env);
    const service = new StreamService(new DiscoveryService(resolver, env, logger), env, logger);
    addon = createApp({ env, streamService: service }).listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => addon.once("listening", resolve));
    addonBase = `http://127.0.0.1:${(addon.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await Promise.all([
      new Promise<void>((resolve) => addon.close(() => resolve())),
      new Promise<void>((resolve) => upstream.close(() => resolve())),
    ]);
  });

  it("fetches, parses, dedupes, filters, scores and returns one winner", async () => {
    const config = createPresetConfig("balanced4k");
    config.includeDemoSource = false;
    config.sources = [{ url: `${upstreamBase}/manifest.json`, enabled: true, priority: 0 }];
    const token = encodeConfig(config);

    const response = await fetch(`${addonBase}/${token}/stream/movie/tt1254207.json`);
    expect(response.status).toBe(200);
    const body = await response.json() as { streams: Array<Record<string, unknown>> };
    expect(body.streams).toHaveLength(1);
    expect(body.streams[0]).toMatchObject({ name: "▶ PLAY", infoHash: "1".repeat(40), fileIdx: 0 });

    const debugResponse = await fetch(`${addonBase}/${token}/debug/rank/movie/tt1254207`);
    const debug = await debugResponse.json() as { dedupedCount: number; candidates: unknown[]; rejected: Array<{ reasons: string[] }> };
    expect(debug.dedupedCount).toBe(9);
    expect(debug.candidates.length).toBeGreaterThan(1);
    expect(debug.rejected.some((entry) => entry.reasons.some((reason) => reason.includes("blocked quality")))).toBe(true);
    expect(upstreamRequests).toBe(1);
  });

  it("serves root and configured manifests from the same SDK router", async () => {
    const root = await fetch(`${addonBase}/manifest.json`).then((response) => response.json()) as { name: string };
    expect(root.name).toBe("AutoPick");

    const config = createPresetConfig("balanced4k");
    const token = encodeConfig(config);
    const configuredResponse = await fetch(`${addonBase}/${token}/manifest.json`);
    expect(configuredResponse.status).toBe(200);
    const configured = await configuredResponse.json() as { behaviorHints: { configurationRequired?: boolean; configurable?: boolean } };
    expect(configured.behaviorHints.configurationRequired).toBeUndefined();
    expect(configured.behaviorHints.configurable).toBeUndefined();
  });

  it("rejects malformed configured URLs with HTTP 400", async () => {
    const response = await fetch(`${addonBase}/not+base64/manifest.json`);
    expect(response.status).toBe(400);
  });
});
