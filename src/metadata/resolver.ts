import { z } from "zod";
import { TtlCache } from "../cache/cache";
import { safeJsonFetch } from "../security/safeFetch";
import type { EpisodeMetadata, MetadataResolver, MovieMetadata } from "./types";

const META_TTL_MS = 24 * 60 * 60 * 1_000;

const metaResponseSchema = z.object({
  meta: z.object({
    name: z.string().optional(),
    releaseInfo: z.string().optional(),
    year: z.union([z.string(), z.number()]).optional(),
  }).passthrough(),
});

export class CinemetaMetadataResolver implements MetadataResolver {
  private readonly cache = new TtlCache<MovieMetadata | EpisodeMetadata>(1_000);

  constructor(private readonly timeoutMs = 1_200) {}

  async resolveMovie(imdbId: string): Promise<MovieMetadata> {
    const key = `movie:${imdbId}`;
    const cached = this.cache.get(key) as MovieMetadata | undefined;
    if (cached) return cached;
    const fallback: MovieMetadata = { imdbId, title: imdbId };
    try {
      const data = metaResponseSchema.parse(
        await safeJsonFetch(`https://v3-cinemeta.strem.io/meta/movie/${encodeURIComponent(imdbId)}.json`, {
          timeoutMs: this.timeoutMs,
          maxResponseBytes: 262_144,
          maxRedirects: 1,
        }),
      );
      const rawYear = data.meta.year ?? data.meta.releaseInfo?.match(/(?:19|20)\d{2}/)?.[0];
      const year = rawYear === undefined ? undefined : Number.parseInt(String(rawYear), 10);
      const metadata: MovieMetadata = {
        imdbId,
        title: data.meta.name ?? imdbId,
        ...(year !== undefined && Number.isFinite(year) ? { year } : {}),
      };
      this.cache.set(key, metadata, META_TTL_MS);
      return metadata;
    } catch {
      this.cache.set(key, fallback, 60_000);
      return fallback;
    }
  }

  async resolveEpisode(imdbId: string, season: number, episode: number): Promise<EpisodeMetadata> {
    const key = `series:${imdbId}:${season}:${episode}`;
    const cached = this.cache.get(key) as EpisodeMetadata | undefined;
    if (cached) return cached;
    const fallback: EpisodeMetadata = { imdbId, title: `S${season}E${episode}`, season, episode };
    try {
      const data = metaResponseSchema.parse(
        await safeJsonFetch(
          `https://v3-cinemeta.strem.io/meta/series/${encodeURIComponent(`${imdbId}:${season}:${episode}`)}.json`,
          { timeoutMs: this.timeoutMs, maxResponseBytes: 262_144, maxRedirects: 1 },
        ),
      );
      const metadata: EpisodeMetadata = {
        imdbId,
        title: data.meta.name ?? fallback.title,
        season,
        episode,
      };
      this.cache.set(key, metadata, META_TTL_MS);
      return metadata;
    } catch {
      this.cache.set(key, fallback, 60_000);
      return fallback;
    }
  }
}
