import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

export function sizeScore(
  candidate: StreamCandidate,
  config: AutoPickConfig,
  contentType: "movie" | "series",
): ScoreComponent {
  if (candidate.sizeBytes === undefined) {
    const score = config.preset === "fastStart" || config.preset === "dataSaver" ? -2 : 0;
    return { score, reasons: score ? [signedReason(score, "file size unknown")] : [] };
  }
  const sizeGb = candidate.sizeBytes / 1024 ** 3;
  const limits = contentType === "movie" ? config.sizes.movie : config.sizes.episode;
  if (sizeGb <= limits.softGb) {
    const rewardMax = config.preset === "fastStart" ? 8 : config.preset === "dataSaver" ? 12 : 0;
    const score = Math.round(rewardMax * Math.max(0, 1 - sizeGb / limits.softGb));
    return { score, reasons: score ? [signedReason(score, "efficient file size")] : [] };
  }
  const progress = Math.min(1, (sizeGb - limits.softGb) / Math.max(0.1, limits.hardGb - limits.softGb));
  const [base, range] =
    config.preset === "maximumQuality"
      ? [2, 8]
      : config.preset === "fastStart"
        ? [8, 32]
        : config.preset === "dataSaver"
          ? [12, 45]
          : [4, 18];
  const score = -Math.round(base + range * progress ** 1.25);
  return { score, reasons: [signedReason(score, "above preferred size")] };
}
