import type { AudioFormat, Codec, HdrFormat, ReleaseType, Resolution, UndesirableQuality } from "../config/schema";

export type CandidateHealth = "healthy" | "unknown" | "failed";

export interface StreamCandidate {
  sourceId: string;
  sourceName: string;
  sourcePriority: number;
  contributingSources: string[];
  originalTitle: string;
  infoHash?: string;
  fileIdx?: number;
  trackers?: string[];
  sizeBytes?: number;
  seeders?: number;
  peers?: number;
  year?: number;
  resolution?: Resolution;
  hdr: Exclude<HdrFormat, "sdr">[];
  codec?: Codec;
  releaseType?: ReleaseType;
  undesirableQuality: UndesirableQuality[];
  audio: AudioFormat[];
  languages: string[];
  releaseGroup?: string;
  season?: number;
  episode?: number;
  isSeasonPack?: boolean;
  isFullSeriesPack?: boolean;
  score?: number;
  scoreReasons?: string[];
  health?: CandidateHealth;
}

export interface RankedCandidate extends StreamCandidate {
  score: number;
  scoreReasons: string[];
  health: CandidateHealth;
}
