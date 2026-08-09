import { describe, expect, it } from "vitest";
import { manifest } from "../src/addon/manifest";

describe("Stremio manifest", () => {
  it("declares only the required stream capability", () => {
    expect(manifest.resources).toEqual(["stream"]);
    expect(manifest.types).toEqual(["movie", "series"]);
    expect(manifest.idPrefixes).toEqual(["tt"]);
    expect(manifest.catalogs).toEqual([]);
    expect(manifest.behaviorHints).toMatchObject({ configurable: true, configurationRequired: true, p2p: true });
  });
});
