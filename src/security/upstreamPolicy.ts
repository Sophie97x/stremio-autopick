import type { AutoPickConfig } from "../config/schema";

export class SourcePolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcePolicyError";
  }
}

function normaliseHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.+$/, "");
}

export function parseAllowedUpstreamHosts(value: string): { allowAny: boolean; hosts: string[] } {
  const entries = value
    .split(",")
    .map(normaliseHostname)
    .filter(Boolean);
  if (entries.includes("*")) return { allowAny: true, hosts: [] };
  return { allowAny: false, hosts: [...new Set(entries)].sort() };
}

export function isUpstreamUrlAllowed(url: string, allowedHosts: string): boolean {
  const policy = parseAllowedUpstreamHosts(allowedHosts);
  if (policy.allowAny) return true;
  try {
    return policy.hosts.includes(normaliseHostname(new URL(url).hostname));
  } catch {
    return false;
  }
}

export function assertConfigSourcesAllowed(config: AutoPickConfig, allowedHosts: string): void {
  for (const source of config.sources.filter((entry) => entry.enabled)) {
    if (!isUpstreamUrlAllowed(source.url, allowedHosts)) {
      const hostname = (() => {
        try {
          return normaliseHostname(new URL(source.url).hostname);
        } catch {
          return "invalid";
        }
      })();
      throw new SourcePolicyError(`Upstream host ${hostname} is not allowed on this server`);
    }
  }
}
