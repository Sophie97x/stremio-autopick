import { createHash } from "node:crypto";
import type { Logger } from "pino";
import { TtlCache } from "../cache/cache";
import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import type { AppEnv } from "../env";
import type { MetadataResolver } from "../metadata/types";
import { assertConfigSourcesAllowed } from "../security/upstreamPolicy";
import { StaticDemoAdapter } from "./demo";
import type { TorrentSourceAdapter } from "./types";
import { UpstreamStremioAdapter } from "./upstreamStremio";

const POSITIVE_TTL_MS = 5 * 60 * 1_000;
const NEGATIVE_TTL_MS = 90 * 1_000;

function adapterSetKey(adapters: TorrentSourceAdapter[]): string {
  return createHash("sha256")
    .update(adapters.map((adapter) => `${adapter.id}:${adapter.priority}`).sort().join("|"))
    .digest("hex")
    .slice(0, 20);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("source timeout")), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export class DiscoveryService {
  private readonly cache = new TtlCache<StreamCandidate[]>(500);

  constructor(
    private readonly metadataResolver: MetadataResolver,
    private readonly env: AppEnv,
    private readonly logger: Logger,
  ) {}

  private adapters(config: AutoPickConfig): TorrentSourceAdapter[] {
    assertConfigSourcesAllowed(config, this.env.UPSTREAM_ALLOWED_HOSTS);
    const adapters: TorrentSourceAdapter[] = [];
    if (config.includeDemoSource) adapters.push(new StaticDemoAdapter());
    for (const source of config.sources.filter((entry) => entry.enabled).sort((a, b) => a.priority - b.priority)) {
      adapters.push(
        new UpstreamStremioAdapter(source.url, {
          priority: source.priority,
          timeoutMs: this.env.UPSTREAM_TIMEOUT_MS,
          maxResponseBytes: this.env.UPSTREAM_MAX_RESPONSE_BYTES,
          allowPrivate: this.env.NODE_ENV === "development",
        }),
      );
    }
    return adapters;
  }

  async discoverMovie(imdbId: string, config: AutoPickConfig): Promise<StreamCandidate[]> {
    const adapters = this.adapters(config);
    const key = `movie:${imdbId}:${adapterSetKey(adapters)}`;
    const cached = this.cache.get(key);
    if (cached) return structuredClone(cached);
    const metadata = await this.metadataResolver.resolveMovie(imdbId);
    const settled = await Promise.allSettled(
      adapters.map((adapter) => withTimeout(adapter.searchMovie({ imdbId, metadata }), this.env.UPSTREAM_TIMEOUT_MS + 250)),
    );
    return this.collect(key, adapters, settled);
  }

  async discoverEpisode(
    imdbId: string,
    season: number,
    episode: number,
    config: AutoPickConfig,
  ): Promise<StreamCandidate[]> {
    const adapters = this.adapters(config);
    const key = `series:${imdbId}:${season}:${episode}:${adapterSetKey(adapters)}`;
    const cached = this.cache.get(key);
    if (cached) return structuredClone(cached);
    const metadata = await this.metadataResolver.resolveEpisode(imdbId, season, episode);
    const settled = await Promise.allSettled(
      adapters.map((adapter) =>
        withTimeout(adapter.searchEpisode({ imdbId, season, episode, metadata }), this.env.UPSTREAM_TIMEOUT_MS + 250),
      ),
    );
    return this.collect(key, adapters, settled);
  }

  private collect(
    cacheKey: string,
    adapters: TorrentSourceAdapter[],
    settled: PromiseSettledResult<StreamCandidate[]>[],
  ): StreamCandidate[] {
    const candidates: StreamCandidate[] = [];
    settled.forEach((result, index) => {
      if (result.status === "fulfilled") candidates.push(...result.value);
      else this.logger.warn({ event: "source_failed", sourceId: adapters[index]?.id ?? "unknown" }, "Torrent source failed");
    });
    this.cache.set(cacheKey, structuredClone(candidates), candidates.length > 0 ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS);
    return structuredClone(candidates);
  }
}
