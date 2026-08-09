import type { StreamCandidate } from "../core/candidate";
import type { EpisodeMetadata, MovieMetadata } from "../metadata/types";

export interface MovieContext {
  imdbId: string;
  metadata: MovieMetadata;
}

export interface EpisodeContext {
  imdbId: string;
  season: number;
  episode: number;
  metadata: EpisodeMetadata;
}

export interface TorrentSourceAdapter {
  id: string;
  name: string;
  priority: number;
  searchMovie(context: MovieContext): Promise<StreamCandidate[]>;
  searchEpisode(context: EpisodeContext): Promise<StreamCandidate[]>;
}
