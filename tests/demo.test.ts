import { describe, expect, it } from "vitest";
import { StaticDemoAdapter } from "../src/sources/demo";

describe("public-domain demo source", () => {
  it("points Stremio at the playable MP4 instead of the subtitle file", async () => {
    const streams = await new StaticDemoAdapter().searchMovie({
      imdbId: "tt1254207",
      metadata: { imdbId: "tt1254207", title: "Big Buck Bunny" },
    });

    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({
      infoHash: "dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c",
      fileIdx: 1,
      sizeBytes: 276_134_947,
      resolution: "1080p",
      codec: "h264",
      audio: ["ac3"],
    });
  });
});
