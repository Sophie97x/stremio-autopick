import type { AutoPickConfig, HdrFormat } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

const weights = [28, 24, 20, 12, 0];
const labels: Record<HdrFormat, string> = {
  dolbyVision: "Dolby Vision",
  hdr10plus: "HDR10+",
  hdr10: "HDR10",
  hlg: "HLG",
  sdr: "SDR",
};

export function hdrScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  const formats: HdrFormat[] = candidate.hdr.length > 0 ? candidate.hdr : ["sdr"];
  const chosen = [...formats].sort((a, b) => config.hdrOrder.indexOf(a) - config.hdrOrder.indexOf(b))[0] ?? "sdr";
  const index = config.hdrOrder.indexOf(chosen);
  const factor = config.preset === "maximumQuality" ? 1.45 : config.preset === "fastStart" ? 0.7 : config.preset === "dataSaver" ? 0.4 : 1;
  const score = Math.round((weights[index] ?? 0) * factor);
  return { score, reasons: score === 0 ? [] : [signedReason(score, labels[chosen])] };
}
