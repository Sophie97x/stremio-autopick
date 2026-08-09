import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

const weights = [30, 25, 22, 12, 5, 2, 0];

export function releaseQualityScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  const release = candidate.releaseType ?? "unknown";
  const index = config.releaseOrder.indexOf(release);
  let score = weights[index] ?? 0;
  if (config.preset === "maximumQuality") {
    if (release === "remux") score += 18;
    else if (release === "bluray") score += 11;
    else if (release === "webdl") score += 4;
  } else if (config.preset === "fastStart") {
    score = Math.round(score * 0.55);
  } else if (config.preset === "dataSaver" && release === "remux") {
    score -= 12;
  }
  return { score, reasons: score === 0 ? [] : [signedReason(score, release === "webdl" ? "WEB-DL" : release)] };
}
