import type {
  AudioFormat,
  Codec,
  HdrFormat,
  ReleaseType,
  Resolution,
  UndesirableQuality,
} from "../config/schema";

export interface ParsedRelease {
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
  isSeasonPack: boolean;
  isFullSeriesPack: boolean;
}

const token = (value: string): string => value.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
const has = (value: string, expression: RegExp): boolean => expression.test(value);

function parseResolution(value: string): Resolution | undefined {
  if (has(value, /(?:^|\W)(?:2160p?|4k|uhd)(?:$|\W)/i)) return "2160p";
  if (has(value, /(?:^|\W)1080[pi]?(?:$|\W)/i)) return "1080p";
  if (has(value, /(?:^|\W)720[pi]?(?:$|\W)/i)) return "720p";
  if (has(value, /(?:^|\W)(?:480[pi]?|sd)(?:$|\W)/i)) return "480p";
  return undefined;
}

function parseHdr(value: string): Exclude<HdrFormat, "sdr">[] {
  const result: Exclude<HdrFormat, "sdr">[] = [];
  if (has(value, /(?:dolby[ ._-]*vision|(?:^|[ ._-])dovi(?:$|[ ._-])|(?:^|[ ._-])dv(?:$|[ ._-]))/i)) result.push("dolbyVision");
  if (has(value, /hdr[ ._-]*10(?:\+|[ ._-]*plus)/i)) result.push("hdr10plus");
  if (has(value, /hdr[ ._-]*10(?!\s*(?:\+|plus))/i) || has(value, /(?:^|[ ._-])hdr(?:$|[ ._-])/i)) result.push("hdr10");
  if (has(value, /(?:^|\W)hlg(?:$|\W)/i)) result.push("hlg");
  return result;
}

function parseCodec(value: string): Codec | undefined {
  if (has(value, /(?:^|\W)(?:av1|av01)(?:$|\W)/i)) return "av1";
  if (has(value, /(?:hevc|h[ .]?265|x265)/i)) return "hevc";
  if (has(value, /(?:avc|h[ .]?264|x264)/i)) return "h264";
  return undefined;
}

function parseReleaseType(value: string): ReleaseType | undefined {
  if (has(value, /(?:^|\W)remux(?:$|\W)/i)) return "remux";
  if (has(value, /(?:blu[ ._-]*ray|b[dr][ ._-]*rip|brrip)(?:$|\W)/i)) return "bluray";
  if (has(value, /(?:web[ ._-]*dl|webdl)(?:$|\W)/i)) return "webdl";
  if (has(value, /(?:web[ ._-]*rip|webrip)(?:$|\W)/i)) return "webrip";
  if (has(value, /(?:^|\W)hdtv(?:$|\W)/i)) return "hdtv";
  if (has(value, /(?:dvd[ ._-]*(?:rip|r)?|dvdrip)(?:$|\W)/i)) return "dvd";
  return undefined;
}

function parseUndesirable(value: string): UndesirableQuality[] {
  const result: UndesirableQuality[] = [];
  if (has(value, /(?:^|\W)(?:hd[ ._-]*)?cam(?:rip)?(?:$|\W)/i)) result.push("cam");
  if (has(value, /(?:^|[ ._-])(?:ts|telesync)(?:$|[ ._-])/i)) result.push("ts");
  if (has(value, /(?:^|\W)(?:tc|telecine)(?:$|\W)/i)) result.push("telecine");
  if (has(value, /(?:^|\W)(?:screener|dvdscr|scr)(?:$|\W)/i)) result.push("screener");
  return result;
}

function parseAudio(value: string): AudioFormat[] {
  const result: AudioFormat[] = [];
  const atmos = has(value, /(?:^|\W)atmos(?:$|\W)/i);
  const truehd = has(value, /true[ ._-]*hd/i);
  if (atmos && truehd) result.push("atmosTruehd");
  if (truehd) result.push("truehd");
  if (has(value, /dts[ ._-]*(?::[ ._-]*x|x)(?:$|\W)/i)) result.push("dtsx");
  if (has(value, /dts[ ._-]*hd[ ._-]*(?:ma|master)/i)) result.push("dtshdma");
  if (has(value, /dts[ ._-]*hd/i)) result.push("dtshd");
  if (has(value, /(?:e[ ._-]*ac[ ._-]*3|eac3|ddp|dd\+|dolby[ ._-]*digital[ ._-]*plus)/i)) result.push("eac3");
  if (atmos && !truehd) result.push("atmos");
  if (has(value, /(?:^|[^e\w])(?:ac[ ._-]*3|dd)(?:$|\W)/i)) result.push("ac3");
  if (has(value, /(?:^|\W)dts(?:$|\W|[ ._-])/i)) result.push("dts");
  if (has(value, /(?:^|\W)aac(?:2[ .]?0|5[ .]?1)?(?:$|\W)/i)) result.push("aac");
  return [...new Set(result)];
}

const languagePatterns: Array<[string, RegExp]> = [
  ["en", /(?:^|\W)(?:english|eng)(?:$|\W)/i],
  ["fr", /(?:^|\W)(?:french|fre|fra)(?:$|\W)/i],
  ["es", /(?:^|\W)(?:spanish|spa|esp|castellano)(?:$|\W)/i],
  ["de", /(?:^|\W)(?:german|ger|deu)(?:$|\W)/i],
  ["it", /(?:^|\W)(?:italian|ita)(?:$|\W)/i],
  ["ja", /(?:^|\W)(?:japanese|jpn)(?:$|\W)/i],
  ["ko", /(?:^|\W)(?:korean|kor)(?:$|\W)/i],
  ["hi", /(?:^|\W)(?:hindi|hin)(?:$|\W)/i],
  ["pt", /(?:^|\W)(?:portuguese|por|pt[ ._-]*br)(?:$|\W)/i],
  ["ru", /(?:^|\W)(?:russian|rus)(?:$|\W)/i],
  ["nl", /(?:^|\W)(?:dutch|nld)(?:$|\W)/i],
];

function parseLanguages(value: string): string[] {
  return languagePatterns.filter(([, expression]) => expression.test(value)).map(([language]) => language);
}

function parseEpisode(value: string): Pick<ParsedRelease, "season" | "episode" | "isSeasonPack" | "isFullSeriesPack"> {
  const normal = value.match(/(?:^|\W)s(\d{1,2})[ ._-]*e(\d{1,3})(?:$|\W)/i);
  const alternate = value.match(/(?:^|\W)(\d{1,2})x(\d{1,3})(?:$|\W)/i);
  const words = value.match(/season[ ._-]*(\d{1,2})[ ._-]*(?:episode|ep)[ ._-]*(\d{1,3})/i);
  const match = normal ?? alternate ?? words;
  if (match) {
    return {
      season: Number.parseInt(match[1] ?? "0", 10),
      episode: Number.parseInt(match[2] ?? "0", 10),
      isSeasonPack: false,
      isFullSeriesPack: false,
    };
  }

  const fullSeries = has(value, /(?:complete[ ._-]*(?:series|collection)|full[ ._-]*series|s\d{1,2}[ ._-]*-[ ._-]*s\d{1,2}|seasons?[ ._-]*\d+[ ._-]*-[ ._-]*\d+)/i);
  if (fullSeries) return { isSeasonPack: false, isFullSeriesPack: true };

  const seasonPack = value.match(/(?:s(\d{1,2})|season[ ._-]*(\d{1,2})).{0,24}(?:complete|pack|season)/i);
  if (seasonPack) {
    return {
      season: Number.parseInt(seasonPack[1] ?? seasonPack[2] ?? "0", 10),
      isSeasonPack: true,
      isFullSeriesPack: false,
    };
  }
  return { isSeasonPack: false, isFullSeriesPack: false };
}

export function parseReleaseName(input: unknown): ParsedRelease {
  try {
    const original = typeof input === "string" ? input.slice(0, 10_000) : "";
    const value = token(original);
    const yearMatch = value.match(/(?:^|\W)((?:19|20)\d{2})(?:$|\W)/);
    const groupMatch = original.match(/[-–]([A-Za-z0-9][A-Za-z0-9._]{1,30})\s*$/);
    const episode = parseEpisode(value);
    const resolution = parseResolution(value);
    const codec = parseCodec(value);
    const releaseType = parseReleaseType(value);
    return {
      ...(yearMatch?.[1] ? { year: Number.parseInt(yearMatch[1], 10) } : {}),
      ...(resolution ? { resolution } : {}),
      hdr: parseHdr(value),
      ...(codec ? { codec } : {}),
      ...(releaseType ? { releaseType } : {}),
      undesirableQuality: parseUndesirable(value),
      audio: parseAudio(value),
      languages: parseLanguages(value),
      ...(groupMatch?.[1] ? { releaseGroup: groupMatch[1] } : {}),
      ...episode,
    };
  } catch {
    return { hdr: [], undesirableQuality: [], audio: [], languages: [], isSeasonPack: false, isFullSeriesPack: false };
  }
}

export function parseSizeFromText(input: unknown): number | undefined {
  if (typeof input !== "string") return undefined;
  const match = input.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(TB|GB|GiB|MB|MiB)(?:$|\s|[|•,;)])/i);
  if (!match?.[1] || !match[2]) return undefined;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return undefined;
  const unit = match[2].toLowerCase();
  const multiplier = unit.startsWith("t") ? 1024 ** 4 : unit.startsWith("g") ? 1024 ** 3 : 1024 ** 2;
  return Math.round(value * multiplier);
}

export function parseSeedersFromText(input: unknown): number | undefined {
  if (typeof input !== "string") return undefined;
  const patterns = [
    /(?:seeders?|seeds?)\s*[:=]?\s*(\d{1,7})/i,
    /(?:👤|🌱|⬆)\s*(\d{1,7})/u,
    /(\d{1,7})\s*(?:seeders?|seeds?)/i,
  ];
  for (const expression of patterns) {
    const match = input.match(expression);
    if (match?.[1]) return Number.parseInt(match[1], 10);
  }
  return undefined;
}
