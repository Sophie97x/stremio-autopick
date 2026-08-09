import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

const weights = [15, 12, 11, 10, 9, 8, 7, 5, 4, 2];

export function audioScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  if (candidate.audio.length === 0) return { score: 0, reasons: [] };
  const chosen = [...candidate.audio].sort((a, b) => config.audioOrder.indexOf(a) - config.audioOrder.indexOf(b))[0];
  if (!chosen) return { score: 0, reasons: [] };
  const index = config.audioOrder.indexOf(chosen);
  const factor = config.preset === "maximumQuality" ? 1.45 : config.preset === "fastStart" ? 0.5 : config.preset === "dataSaver" ? 0.4 : 1;
  const score = Math.round((weights[index] ?? 0) * factor);
  return { score, reasons: score === 0 ? [] : [signedReason(score, chosen)] };
}
