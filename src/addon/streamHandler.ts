import type { Logger } from "pino";
import { validateConfig, ConfigError } from "../config/encode";
import type { AutoPickConfig } from "../config/schema";
import type { RankedCandidate } from "../core/candidate";
import { AvailabilityHealthChecker, CachedHealthChecker, type CandidateHealthChecker } from "../core/health";
import { selectCandidates, type SelectionResult } from "../core/selector";
import type { AppEnv } from "../env";
import { DiscoveryService } from "../sources/discovery";

const movieIdPattern = /^tt\d{5,12}$/;
const episodeIdPattern = /^(tt\d{5,12}):(\d{1,3}):(\d{1,4})$/;

export interface RankRequest {
  type: "movie" | "series";
  id: string;
  config: AutoPickConfig;
}

export interface StremioStream {
  name: string;
  description: string;
  infoHash: string;
  fileIdx?: number;
  sources?: string[];
  behaviorHints: {
    filename: string;
    videoSize?: number;
  };
}

const labels = {
  dolbyVision: "Dolby Vision",
  hdr10plus: "HDR10+",
  hdr10: "HDR10",
  hlg: "HLG",
  atmosTruehd: "Atmos + TrueHD",
  truehd: "TrueHD",
  dtsx: "DTS:X",
  dtshdma: "DTS-HD MA",
  dtshd: "DTS-HD",
  eac3: "DD+",
  atmos: "Atmos",
  ac3: "Dolby Digital",
  dts: "DTS",
  aac: "AAC",
} as const;

function describe(candidate: RankedCandidate): string {
  const parts: string[] = [];
  if (candidate.resolution) parts.push(candidate.resolution === "2160p" ? "4K" : candidate.resolution);
  if (candidate.hdr.length > 0) parts.push(...candidate.hdr.map((format) => labels[format]));
  if (candidate.releaseType && candidate.releaseType !== "unknown") {
    parts.push(candidate.releaseType === "webdl" ? "WEB-DL" : candidate.releaseType === "webrip" ? "WEBRip" : candidate.releaseType);
  }
  if (candidate.codec) parts.push(candidate.codec === "h264" ? "H.264" : candidate.codec.toUpperCase());
  const audio = candidate.audio[0];
  if (audio) parts.push(labels[audio]);
  if (candidate.sizeBytes !== undefined) {
    const gb = candidate.sizeBytes / 1024 ** 3;
    parts.push(`${gb >= 10 ? gb.toFixed(0) : gb.toFixed(1)} GB`);
  }
  if (candidate.seeders !== undefined) parts.push(`${candidate.seeders} seeders`);
  return parts.join(" • ") || "Automatically selected torrent";
}

export function toStremioStream(candidate: RankedCandidate, index = 0): StremioStream {
  const stream: StremioStream = {
    name: index === 0 ? "▶ PLAY" : `↪ Backup ${index}`,
    description: describe(candidate),
    infoHash: candidate.infoHash as string,
    behaviorHints: {
      filename: candidate.originalTitle,
      ...(candidate.sizeBytes !== undefined ? { videoSize: Math.round(candidate.sizeBytes) } : {}),
    },
  };
  if (candidate.fileIdx !== undefined) stream.fileIdx = candidate.fileIdx;
  if (candidate.trackers && candidate.trackers.length > 0) stream.sources = candidate.trackers;
  return stream;
}

export class StreamService {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly env: AppEnv,
    private readonly logger: Logger,
    private readonly healthChecker: CandidateHealthChecker = new CachedHealthChecker(new AvailabilityHealthChecker()),
  ) {}

  async rank(request: RankRequest): Promise<SelectionResult> {
    const options = {
      preflightEnabled: this.env.PREFLIGHT_ENABLED,
      preflightTimeoutMs: this.env.PREFLIGHT_TIMEOUT_MS,
      preflightMaxCandidates: this.env.PREFLIGHT_MAX_CANDIDATES,
      healthChecker: this.healthChecker,
    };
    if (request.type === "movie") {
      if (!movieIdPattern.test(request.id)) return { selected: [], ranked: [], rejected: [], dedupedCount: 0 };
      const candidates = await this.discovery.discoverMovie(request.id, request.config);
      return selectCandidates(candidates, request.config, "movie", options);
    }
    const match = request.id.match(episodeIdPattern);
    if (!match?.[1] || !match[2] || !match[3]) return { selected: [], ranked: [], rejected: [], dedupedCount: 0 };
    const season = Number.parseInt(match[2], 10);
    const episode = Number.parseInt(match[3], 10);
    const candidates = await this.discovery.discoverEpisode(match[1], season, episode, request.config);
    return selectCandidates(candidates, request.config, "series", options, { season, episode });
  }

  async handle(args: { type: string; id: string; config?: unknown }): Promise<{ streams: StremioStream[] }> {
    if ((args.type !== "movie" && args.type !== "series") || !args.config) return { streams: [] };
    try {
      const config = validateConfig(args.config);
      const result = await this.rank({ type: args.type, id: args.id, config });
      return { streams: result.selected.map(toStremioStream) };
    } catch (error) {
      if (!(error instanceof ConfigError)) this.logger.warn({ event: "stream_request_failed" }, "Stream request failed");
      return { streams: [] };
    }
  }
}
