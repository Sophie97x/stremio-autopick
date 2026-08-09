import { z } from "zod";

export const RESOLUTIONS = ["2160p", "1080p", "720p", "480p"] as const;
export const HDR_FORMATS = ["dolbyVision", "hdr10plus", "hdr10", "hlg", "sdr"] as const;
export const CODECS = ["hevc", "h264", "av1"] as const;
export const RELEASE_TYPES = ["remux", "bluray", "webdl", "webrip", "hdtv", "dvd", "unknown"] as const;
export const AUDIO_FORMATS = [
  "atmosTruehd",
  "truehd",
  "dtsx",
  "dtshdma",
  "dtshd",
  "eac3",
  "atmos",
  "ac3",
  "dts",
  "aac",
] as const;
export const UNDESIRABLE_QUALITIES = ["cam", "ts", "telecine", "screener"] as const;
export const PRESETS = ["balanced4k", "maximumQuality", "fastStart", "dataSaver"] as const;

const completeOrder = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .length(values.length)
    .refine((items) => new Set(items).size === values.length, "Every option must appear exactly once");

const enabledList = <T extends readonly [string, ...string[]]>(values: T) =>
  z.array(z.enum(values)).min(1).max(values.length).refine((items) => new Set(items).size === items.length, "Duplicate option");

const sizeLimitSchema = z
  .object({
    softGb: z.number().finite().positive().max(250),
    hardGb: z.number().finite().positive().max(250),
  })
  .strict()
  .refine((value) => value.hardGb >= value.softGb, {
    message: "Hard maximum must be at least the soft target",
    path: ["hardGb"],
  });

function isAllowedUpstreamUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export const upstreamSourceSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .refine(isAllowedUpstreamUrl, "Use HTTPS, or HTTP only for localhost development"),
    enabled: z.boolean(),
    priority: z.number().int().min(0).max(99),
  })
  .strict();

export const configSchema = z
  .object({
    v: z.literal(1),
    mode: z.enum(["simple", "advanced"]),
    preset: z.enum(PRESETS),
    preferredQuality: z.enum(["automatic", "2160p", "1080p", "720p"]),
    fallbackResolution: z.boolean(),
    strictPreferredResolution: z.boolean(),
    allowHigherResolution: z.boolean(),
    resolutionOrder: completeOrder(RESOLUTIONS),
    enabledResolutions: enabledList(RESOLUTIONS),
    hdrOrder: completeOrder(HDR_FORMATS),
    enabledHdr: enabledList(HDR_FORMATS),
    requireHdr: z.boolean(),
    codecOrder: completeOrder(CODECS),
    enabledCodecs: enabledList(CODECS),
    releaseOrder: completeOrder(RELEASE_TYPES),
    blockedQualities: z
      .array(z.enum(UNDESIRABLE_QUALITIES))
      .max(UNDESIRABLE_QUALITIES.length)
      .refine((items) => new Set(items).size === items.length, "Duplicate blocked quality"),
    audioOrder: completeOrder(AUDIO_FORMATS),
    preferredLanguage: z.string().trim().min(2).max(12).regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
    languageMode: z.enum(["englishOnly", "preferEnglish", "any"]),
    strictLanguage: z.boolean(),
    sizes: z
      .object({
        movie: sizeLimitSchema,
        episode: sizeLimitSchema,
      })
      .strict(),
    availability: z
      .object({
        minimumSeeders: z.number().int().min(0).max(10_000),
        unknownSeeders: z.enum(["allow", "penalise", "reject"]),
      })
      .strict(),
    includeDemoSource: z.boolean(),
    sources: z.array(upstreamSourceSchema).max(8),
    showBackups: z.boolean(),
    backupCount: z.number().int().min(1).max(3),
    healthCandidates: z.number().int().min(1).max(5),
  })
  .strict()
  .superRefine((value, context) => {
    const enabledUrls = value.sources.filter((source) => source.enabled).map((source) => source.url);
    if (new Set(enabledUrls).size !== enabledUrls.length) {
      context.addIssue({ code: "custom", path: ["sources"], message: "Enabled source URLs must be unique" });
    }
  });

export type AutoPickConfig = z.infer<typeof configSchema>;
export type PresetName = (typeof PRESETS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];
export type HdrFormat = (typeof HDR_FORMATS)[number];
export type Codec = (typeof CODECS)[number];
export type ReleaseType = (typeof RELEASE_TYPES)[number];
export type AudioFormat = (typeof AUDIO_FORMATS)[number];
export type UndesirableQuality = (typeof UNDESIRABLE_QUALITIES)[number];
