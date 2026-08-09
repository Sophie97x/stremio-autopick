import type { StreamCandidate } from "./candidate";

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function richer<T>(first: T | undefined, second: T | undefined): T | undefined {
  return first ?? second;
}

function mergeCandidates(first: StreamCandidate, second: StreamCandidate): StreamCandidate {
  const preferred = first.sourcePriority <= second.sourcePriority ? first : second;
  const alternate = preferred === first ? second : first;
  const merged: StreamCandidate = {
    sourceId: preferred.sourceId,
    sourceName: preferred.sourceName,
    sourcePriority: Math.min(first.sourcePriority, second.sourcePriority),
    contributingSources: unique([...first.contributingSources, ...second.contributingSources]),
    originalTitle:
      first.originalTitle.length >= second.originalTitle.length ? first.originalTitle : second.originalTitle,
    hdr: unique([...first.hdr, ...second.hdr]),
    undesirableQuality: unique([...first.undesirableQuality, ...second.undesirableQuality]),
    audio: unique([...first.audio, ...second.audio]),
    languages: unique([...first.languages, ...second.languages]),
    health: first.health === "healthy" || second.health === "healthy" ? "healthy" : "unknown",
  };

  const optional: Array<[keyof StreamCandidate, unknown]> = [
    ["infoHash", richer(preferred.infoHash, alternate.infoHash)],
    ["fileIdx", richer(preferred.fileIdx, alternate.fileIdx)],
    ["sizeBytes",
      first.sizeBytes !== undefined && second.sizeBytes !== undefined
        ? Math.max(first.sizeBytes, second.sizeBytes)
        : richer(first.sizeBytes, second.sizeBytes)],
    ["seeders",
      first.seeders !== undefined && second.seeders !== undefined
        ? Math.max(first.seeders, second.seeders)
        : richer(first.seeders, second.seeders)],
    ["peers",
      first.peers !== undefined && second.peers !== undefined
        ? Math.max(first.peers, second.peers)
        : richer(first.peers, second.peers)],
    ["year", richer(preferred.year, alternate.year)],
    ["resolution", richer(preferred.resolution, alternate.resolution)],
    ["codec", richer(preferred.codec, alternate.codec)],
    ["releaseType",
      preferred.releaseType && preferred.releaseType !== "unknown"
        ? preferred.releaseType
        : richer(alternate.releaseType, preferred.releaseType)],
    ["releaseGroup", richer(preferred.releaseGroup, alternate.releaseGroup)],
    ["season", richer(preferred.season, alternate.season)],
    ["episode", richer(preferred.episode, alternate.episode)],
    ["isSeasonPack", first.isSeasonPack || second.isSeasonPack],
    ["isFullSeriesPack", first.isFullSeriesPack || second.isFullSeriesPack],
  ];
  for (const [key, value] of optional) {
    if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value;
  }
  const trackers = unique([...(first.trackers ?? []), ...(second.trackers ?? [])]);
  if (trackers.length > 0) merged.trackers = trackers;
  return merged;
}

export function dedupeCandidates(candidates: readonly StreamCandidate[]): StreamCandidate[] {
  const uniqueCandidates = new Map<string, StreamCandidate>();
  for (const original of candidates) {
    const candidate = structuredClone(original);
    const hash = candidate.infoHash?.toLowerCase();
    const key = hash
      ? candidate.fileIdx === undefined
        ? `hash:${hash}`
        : `hash:${hash}:file:${candidate.fileIdx}`
      : `source:${candidate.sourceId}:${candidate.originalTitle.toLowerCase()}:${candidate.sizeBytes ?? "unknown"}`;
    const existing = uniqueCandidates.get(key);
    uniqueCandidates.set(key, existing ? mergeCandidates(existing, candidate) : candidate);
  }
  return [...uniqueCandidates.values()];
}
