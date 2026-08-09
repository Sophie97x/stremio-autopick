import { effectiveResolutionOrder } from "../config/policy";
import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "./candidate";

export interface EpisodeTarget {
  season: number;
  episode: number;
}

export interface RejectedCandidate {
  candidate: StreamCandidate;
  reasons: string[];
}

export interface HardFilterResult {
  accepted: StreamCandidate[];
  rejected: RejectedCandidate[];
}

export function matchesEpisode(candidate: StreamCandidate, target: EpisodeTarget): boolean {
  if (candidate.episode !== undefined) {
    return candidate.season === target.season && candidate.episode === target.episode;
  }
  if (candidate.isSeasonPack) return candidate.season === target.season && candidate.fileIdx !== undefined;
  if (candidate.isFullSeriesPack) return candidate.fileIdx !== undefined;
  return false;
}

function rejectionReasons(
  candidate: StreamCandidate,
  config: AutoPickConfig,
  contentType: "movie" | "series",
  episodeTarget?: EpisodeTarget,
): string[] {
  const reasons: string[] = [];
  const resolutions = effectiveResolutionOrder(config);
  if (!candidate.infoHash) reasons.push("missing torrent info hash");
  if (candidate.resolution && !resolutions.includes(candidate.resolution)) reasons.push(`resolution ${candidate.resolution} disabled`);
  if (!candidate.resolution && config.strictPreferredResolution) reasons.push("resolution unknown under strict resolution matching");
  if (candidate.codec && !config.enabledCodecs.includes(candidate.codec)) reasons.push(`codec ${candidate.codec} blocked`);

  const candidateHdr = candidate.hdr.length > 0 ? candidate.hdr : (["sdr"] as const);
  const enabledCandidateHdr = candidateHdr.filter((format) => config.enabledHdr.includes(format));
  if (enabledCandidateHdr.length === 0) reasons.push("HDR/SDR format disabled");
  if (config.requireHdr && !enabledCandidateHdr.some((format) => format !== "sdr")) reasons.push("HDR required");

  if (candidate.undesirableQuality.some((quality) => config.blockedQualities.includes(quality))) {
    reasons.push(`blocked quality: ${candidate.undesirableQuality.join(", ")}`);
  }

  const sizeLimit = contentType === "movie" ? config.sizes.movie : config.sizes.episode;
  if (candidate.sizeBytes !== undefined && candidate.sizeBytes > sizeLimit.hardGb * 1024 ** 3) {
    reasons.push(`over ${sizeLimit.hardGb} GB hard limit`);
  }

  if (candidate.seeders !== undefined && candidate.seeders < config.availability.minimumSeeders) {
    reasons.push(`below minimum ${config.availability.minimumSeeders} seeders`);
  }
  if (candidate.seeders === undefined && config.availability.unknownSeeders === "reject") reasons.push("unknown seeder count rejected");

  const preferredLanguage = config.preferredLanguage.split("-")[0];
  const languageKnown = candidate.languages.length > 0;
  const preferredPresent = candidate.languages.includes(preferredLanguage ?? config.preferredLanguage);
  if (config.languageMode === "englishOnly" && languageKnown && !candidate.languages.includes("en")) reasons.push("not English");
  if (config.strictLanguage && (!languageKnown || !preferredPresent)) reasons.push("strict language mismatch");

  if (contentType === "series" && episodeTarget && !matchesEpisode(candidate, episodeTarget)) reasons.push("wrong or unverified episode file");
  return reasons;
}

export function hardFilterCandidates(
  candidates: readonly StreamCandidate[],
  config: AutoPickConfig,
  contentType: "movie" | "series",
  episodeTarget?: EpisodeTarget,
): HardFilterResult {
  const accepted: StreamCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  for (const candidate of candidates) {
    const reasons = rejectionReasons(candidate, config, contentType, episodeTarget);
    if (reasons.length > 0) rejected.push({ candidate, reasons });
    else accepted.push(candidate);
  }
  return { accepted, rejected };
}
