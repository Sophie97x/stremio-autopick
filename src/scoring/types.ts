export interface ScoreComponent {
  score: number;
  reasons: string[];
}

export const signedReason = (score: number, text: string): string => `${score >= 0 ? "+" : ""}${Math.round(score)} ${text}`;
