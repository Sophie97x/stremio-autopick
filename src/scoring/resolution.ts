import { effectiveResolutionOrder } from "../config/policy";
import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

const weights = [100, 65, 35, 15];

export function resolutionScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  if (!candidate.resolution) return { score: -5, reasons: [signedReason(-5, "resolution unknown")] };
  const index = effectiveResolutionOrder(config).indexOf(candidate.resolution);
  const score = index < 0 ? 0 : (weights[index] ?? 5);
  const label = index === 0 ? `preferred ${candidate.resolution}` : `${candidate.resolution} fallback #${index}`;
  return { score, reasons: [signedReason(score, label)] };
}
