export const manifest = {
  id: "community.autopick",
  version: "1.2.0",
  name: "AutoPick",
  description: "One stream. The right stream. Automatically ranks torrent streams using your stateless preferences.",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: true,
    p2p: true,
  },
  config: [
    {
      key: "autopick",
      type: "text",
      title: "Use the AutoPick configuration page",
      required: false,
    },
  ],
};

export function createManifest(baseUrl?: string) {
  return {
    ...manifest,
    ...(baseUrl ? { logo: `${baseUrl.replace(/\/+$/, "")}/assets/logo.svg` } : {}),
  };
}
