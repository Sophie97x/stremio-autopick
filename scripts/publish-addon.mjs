import sdk from "stremio-addon-sdk";

const manifestUrl = process.env.PUBLIC_MANIFEST_URL;
if (!manifestUrl) {
  throw new Error("Set PUBLIC_MANIFEST_URL to the public HTTPS /manifest.json URL");
}

const url = new URL(manifestUrl);
if (url.protocol !== "https:" || !url.pathname.endsWith("/manifest.json")) {
  throw new Error("PUBLIC_MANIFEST_URL must be a public HTTPS manifest URL");
}

await sdk.publishToCentral(url.toString());
console.log("Submitted to the Stremio addon collection.");
