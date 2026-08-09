import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

const weights = [10, 5, 2];

export function codecScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  if (!candidate.codec) return { score: 0, reasons: [] };
  const index = config.codecOrder.indexOf(candidate.codec);
  let score = weights[index] ?? 0;
  if (config.preset === "dataSaver" && (candidate.codec === "hevc" || candidate.codec === "av1")) score += 5;
  const text = index === 0 ? `preferred ${candidate.codec.toUpperCase()} codec` : `${candidate.codec.toUpperCase()} codec`;
  return { score, reasons: [signedReason(score, text)] };
}
