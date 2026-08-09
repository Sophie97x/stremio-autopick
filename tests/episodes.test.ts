import { describe, expect, it } from "vitest";
import { hardFilterCandidates, matchesEpisode } from "../src/core/filters";
import { config, makeCandidate } from "./helpers";

describe("episode safety", () => {
  const target = { season: 2, episode: 6 };

  it("accepts a normal exact episode torrent", () => {
    expect(matchesEpisode(makeCandidate("Show.S02E06.1080p.WEB-DL", { seeders: 10 }), target)).toBe(true);
  });

  it("accepts a season pack only with the matching season and fileIdx", () => {
    expect(matchesEpisode(makeCandidate("Show.S02.Complete.1080p", { fileIdx: 6 }), target)).toBe(true);
    expect(matchesEpisode(makeCandidate("Show.S02.Complete.1080p"), target)).toBe(false);
    expect(matchesEpisode(makeCandidate("Show.S03.Complete.1080p", { fileIdx: 6 }), target)).toBe(false);
  });

  it("accepts a full-series pack only when upstream identified a file", () => {
    expect(matchesEpisode(makeCandidate("Show.Complete.Series.1080p", { fileIdx: 21 }), target)).toBe(true);
    expect(matchesEpisode(makeCandidate("Show.Complete.Series.1080p"), target)).toBe(false);
  });

  it("rejects an unverified multi-video/pack result", () => {
    const candidate = makeCandidate("Show.Season.2.Pack.1080p", { seeders: 20 });
    const result = hardFilterCandidates([candidate], config(), "series", target);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0]?.reasons).toContain("wrong or unverified episode file");
  });

  it("supports specials as season zero", () => {
    expect(matchesEpisode(makeCandidate("Show.S00E03.1080p.WEB-DL"), { season: 0, episode: 3 })).toBe(true);
  });
});
