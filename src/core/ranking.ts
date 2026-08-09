import type { AutoPickConfig } from "../config/schema";
import { audioScore } from "../scoring/audio";
import { availabilityScore } from "../scoring/availability";
import { codecScore } from "../scoring/codec";
import { hdrScore } from "../scoring/hdr";
import { healthScore } from "../scoring/health";
import { languageScore } from "../scoring/language";
import { releaseQualityScore } from "../scoring/release";
import { resolutionScore } from "../scoring/resolution";
import { sizeScore } from "../scoring/size";
import { sourceScore } from "../scoring/source";
import type { ScoreComponent } from "../scoring/types";
import type { RankedCandidate, StreamCandidate } from "./candidate";

export function scoreCandidate(
  candidate: StreamCandidate,
  config: AutoPickConfig,
  contentType: "movie" | "series",
): RankedCandidate {
  const components: ScoreComponent[] = [
    resolutionScore(candidate, config),
    hdrScore(candidate, config),
    releaseQualityScore(candidate, config),
    codecScore(candidate, config),
    audioScore(candidate, config),
    availabilityScore(candidate, config),
    sizeScore(candidate, config, contentType),
    sourceScore(candidate),
    languageScore(candidate, config),
    healthScore(candidate),
  ];
  return {
    ...structuredClone(candidate),
    health: candidate.health ?? "unknown",
    score: components.reduce((sum, component) => sum + component.score, 0),
    scoreReasons: components.flatMap((component) => component.reasons),
  };
}

const healthRank = { healthy: 2, unknown: 1, failed: 0 } as const;

function tieBreak(a: RankedCandidate, b: RankedCandidate, config: AutoPickConfig): number {
  const health = healthRank[b.health] - healthRank[a.health];
  if (health !== 0) return health;
  const availability = (b.seeders ?? (b.peers === undefined ? -1 : b.peers * 0.5)) - (a.seeders ?? (a.peers === undefined ? -1 : a.peers * 0.5));
  if (availability !== 0) return availability;
  const release = config.releaseOrder.indexOf(a.releaseType ?? "unknown") - config.releaseOrder.indexOf(b.releaseType ?? "unknown");
  if (release !== 0) return release;
  const aHdr = a.hdr[0] ?? "sdr";
  const bHdr = b.hdr[0] ?? "sdr";
  const hdr = config.hdrOrder.indexOf(aHdr) - config.hdrOrder.indexOf(bHdr);
  if (hdr !== 0) return hdr;
  const aAudio = a.audio[0];
  const bAudio = b.audio[0];
  const audio = (aAudio ? config.audioOrder.indexOf(aAudio) : 999) - (bAudio ? config.audioOrder.indexOf(bAudio) : 999);
  if (audio !== 0) return audio;
  const size = (a.sizeBytes ?? Number.MAX_SAFE_INTEGER) - (b.sizeBytes ?? Number.MAX_SAFE_INTEGER);
  if (size !== 0) return size;
  return a.originalTitle.localeCompare(b.originalTitle);
}

export function sortRankedCandidates(candidates: RankedCandidate[], config: AutoPickConfig): RankedCandidate[] {
  return candidates.sort((a, b) => {
    const difference = b.score - a.score;
    const denominator = Math.max(Math.abs(a.score), Math.abs(b.score), 1);
    if (Math.abs(difference) / denominator > 0.05) return difference;
    return tieBreak(a, b, config) || difference;
  });
}

export function rankCandidates(
  candidates: readonly StreamCandidate[],
  config: AutoPickConfig,
  contentType: "movie" | "series",
): RankedCandidate[] {
  return sortRankedCandidates(candidates.map((candidate) => scoreCandidate(candidate, config, contentType)), config);
}
