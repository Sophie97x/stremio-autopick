import type { AutoPickConfig, PresetName } from "./schema";

const shared: Omit<
  AutoPickConfig,
  "preset" | "resolutionOrder" | "enabledResolutions" | "sizes" | "availability"
> = {
  v: 1,
  mode: "simple",
  preferredQuality: "automatic",
  fallbackResolution: true,
  strictPreferredResolution: false,
  allowHigherResolution: false,
  hdrOrder: ["dolbyVision", "hdr10plus", "hdr10", "hlg", "sdr"],
  enabledHdr: ["dolbyVision", "hdr10plus", "hdr10", "hlg", "sdr"],
  requireHdr: false,
  codecOrder: ["hevc", "h264", "av1"],
  enabledCodecs: ["hevc", "h264", "av1"],
  releaseOrder: ["remux", "bluray", "webdl", "webrip", "hdtv", "dvd", "unknown"],
  blockedQualities: ["cam", "ts", "telecine", "screener"],
  audioOrder: ["atmosTruehd", "truehd", "dtsx", "dtshdma", "dtshd", "eac3", "atmos", "ac3", "dts", "aac"],
  preferredLanguage: "en",
  languageMode: "preferEnglish",
  strictLanguage: false,
  includeDemoSource: false,
  sources: [{ url: "https://torrentio.strem.fun/manifest.json", enabled: true, priority: 0 }],
  showBackups: false,
  backupCount: 3,
  healthCandidates: 3,
};

const presetOverrides: Record<
  PresetName,
  Partial<
    Pick<
      AutoPickConfig,
      | "resolutionOrder"
      | "enabledResolutions"
      | "hdrOrder"
      | "enabledHdr"
      | "codecOrder"
      | "enabledCodecs"
      | "audioOrder"
      | "sizes"
      | "availability"
      | "showBackups"
      | "backupCount"
      | "healthCandidates"
    >
  >
> = {
  balanced4k: {
    resolutionOrder: ["2160p", "1080p", "720p", "480p"],
    enabledResolutions: ["2160p", "1080p", "720p"],
    sizes: {
      movie: { softGb: 25, hardGb: 40 },
      episode: { softGb: 8, hardGb: 15 },
    },
    availability: { minimumSeeders: 5, unknownSeeders: "penalise" },
  },
  maximumQuality: {
    resolutionOrder: ["2160p", "1080p", "720p", "480p"],
    enabledResolutions: ["2160p", "1080p"],
    sizes: {
      movie: { softGb: 50, hardGb: 90 },
      episode: { softGb: 15, hardGb: 30 },
    },
    availability: { minimumSeeders: 3, unknownSeeders: "penalise" },
  },
  fastStart: {
    resolutionOrder: ["1080p", "720p", "2160p", "480p"],
    enabledResolutions: ["1080p", "720p"],
    sizes: {
      movie: { softGb: 8, hardGb: 15 },
      episode: { softGb: 2.5, hardGb: 5 },
    },
    availability: { minimumSeeders: 5, unknownSeeders: "penalise" },
  },
  tvStick: {
    resolutionOrder: ["1080p", "720p", "480p", "2160p"],
    enabledResolutions: ["1080p", "720p", "480p"],
    hdrOrder: ["sdr", "hdr10", "hlg", "hdr10plus", "dolbyVision"],
    enabledHdr: ["sdr"],
    codecOrder: ["h264", "hevc", "av1"],
    enabledCodecs: ["h264", "hevc"],
    audioOrder: ["ac3", "eac3", "aac", "dts", "atmos", "dtshd", "dtshdma", "dtsx", "truehd", "atmosTruehd"],
    sizes: {
      movie: { softGb: 6, hardGb: 12 },
      episode: { softGb: 2, hardGb: 4 },
    },
    availability: { minimumSeeders: 20, unknownSeeders: "penalise" },
    showBackups: true,
    backupCount: 3,
    healthCandidates: 5,
  },
  dataSaver: {
    resolutionOrder: ["1080p", "720p", "480p", "2160p"],
    enabledResolutions: ["1080p", "720p", "480p"],
    sizes: {
      movie: { softGb: 4, hardGb: 8 },
      episode: { softGb: 1, hardGb: 2.5 },
    },
    availability: { minimumSeeders: 3, unknownSeeders: "penalise" },
  },
};

export function createPresetConfig(preset: PresetName = "balanced4k"): AutoPickConfig {
  return structuredClone({ ...shared, preset, ...presetOverrides[preset] }) as AutoPickConfig;
}

export const presetConfigs: Record<PresetName, AutoPickConfig> = {
  balanced4k: createPresetConfig("balanced4k"),
  maximumQuality: createPresetConfig("maximumQuality"),
  fastStart: createPresetConfig("fastStart"),
  tvStick: createPresetConfig("tvStick"),
  dataSaver: createPresetConfig("dataSaver"),
};
