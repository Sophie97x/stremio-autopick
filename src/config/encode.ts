import { configSchema, type AutoPickConfig } from "./schema";
import { migrateConfig } from "./migrate";

export const MAX_ENCODED_CONFIG_LENGTH = 16_384;
export const MAX_DECODED_CONFIG_BYTES = 12_288;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function validateConfig(input: unknown): AutoPickConfig {
  const result = configSchema.safeParse(migrateConfig(input));
  if (!result.success) {
    const message = result.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join(".") || "config"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(message);
  }
  return result.data;
}

export function encodeConfig(input: unknown): string {
  const config = validateConfig(input);
  const json = JSON.stringify(config);
  if (Buffer.byteLength(json, "utf8") > MAX_DECODED_CONFIG_BYTES) {
    throw new ConfigError("Configuration is too large");
  }
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  if (encoded.length > MAX_ENCODED_CONFIG_LENGTH) throw new ConfigError("Configuration is too large");
  return encoded;
}

export function decodeConfig(encoded: string): AutoPickConfig {
  if (!encoded || encoded.length > MAX_ENCODED_CONFIG_LENGTH) throw new ConfigError("Configuration is missing or too large");
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new ConfigError("Configuration is not valid Base64URL");

  let bytes: Buffer;
  try {
    bytes = Buffer.from(encoded, "base64url");
  } catch {
    throw new ConfigError("Configuration is not valid Base64URL");
  }
  if (bytes.length > MAX_DECODED_CONFIG_BYTES) throw new ConfigError("Configuration is too large");
  if (bytes.toString("base64url") !== encoded) throw new ConfigError("Configuration is not canonical Base64URL");

  let value: unknown;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ConfigError("Configuration does not contain valid JSON");
  }
  return validateConfig(value);
}
