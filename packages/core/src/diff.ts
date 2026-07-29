import { canonicalJson } from "./canonical.js";
import type {
  ContextManifest,
  ContextSource,
  ManifestDiff,
} from "./types.js";
import { assertManifest } from "./validation.js";

function sourceMap(manifest: ContextManifest): Map<string, ContextSource> {
  return new Map(manifest.sources.map((source) => [source.id, source]));
}

export function diffManifests(
  fromValue: unknown,
  toValue: unknown,
): ManifestDiff {
  assertManifest(fromValue);
  assertManifest(toValue);
  const from = fromValue;
  const to = toValue;
  const oldSources = sourceMap(from);
  const newSources = sourceMap(to);
  const added = [...newSources.keys()].filter((id) => !oldSources.has(id)).sort();
  const removed = [...oldSources.keys()].filter((id) => !newSources.has(id)).sort();
  const modified = [...oldSources.keys()]
    .filter(
      (id) =>
        newSources.has(id) &&
        canonicalJson(oldSources.get(id)) !== canonicalJson(newSources.get(id)),
    )
    .sort();
  const weakenedControls: string[] = [];
  const contextDrift: string[] = [];

  for (const id of removed) {
    if (oldSources.get(id)?.required) {
      weakenedControls.push(`Required source "${id}" was removed.`);
    }
  }
  for (const id of modified) {
    const previous = oldSources.get(id);
    const next = newSources.get(id);
    if (!previous || !next) continue;
    if (previous.required && !next.required) {
      weakenedControls.push(`Source "${id}" changed from required to optional.`);
    }
    if (next.maxAgeHours > previous.maxAgeHours) {
      weakenedControls.push(
        `Source "${id}" freshness window increased from ${previous.maxAgeHours}h to ${next.maxAgeHours}h.`,
      );
    }
    if (previous.expectedHash && !next.expectedHash) {
      weakenedControls.push(`Source "${id}" lost its content hash pin.`);
    }
    if (
      previous.expectedHash &&
      next.expectedHash &&
      previous.expectedHash !== next.expectedHash
    ) {
      contextDrift.push(`Pinned content changed for source "${id}".`);
    }
    if (canonicalJson(previous.claims) !== canonicalJson(next.claims)) {
      contextDrift.push(`Declared claims changed for source "${id}".`);
    }
  }
  return {
    from: from.id,
    to: to.id,
    added,
    removed,
    modified,
    weakenedControls,
    contextDrift,
  };
}
