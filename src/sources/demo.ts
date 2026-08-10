import type { StreamCandidate } from "../core/candidate";
import { parseReleaseName } from "../core/parser";
import type { EpisodeContext, MovieContext, TorrentSourceAdapter } from "./types";

function candidate(title: string, values: Partial<StreamCandidate>): StreamCandidate {
  const parsed = parseReleaseName(title);
  return {
    ...parsed,
    sourceId: "demo",
    sourceName: "Public Domain Demo",
    sourcePriority: 0,
    contributingSources: ["Public Domain Demo"],
    originalTitle: title,
    health: "unknown",
    ...values,
  };
}

const movieCandidates: StreamCandidate[] = [
  candidate("Big.Buck.Bunny.2008.1080p.WEBRip.H264.AC3-DEMO", {
    infoHash: "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    fileIdx: 1,
    sizeBytes: 276_134_947,
    trackers: ["tracker:udp://tracker.opentrackr.org:1337/announce"],
  }),
];

export class StaticDemoAdapter implements TorrentSourceAdapter {
  readonly id = "demo";
  readonly name = "Public Domain Demo";
  readonly priority = 0;

  async searchMovie(context: MovieContext): Promise<StreamCandidate[]> {
    if (context.imdbId !== "tt1254207") return [];
    return structuredClone(movieCandidates);
  }

  async searchEpisode(_context: EpisodeContext): Promise<StreamCandidate[]> {
    return [];
  }
}
