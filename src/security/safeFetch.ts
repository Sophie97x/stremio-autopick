import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import ipaddr from "ipaddr.js";

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
  maxRedirects?: number;
  allowPrivate?: boolean;
}

export class SafeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

async function resolveAddress(url: URL, allowPrivate: boolean): Promise<{ address: string; family: number }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError("Upstream hostname could not be resolved");
  }
  if (addresses.length === 0) throw new SafeFetchError("Upstream hostname has no addresses");
  if (!allowPrivate && addresses.some((entry) => !isPublicAddress(entry.address))) {
    throw new SafeFetchError("Upstream resolves to a blocked network address");
  }
  return addresses[0] as { address: string; family: number };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SafeFetchError("Upstream request timed out")), timeoutMs);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function validateUpstreamUrl(input: string, allowPrivate = false): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SafeFetchError("Upstream URL is invalid");
  }
  if (url.username || url.password) throw new SafeFetchError("Upstream URL must not contain credentials");
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("Only HTTP(S) upstreams are supported");
  const localHost = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(url.hostname.toLowerCase());
  if (url.protocol !== "https:" && !(allowPrivate && localHost)) {
    throw new SafeFetchError("Remote upstreams must use HTTPS");
  }
  return url;
}

function requestJson(
  url: URL,
  address: string,
  timeoutMs: number,
  maxResponseBytes: number,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: address,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        servername: url.hostname,
        headers: {
          accept: "application/json",
          host: url.host,
          "user-agent": "AutoPick/1.0",
        },
      },
      (response) => {
        const contentLength = Number.parseInt(response.headers["content-length"] ?? "0", 10);
        if (contentLength > maxResponseBytes) {
          response.destroy();
          reject(new SafeFetchError("Upstream response is too large"));
          return;
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxResponseBytes) {
            response.destroy(new SafeFetchError("Upstream response is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks) });
        });
        response.on("error", reject);
      },
    );
    request.setTimeout(timeoutMs, () => request.destroy(new SafeFetchError("Upstream request timed out")));
    request.on("error", (error) => reject(error instanceof SafeFetchError ? error : new SafeFetchError("Upstream request failed")));
    request.end();
  });
}

export async function safeJsonFetch(input: string, options: SafeFetchOptions = {}): Promise<unknown> {
  const timeoutMs = options.timeoutMs ?? 2_500;
  const maxResponseBytes = options.maxResponseBytes ?? 1_048_576;
  const maxRedirects = options.maxRedirects ?? 2;
  const allowPrivate = options.allowPrivate ?? false;
  const deadline = Date.now() + timeoutMs;
  let url = validateUpstreamUrl(input, allowPrivate);

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("Upstream request timed out");
    const resolved = await withTimeout(resolveAddress(url, allowPrivate), remaining);
    const response = await requestJson(url, resolved.address, remaining, maxResponseBytes);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || redirect === maxRedirects) throw new SafeFetchError("Too many or invalid upstream redirects");
      url = validateUpstreamUrl(new URL(location, url).toString(), allowPrivate);
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new SafeFetchError(`Upstream returned HTTP ${response.status}`);
    const contentType = response.headers["content-type"] ?? "";
    if (!/^application\/(?:[\w.+-]*\+)?json\b/i.test(contentType)) throw new SafeFetchError("Upstream did not return JSON");
    try {
      return JSON.parse(response.body.toString("utf8"));
    } catch {
      throw new SafeFetchError("Upstream returned malformed JSON");
    }
  }
  throw new SafeFetchError("Upstream redirect limit exceeded");
}
