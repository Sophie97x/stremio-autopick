import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { manifest } from "../src/addon/manifest";

describe("Stremio manifest", () => {
  it("declares only the required stream capability", () => {
    expect(manifest.resources).toEqual(["stream"]);
    expect(manifest.types).toEqual(["movie", "series"]);
    expect(manifest.idPrefixes).toEqual(["tt"]);
    expect(manifest.catalogs).toEqual([]);
    expect(manifest.behaviorHints).toMatchObject({ configurable: true, configurationRequired: true, p2p: true });
    expect(manifest.id).toBe("community.autopick");
    expect(manifest.version).toBe("1.1.0");
    expect(manifest.version).toBe(packageJson.version);
  });
});
