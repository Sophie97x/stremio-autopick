export interface MovieMetadata {
  imdbId: string;
  title: string;
  year?: number;
}

export interface EpisodeMetadata {
  imdbId: string;
  title: string;
  seriesTitle?: string;
  season: number;
  episode: number;
}

export interface MetadataResolver {
  resolveMovie(imdbId: string): Promise<MovieMetadata>;
  resolveEpisode(imdbId: string, season: number, episode: number): Promise<EpisodeMetadata>;
}
