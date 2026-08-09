import type { AutoPickConfig } from "../config/schema";
import type { RankedCandidate, StreamCandidate } from "./candidate";
import { dedupeCandidates } from "./dedupe";
import { hardFilterCandidates, type EpisodeTarget, type RejectedCandidate } from "./filters";
import { checkTopCandidates, type CandidateHealthChecker } from "./health";
import { rankCandidates } from "./ranking";

export interface SelectionOptions {
  preflightEnabled: boolean;
  preflightTimeoutMs: number;
  preflightMaxCandidates: number;
  healthChecker: CandidateHealthChecker;
}

export interface SelectionResult {
  winner?: RankedCandidate;
  selected: RankedCandidate[];
  ranked: RankedCandidate[];
  rejected: RejectedCandidate[];
  dedupedCount: number;
}

export async function selectCandidates(
  candidates: readonly StreamCandidate[],
  config: AutoPickConfig,
  contentType: "movie" | "series",
  options: SelectionOptions,
  episodeTarget?: EpisodeTarget,
): Promise<SelectionResult> {
  const deduped = dedupeCandidates(candidates);
  const filtered = hardFilterCandidates(deduped, config, contentType, episodeTarget);
  let initiallyRanked = rankCandidates(filtered.accepted, config, contentType);

  if (options.preflightEnabled && initiallyRanked.length > 0) {
    const checked = await checkTopCandidates(
      initiallyRanked,
      options.healthChecker,
      Math.min(config.healthCandidates, options.preflightMaxCandidates),
      options.preflightTimeoutMs,
    );
    initiallyRanked = rankCandidates(
      checked.filter((candidate) => candidate.health !== "failed"),
      config,
      contentType,
    );
  }

  const count = config.showBackups ? 1 + config.backupCount : 1;
  const selected = initiallyRanked.slice(0, count);
  return {
    ...(selected[0] ? { winner: selected[0] } : {}),
    selected,
    ranked: initiallyRanked,
    rejected: filtered.rejected,
    dedupedCount: deduped.length,
  };
}
