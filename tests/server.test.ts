import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { StreamService } from "../src/addon/streamHandler";
import { defaultConfig } from "../src/config/defaults";
import { encodeConfig } from "../src/config/encode";
import { createApp, STREAM_CACHE_SECONDS } from "../src/server";
import { testEnv } from "./helpers";

describe("public server safeguards", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  async function listen(streamService?: StreamService, maxConcurrent = 32): Promise<string> {
    const server = createApp({
      env: testEnv({
        BASE_URL: "https://autopick.click",
        UPSTREAM_ALLOWED_HOSTS: "torrentio.strem.fun",
        MAX_CONCURRENT_STREAM_REQUESTS: maxConcurrent,
      }),
      ...(streamService ? { streamService } : {}),
    }).listen(0, "127.0.0.1");
    servers.push(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  it("reports the 1.1.0 version and public source capability", async () => {
    const baseUrl = await listen();
    const healthResponse = await fetch(`${baseUrl}/healthz`);
    expect(await healthResponse.json()).toEqual({ status: "ok", version: "1.1.0" });
    expect(healthResponse.headers.get("cache-control")).toBe("no-store");

    const presets = await fetch(`${baseUrl}/api/presets`).then((response) => response.json()) as {
      capabilities: { allowedUpstreamHosts: string[]; allowAnyUpstreamHost: boolean };
    };
    expect(presets.capabilities).toEqual({
      allowedUpstreamHosts: ["torrentio.strem.fun"],
      allowAnyUpstreamHost: false,
    });
  });

  it("rejects disallowed sources in encoded and crafted configured URLs", async () => {
    const baseUrl = await listen();
    const disallowed = structuredClone(defaultConfig);
    disallowed.sources = [{ url: "https://torrentio.strem.fun.evil.example/manifest.json", enabled: true, priority: 0 }];
    const encodedResponse = await fetch(`${baseUrl}/api/config/encode`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(disallowed),
    });
    expect(encodedResponse.status).toBe(400);

    const token = encodeConfig(disallowed);
    const craftedResponse = await fetch(`${baseUrl}/${token}/stream/movie/tt1254207.json`);
    expect(craftedResponse.status).toBe(400);
    expect(craftedResponse.headers.get("cache-control")).toBe("no-store");

    const configResponse = await fetch(`${baseUrl}/api/config/${token}`);
    expect(configResponse.status).toBe(400);

    const configureResponse = await fetch(`${baseUrl}/${token}/configure`);
    expect(configureResponse.status).toBe(400);
  });

  it("caps concurrent stream requests and applies five-minute caching", async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const handling = new Promise<void>((resolve) => { started = resolve; });
    const streamService = {
      handle: async () => {
        started();
        await gate;
        return { streams: [] };
      },
    } as unknown as StreamService;
    const baseUrl = await listen(streamService, 1);
    const token = encodeConfig(defaultConfig);
    const url = `${baseUrl}/${token}/stream/movie/tt1254207.json`;

    const first = fetch(url);
    await handling;
    const busy = await fetch(url);
    expect(busy.status).toBe(503);
    expect(busy.headers.get("retry-after")).toBe("2");
    expect(busy.headers.get("cache-control")).toBe("no-store");

    release();
    const completed = await first;
    expect(completed.status).toBe(200);
    expect(completed.headers.get("cache-control")).toBe(
      `public, max-age=${STREAM_CACHE_SECONDS}, s-maxage=${STREAM_CACHE_SECONDS}`,
    );
  });

  it("keeps settings routes private while caching the public root manifest", async () => {
    const baseUrl = await listen();
    const rootManifest = await fetch(`${baseUrl}/manifest.json`);
    expect(rootManifest.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");

    const token = encodeConfig(defaultConfig);
    const configuredManifest = await fetch(`${baseUrl}/${token}/manifest.json`);
    expect(configuredManifest.headers.get("cache-control")).toBe("no-store");
    const configure = await fetch(`${baseUrl}/configure`);
    expect(configure.headers.get("cache-control")).toBe("no-store");
    const asset = await fetch(`${baseUrl}/assets/logo.svg`);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=86400");
  });
});
