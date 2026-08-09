import type { AutoPickConfig } from "../config/schema";
import type { StreamCandidate } from "../core/candidate";
import { signedReason, type ScoreComponent } from "./types";

export function languageScore(candidate: StreamCandidate, config: AutoPickConfig): ScoreComponent {
  if (config.languageMode === "any" || candidate.languages.length === 0) return { score: 0, reasons: [] };
  const preferred = config.preferredLanguage.split("-")[0] ?? config.preferredLanguage;
  const score = candidate.languages.includes(preferred) ? 6 : -4;
  return { score, reasons: [signedReason(score, score > 0 ? "preferred language" : "other language")] };
}
