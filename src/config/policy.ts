import type { AutoPickConfig, Resolution } from "./schema";

const simpleFallbacks: Record<Exclude<AutoPickConfig["preferredQuality"], "automatic">, Resolution[]> = {
  "2160p": ["2160p", "1080p", "720p"],
  "1080p": ["1080p", "720p"],
  "720p": ["720p"],
};

export function effectiveResolutionOrder(config: AutoPickConfig): Resolution[] {
  let order: Resolution[];
  if (config.mode === "advanced") {
    order = config.resolutionOrder.filter((resolution) => config.enabledResolutions.includes(resolution));
    if (!config.allowHigherResolution && order[0]) {
      const height = { "2160p": 2160, "1080p": 1080, "720p": 720, "480p": 480 } as const;
      const preferredHeight = height[order[0]];
      order = order.filter((resolution) => height[resolution] <= preferredHeight);
    }
  } else if (config.preferredQuality === "automatic") {
    order = config.resolutionOrder.filter((resolution) => config.enabledResolutions.includes(resolution));
  } else {
    order = [...simpleFallbacks[config.preferredQuality]];
    if (config.preset === "tvStick") {
      order = order.filter((resolution) => config.enabledResolutions.includes(resolution));
    }
    if (config.allowHigherResolution) {
      for (const resolution of ["2160p", "1080p", "720p", "480p"] as const) {
        if (!order.includes(resolution) && (config.preset !== "tvStick" || config.enabledResolutions.includes(resolution))) {
          order.push(resolution);
        }
      }
    }
  }
  if (order.length === 0) return [];
  if (config.strictPreferredResolution || !config.fallbackResolution) return [order[0] as Resolution];
  return order;
}
