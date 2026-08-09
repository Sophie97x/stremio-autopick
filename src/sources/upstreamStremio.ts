import { createHash } from "node:crypto";
import { z } from "zod";
import type { StreamCandidate } from "../core/candidate";
import { parseReleaseName, parseSeedersFromText, parseSizeFromText } from "../core/parser";
import { safeJsonFetch } from "../security/safeFetch";
import type { EpisodeContext, MovieContext, TorrentSourceAdapter } from "./types";

const upstreamStreamSchema = z
  .object({
    infoHash: z.string().min(1).max(128).optional(),
    fileIdx: z.number().int().min(0).optional(),
    sources: z.array(z.string().max(2048)).max(64).optional(),
    name: z.string().max(2_000).optional(),
    title: z.string().max(2_000).optional(),
    description: z.string().max(10_000).optional(),
    filename: z.string().max(2_000).optional(),
    videoSize: z.number().nonnegative().optional(),
    seeders: z.number().int().nonnegative().optional(),
    peers: z.number().int().nonnegative().optional(),
    behaviorHints: z
      .object({
        filename: z.string().max(2_000).optional(),
        videoSize: z.number().nonnegative().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const upstreamResponseSchema = z.object({ streams: z.array(z.unknown()).max(2_000) }).passthrough();

export interface UpstreamAdapterOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowPrivate?: boolean;
  priority?: number;
}

function normaliseBaseUrl(input: string): URL {
  const url = new URL(input);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/manifest\.json\/?$/i, "").replace(/\/+$/, "");
  return url;
}

function validInfoHash(value: string | undefined): value is string {
  return Boolean(value && (/^[a-f\d]{40}$/i.test(value) || /^[a-z2-7]{32}$/i.test(value)));
}

export class UpstreamStremioAdapter implements TorrentSourceAdapter {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  private readonly baseUrl: URL;
  private readonly options: Required<UpstreamAdapterOptions>;

  constructor(url: string, options: UpstreamAdapterOptions = {}) {
    this.baseUrl = normaliseBaseUrl(url);
    this.id = `upstream-${createHash("sha256").update(this.baseUrl.toString()).digest("hex").slice(0, 12)}`;
    this.name = `Upstream ${this.baseUrl.hostname}`;
    this.priority = options.priority ?? 0;
    this.options = {
      timeoutMs: options.timeoutMs ?? 2_500,
      maxResponseBytes: options.maxResponseBytes ?? 1_048_576,
      allowPrivate: options.allowPrivate ?? false,
      priority: this.priority,
    };
  }

  async searchMovie(context: MovieContext): Promise<StreamCandidate[]> {
    return this.search("movie", context.imdbId);
  }

  async searchEpisode(context: EpisodeContext): Promise<StreamCandidate[]> {
    return this.search("series", `${context.imdbId}:${context.season}:${context.episode}`);
  }

  private async search(type: "movie" | "series", id: string): Promise<StreamCandidate[]> {
    const url = new URL(this.baseUrl.toString());
    url.pathname = `${this.baseUrl.pathname.replace(/\/+$/, "")}/stream/${type}/${encodeURIComponent(id)}.json`;
    const response = upstreamResponseSchema.parse(
      await safeJsonFetch(url.toString(), {
        timeoutMs: this.options.timeoutMs,
        maxResponseBytes: this.options.maxResponseBytes,
        maxRedirects: 2,
        allowPrivate: this.options.allowPrivate,
      }),
    );
    const candidates: StreamCandidate[] = [];
    for (const raw of response.streams) {
      const result = upstreamStreamSchema.safeParse(raw);
      if (!result.success) continue;
      const stream = result.data;
      const infoHash = stream.infoHash;
      if (!validInfoHash(infoHash)) continue;
      const filename = stream.behaviorHints?.filename ?? stream.filename;
      const text = [filename, stream.title, stream.name, stream.description].filter(Boolean).join(" • ");
      const title = filename ?? stream.title ?? stream.name ?? stream.description?.slice(0, 500) ?? infoHash;
      const parsed = parseReleaseName(text);
      const sizeBytes = stream.behaviorHints?.videoSize ?? stream.videoSize ?? parseSizeFromText(text);
      const seeders = stream.seeders ?? parseSeedersFromText(text);
      candidates.push({
        sourceId: this.id,
        sourceName: this.name,
        sourcePriority: this.priority,
        contributingSources: [this.name],
        originalTitle: title,
        infoHash: infoHash.toLowerCase(),
        ...(stream.fileIdx !== undefined ? { fileIdx: stream.fileIdx } : {}),
        ...(stream.sources ? { trackers: stream.sources.filter((source) => source.startsWith("tracker:") || source.startsWith("dht:")) } : {}),
        ...(sizeBytes !== undefined ? { sizeBytes } : {}),
        ...(seeders !== undefined ? { seeders } : {}),
        ...(stream.peers !== undefined ? { peers: stream.peers } : {}),
        ...parsed,
        health: "unknown",
      });
    }
    return candidates;
  }
}
