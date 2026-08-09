import { describe, expect, it } from "vitest";
import { parseReleaseName, parseSeedersFromText, parseSizeFromText } from "../src/core/parser";

const fixtures: Array<[string, Record<string, unknown>]> = [
  ["Example.Movie.2026.2160p.WEB-DL.DV.HDR10.HEVC.TrueHD.Atmos-GROUP", { year: 2026, resolution: "2160p", codec: "hevc", releaseType: "webdl", releaseGroup: "GROUP" }],
  ["Film 2024 4K WEB-DL HDR10+ x265 EAC3-TEAM", { resolution: "2160p", codec: "hevc", releaseType: "webdl" }],
  ["Film.1080p.BluRay.x264.DTS-HD.MA-Group", { resolution: "1080p", codec: "h264", releaseType: "bluray" }],
  ["Film_720p_WEBRip_AV1_AAC", { resolution: "720p", codec: "av1", releaseType: "webrip" }],
  ["Film 480p DVDRip AC3", { resolution: "480p", releaseType: "dvd" }],
  ["Film.UHD.Remux.DOVI.TrueHD.Atmos-RLS", { resolution: "2160p", releaseType: "remux" }],
  ["Film.2160p.H.265.WEB-DL", { codec: "hevc" }],
  ["Film.2160p.H265.WEB-DL", { codec: "hevc" }],
  ["Film.1080p.H.264.WEBRip", { codec: "h264" }],
  ["Film.1080p.AVC.BluRay", { codec: "h264" }],
  ["Film.1080p.AV01.WEB-DL", { codec: "av1" }],
  ["Film.2160p.HDR.WEB-DL", { resolution: "2160p" }],
  ["Film.2160p.HLG.WEB-DL", { resolution: "2160p" }],
  ["Film.2026.CAM.x264", {}],
  ["Film.2026.TS.x264", { codec: "h264" }],
  ["Film.2026.TELECINE", {}],
  ["Film.2026.SCREENER", {}],
  ["Show.S02E06.1080p.WEB-DL", { season: 2, episode: 6 }],
  ["Show.2x06.720p.HDTV", { season: 2, episode: 6 }],
  ["Show Season 2 Episode 6 1080p", { season: 2, episode: 6 }],
  ["Show.S02.Complete.1080p.BluRay", { season: 2, isSeasonPack: true }],
  ["Show Season 02 Pack 1080p", { season: 2, isSeasonPack: true }],
  ["Show.Complete.Series.1080p", { isFullSeriesPack: true }],
  ["Show.S01-S05.Complete.1080p", { isFullSeriesPack: true }],
  ["Movie.English.1080p.WEB-DL", { languages: ["en"] }],
  ["Movie.FRENCH.1080p.WEB-DL", { languages: ["fr"] }],
  ["Movie.English.German.MULTI.1080p", { languages: ["en", "de"] }],
  ["Movie.TrueHD.7.1.1080p", {}],
  ["Movie.DTS-X.1080p", {}],
  ["Movie.DDP5.1.1080p", {}],
  ["movie__2025__4k__webdl__dv__x265__atmos", { year: 2025, resolution: "2160p", codec: "hevc", releaseType: "webdl" }],
  ["Special.S00E01.1080p.WEB-DL", { season: 0, episode: 1 }],
];

describe("release-name parser", () => {
  it.each(fixtures)("parses %s", (title, expected) => {
    expect(parseReleaseName(title)).toMatchObject(expected);
  });

  it("extracts HDR variants without confusing HDR10+", () => {
    expect(parseReleaseName("Movie.2160p.DV.HDR10.HEVC").hdr).toEqual(["dolbyVision", "hdr10"]);
    expect(parseReleaseName("Movie.2160p.HDR10Plus.HEVC").hdr).toEqual(["hdr10plus"]);
    expect(parseReleaseName("Movie.2160p.HLG.HEVC").hdr).toEqual(["hlg"]);
  });

  it("extracts detailed audio", () => {
    expect(parseReleaseName("Movie.TrueHD.Atmos").audio).toEqual(expect.arrayContaining(["atmosTruehd", "truehd"]));
    expect(parseReleaseName("Movie.DTS-HD.MA").audio).toEqual(expect.arrayContaining(["dtshdma", "dtshd", "dts"]));
    expect(parseReleaseName("Movie.DTS:X").audio).toContain("dtsx");
    expect(parseReleaseName("Movie.EAC3.DD+").audio).toContain("eac3");
  });

  it("detects undesirable capture labels", () => {
    expect(parseReleaseName("Film.CAM").undesirableQuality).toContain("cam");
    expect(parseReleaseName("Film.TS").undesirableQuality).toContain("ts");
    expect(parseReleaseName("Film.TELECINE").undesirableQuality).toContain("telecine");
    expect(parseReleaseName("Film.SCREENER").undesirableQuality).toContain("screener");
  });

  it("never throws on strange input", () => {
    expect(() => parseReleaseName(null)).not.toThrow();
    expect(() => parseReleaseName({ title: "nope" })).not.toThrow();
    expect(parseReleaseName("\u0000...---___")).toMatchObject({ hdr: [], audio: [], languages: [] });
  });

  it("parses sizes and seeder counts from descriptions", () => {
    expect(parseSizeFromText("Quality • 24.5 GB • Seeders 10")).toBe(Math.round(24.5 * 1024 ** 3));
    expect(parseSizeFromText("700 MiB | video")).toBe(700 * 1024 ** 2);
    expect(parseSeedersFromText("Seeders: 110")).toBe(110);
    expect(parseSeedersFromText("🌱 42"),).toBe(42);
  });
});
