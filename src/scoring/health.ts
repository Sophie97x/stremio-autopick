import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

export function healthScore(candidate: StreamCandidate): ScoreComponent {
  if (candidate.health === "healthy") return { score: 40, reasons: [signedReason(40, "healthy preflight")] };
  return { score: 0, reasons: [] };
}
