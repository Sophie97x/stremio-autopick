import { TtlCache } from "../cache/cache";
import type { StreamCandidate } from "./candidate";

export interface HealthResult {
  health: "healthy" | "unknown" | "failed";
  reason: string;
}

export interface CandidateHealthChecker {
  check(candidate: StreamCandidate): Promise<HealthResult>;
}

export class AvailabilityHealthChecker implements CandidateHealthChecker {
  async check(candidate: StreamCandidate): Promise<HealthResult> {
    if (candidate.seeders === 0) return { health: "failed", reason: "source reports zero seeders" };
    if (candidate.seeders !== undefined && candidate.seeders > 0) {
      return { health: "healthy", reason: "source reports available seeders" };
    }
    if (candidate.peers !== undefined && candidate.peers > 0) return { health: "healthy", reason: "source reports available peers" };
    return { health: "unknown", reason: "source did not report availability" };
  }
}

export class CachedHealthChecker implements CandidateHealthChecker {
  private readonly cache = new TtlCache<HealthResult>(1_000);

  constructor(
    private readonly checker: CandidateHealthChecker,
    private readonly ttlMs = 90_000,
  ) {}

  async check(candidate: StreamCandidate): Promise<HealthResult> {
    const key = `${candidate.infoHash ?? candidate.originalTitle}:${candidate.fileIdx ?? "none"}:${candidate.seeders ?? "unknown"}:${candidate.peers ?? "unknown"}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const result = await this.checker.check(candidate);
    this.cache.set(key, result, this.ttlMs);
    return result;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("health check timeout")), timeoutMs);
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

export async function checkTopCandidates(
  candidates: readonly StreamCandidate[],
  checker: CandidateHealthChecker,
  maxCandidates: number,
  timeoutMs: number,
): Promise<StreamCandidate[]> {
  const checked = candidates.map((candidate) => structuredClone(candidate));
  await Promise.all(
    checked.slice(0, maxCandidates).map(async (candidate) => {
      try {
        const result = await withTimeout(checker.check(candidate), timeoutMs);
        candidate.health = result.health;
      } catch {
        candidate.health = "unknown";
      }
    }),
  );
  return checked;
}
