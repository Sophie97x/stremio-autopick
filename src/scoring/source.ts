import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

export function sourceScore(candidate: StreamCandidate): ScoreComponent {
  const score = Math.max(0, 6 - candidate.sourcePriority * 2);
  return { score, reasons: score ? [signedReason(score, "preferred source")] : [] };
}
