import { expect, it } from "vitest";
import { trimTrailingCharacter } from "../src/security/strings";
import { createManifest } from "../src/addon/manifest";
import { parseAllowedUpstreamHosts } from "../src/security/upstreamPolicy";

it("preserves normal URLs and strips only repeated trailing delimiters", () => {
  expect(trimTrailingCharacter("https://example.com/a///", "/")).toBe("https://example.com/a");
  expect(trimTrailingCharacter("", "/")).toBe("");
  expect(createManifest("https://example.com///").logo).toBe("https://example.com/assets/logo.svg");
  expect(parseAllowedUpstreamHosts(" EXAMPLE.COM... ").hosts).toEqual(["example.com"]);
});
it("handles long adversarial delimiter runs without an unanchored regex", () => {
  const long = "https://example.com/" + "/".repeat(200_000) + "x";
  expect(trimTrailingCharacter(long, "/")).toBe(long);
  const host = "a" + ".".repeat(200_000) + "x";
  expect(parseAllowedUpstreamHosts(host).hosts).toEqual([host]);
  expect(trimTrailingCharacter("/".repeat(200_000), "/")).toBe("");
});
