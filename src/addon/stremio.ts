import sdk from "stremio-addon-sdk";
import { createManifest } from "./manifest";
import type { StreamService } from "./streamHandler";

export function createAddonInterface(streamService: StreamService, baseUrl?: string) {
  const builder = new sdk.addonBuilder(createManifest(baseUrl) as any);
  builder.defineStreamHandler(((args: { type: string; id: string; config?: unknown }) => streamService.handle(args)) as any);
  return builder.getInterface();
}
