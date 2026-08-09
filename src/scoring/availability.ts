import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

function baseAvailability(seeders: number): number {
  if (seeders === 0) return -30;
  if (seeders <= 2) return -12 + (seeders - 1) * 4;
  if (seeders <= 5) return -5 + (seeders - 3) * 2;
  return Math.min(30, 6 + Math.log10(seeders / 5) * 20);
}

export function availabilityScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  const factor = config.preset === "fastStart" ? 1.5 : config.preset === "maximumQuality" ? 0.8 : config.preset === "dataSaver" ? 1.1 : 1;
  if (candidate.seeders === undefined) {
    if (candidate.peers !== undefined) {
      const score = Math.round(baseAvailability(candidate.peers) * factor * 0.7);
      return { score, reasons: [signedReason(score, `${candidate.peers} reported peers`)] };
    }
    const score = config.availability.unknownSeeders === "penalise" ? Math.round(-3 * factor) : 0;
    return { score, reasons: score === 0 ? [] : [signedReason(score, "unknown availability")] };
  }
  const score = Math.round(baseAvailability(candidate.seeders) * factor);
  return { score, reasons: [signedReason(score, `${candidate.seeders} seeders`)] };
}
