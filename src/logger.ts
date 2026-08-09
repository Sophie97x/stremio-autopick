import pino, { type Logger } from "pino";
import type { AppEnv } from "./env";

export function createLogger(env: AppEnv): Logger {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: ["config", "token", "url", "req.headers.authorization", "req.headers.cookie"],
      censor: "[redacted]",
    },
    base: { service: "autopick" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
