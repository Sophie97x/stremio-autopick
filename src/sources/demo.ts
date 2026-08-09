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
  candidate("Big.Buck.Bunny.2008.2160p.WEB-DL.HDR10.HEVC.EAC3-DEMO", {
    infoHash: "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
    fileIdx: 0,
    sizeBytes: 5.2 * 1024 ** 3,
    seeders: 42,
    trackers: ["tracker:udp://tracker.opentrackr.org:1337/announce"],
  }),
  candidate("Big.Buck.Bunny.2008.1080p.WEB-DL.x264.AAC-DEMO", {
    infoHash: "c9e15763f722f23e98a29decdfae341b98d53056",
    fileIdx: 0,
    sizeBytes: 1.1 * 1024 ** 3,
    seeders: 120,
    trackers: ["tracker:udp://tracker.opentrackr.org:1337/announce"],
  }),
  candidate("Big.Buck.Bunny.2008.720p.WEBRip.x264.AAC-DEMO", {
    infoHash: "a1b2c3d4e5f6789012345678901234567890abcd",
    fileIdx: 0,
    sizeBytes: 420 * 1024 ** 2,
    seeders: 200,
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
