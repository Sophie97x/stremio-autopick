import "dotenv/config";
import path from "node:path";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import sdk from "stremio-addon-sdk";
import { manifest } from "./addon/manifest";
import { createAddonInterface } from "./addon/stremio";
import { StreamService } from "./addon/streamHandler";
import { ConfigError, decodeConfig, encodeConfig, validateConfig } from "./config/encode";
import { defaultConfig, presetConfigs } from "./config/defaults";
import { loadEnv, type AppEnv } from "./env";
import { createLogger } from "./logger";
import { CinemetaMetadataResolver } from "./metadata/resolver";
import { assertConfigSourcesAllowed, parseAllowedUpstreamHosts, SourcePolicyError } from "./security/upstreamPolicy";
import { DiscoveryService } from "./sources/discovery";

export const STREAM_CACHE_SECONDS = 5 * 60;

export interface CreateAppOptions {
  env?: AppEnv;
  streamService?: StreamService;
}

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function installUrl(manifestUrl: string): string {
  return manifestUrl.replace(/^https?:\/\//, "stremio://");
}

const securityHeaders: RequestHandler = (_request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'",
  );
  next();
};

function isConfiguredStreamPath(url: string): boolean {
  return /^\/[^/?]+\/stream\/(?:movie|series)\/[^?]+\.json(?:\?|$)/.test(url);
}

function isConfiguredManifestPath(url: string): boolean {
  return /^\/[^/?]+\/manifest\.json(?:\?|$)/.test(url);
}

function streamConcurrencyLimit(maxConcurrent: number): RequestHandler {
  let active = 0;
  return (request, response, next) => {
    if (!isConfiguredStreamPath(request.url)) {
      next();
      return;
    }
    if (active >= maxConcurrent) {
      response.setHeader("Retry-After", "2");
      response.setHeader("Cache-Control", "no-store");
      response.status(503).json({ error: "AutoPick is busy; try again shortly" });
      return;
    }
    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
    };
    response.once("finish", release);
    response.once("close", release);
    next();
  };
}

const cacheHeaders: RequestHandler = (request, response, next) => {
  if (isConfiguredStreamPath(request.url)) {
    response.setHeader("Cache-Control", `public, max-age=${STREAM_CACHE_SECONDS}, s-maxage=${STREAM_CACHE_SECONDS}`);
  } else if (request.path === "/manifest.json") {
    response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  } else if (request.path.startsWith("/assets/")) {
    response.setHeader("Cache-Control", "public, max-age=86400");
  } else if (
    request.path === "/" ||
    request.path === "/healthz" ||
    request.path.startsWith("/api/") ||
    request.path.includes("/configure") ||
    isConfiguredManifestPath(request.url)
  ) {
    response.setHeader("Cache-Control", "no-store");
  }
  next();
};

export function createApp(options: CreateAppOptions = {}): express.Express {
  const env = options.env ?? loadEnv();
  const logger = createLogger(env);
  const resolver = new CinemetaMetadataResolver();
  const discovery = new DiscoveryService(resolver, env, logger);
  const streamService = options.streamService ?? new StreamService(discovery, env, logger);
  const app = express();
  const baseUrl = cleanBaseUrl(env.BASE_URL);
  const uiDirectory = path.join(__dirname, "ui");

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb", strict: true }));
  app.use(securityHeaders);
  app.use(cacheHeaders);
  app.use(streamConcurrencyLimit(env.MAX_CONCURRENT_STREAM_REQUESTS));

  app.get("/", (_request, response) => response.redirect(302, "/configure"));
  app.get("/healthz", (_request, response) => response.json({ status: "ok", version: manifest.version }));
  app.get("/assets/logo.svg", (_request, response) => response.sendFile(path.join(uiDirectory, "logo.svg")));

  app.get("/configure/styles.css", (_request, response) => response.sendFile(path.join(uiDirectory, "styles.css")));
  app.get("/configure/app.js", (_request, response) => {
    response.type("application/javascript");
    response.sendFile(path.join(uiDirectory, env.NODE_ENV === "production" ? "app.js" : "app.ts"));
  });
  app.get(["/configure", "/:config/configure"], (request, response, next) => {
    if (request.params.config) {
      try {
        const config = decodeConfig(request.params.config);
        assertConfigSourcesAllowed(config, env.UPSTREAM_ALLOWED_HOSTS);
      } catch (error) {
        next(error);
        return;
      }
    }
    response.sendFile(path.join(uiDirectory, "index.html"));
  });

  app.get("/api/presets", (_request, response) => {
    const policy = parseAllowedUpstreamHosts(env.UPSTREAM_ALLOWED_HOSTS);
    response.json({
      default: defaultConfig,
      presets: presetConfigs,
      capabilities: { allowedUpstreamHosts: policy.hosts, allowAnyUpstreamHost: policy.allowAny },
    });
  });
  app.get("/api/config/:config", (request, response, next) => {
    try {
      const config = decodeConfig(request.params.config);
      assertConfigSourcesAllowed(config, env.UPSTREAM_ALLOWED_HOSTS);
      response.json({ config });
    } catch (error) {
      next(error);
    }
  });
  app.post("/api/config/encode", (request, response, next) => {
    try {
      const config = validateConfig(request.body);
      assertConfigSourcesAllowed(config, env.UPSTREAM_ALLOWED_HOSTS);
      const encoded = encodeConfig(config);
      const manifestUrl = `${baseUrl}/${encoded}/manifest.json`;
      response.json({ config, encoded, manifestUrl, installUrl: installUrl(manifestUrl) });
    } catch (error) {
      next(error);
    }
  });

  const debugHandler: RequestHandler = async (request, response, next) => {
    if (!env.ENABLE_DEBUG) {
      response.status(404).json({ error: "Not found" });
      return;
    }
    try {
      const type = request.params.type;
      if (type !== "movie" && type !== "series") throw new ConfigError("Unsupported content type");
      const config = request.params.config ? decodeConfig(request.params.config) : defaultConfig;
      assertConfigSourcesAllowed(config, env.UPSTREAM_ALLOWED_HOSTS);
      const result = await streamService.rank({ type, id: request.params.id ?? "", config });
      response.json({
        winner: result.winner ?? null,
        candidates: result.ranked.map((candidate) => ({
          title: candidate.originalTitle,
          score: candidate.score,
          health: candidate.health,
          reasons: candidate.scoreReasons,
        })),
        rejected: result.rejected.map((entry) => ({ title: entry.candidate.originalTitle, reasons: entry.reasons })),
        dedupedCount: result.dedupedCount,
      });
    } catch (error) {
      next(error);
    }
  };
  app.get("/debug/rank/:type/:id", debugHandler);
  app.get("/:config/debug/rank/:type/:id", debugHandler);

  app.use((request, response, next) => {
    const match = request.url.match(/^\/([^/?]+)\/(manifest\.json|stream\/(?:movie|series)\/[^?]+\.json)(\?.*)?$/);
    if (!match?.[1] || !match[2]) {
      next();
      return;
    }
    try {
      const config = decodeConfig(match[1]);
      assertConfigSourcesAllowed(config, env.UPSTREAM_ALLOWED_HOSTS);
      request.url = `/${encodeURIComponent(JSON.stringify(config))}/${match[2]}${match[3] ?? ""}`;
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use(sdk.getRouter(createAddonInterface(streamService, baseUrl)));

  app.use((_request, response) => response.status(404).json({ error: "Not found" }));
  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    response.setHeader("Cache-Control", "no-store");
    if (error instanceof ConfigError || error instanceof SourcePolicyError) {
      response.status(400).json({ error: error.message });
      return;
    }
    logger.error({ event: "request_error", error: error instanceof Error ? error.message : "unknown" }, "Request failed");
    response.status(500).json({ error: "Internal server error" });
  };
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const env = loadEnv();
  const logger = createLogger(env);
  createApp({ env }).listen(env.PORT, "0.0.0.0", () => {
    logger.info({ event: "server_started", port: env.PORT }, "AutoPick is ready");
  });
}
