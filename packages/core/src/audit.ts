import { canonicalJson, estimateTokens } from "./canonical.js";
import { jaccardSimilarity } from "./similarity.js";
import type {
  ContextAudit,
  ContextManifest,
  Contradiction,
  SourceAudit,
  SourceObservation,
  SourceStatus,
} from "./types.js";
import { assertManifest } from "./validation.js";

function auditSource(
  source: ContextManifest["sources"][number],
  observation: SourceObservation | undefined,
  now: Date,
): SourceAudit {
  const captured = Date.parse(source.capturedAt);
  const ageHours = Math.max(0, (now.getTime() - captured) / 3_600_000);
  const issues: string[] = [];
  let status: SourceStatus = "healthy";

  if (!observation || observation.error) {
    status = "error";
    issues.push(observation?.error ?? "No observation was provided.");
  } else if (!observation.exists) {
    status = "missing";
    issues.push("Source is missing.");
  } else {
    const broken = observation.brokenReferences?.filter(
      (reference) => !reference.exists,
    );
    if (broken && broken.length > 0) {
      status = "error";
      issues.push(
        `Broken references: ${broken.map((reference) => reference.path).join(", ")}.`,
      );
    } else if (
      source.expectedHash &&
      source.expectedHash !== observation.currentHash
    ) {
      status = "drifted";
      issues.push("Content hash differs from the pinned hash.");
    } else if (ageHours > source.maxAgeHours) {
      status = "stale";
      issues.push(
        `Source age ${ageHours.toFixed(1)}h exceeds ${source.maxAgeHours}h.`,
      );
    } else if (!source.expectedHash) {
      status = "unpinned";
      issues.push("Source has no expectedHash pin.");
    }
  }

  return {
    sourceId: source.id,
    status,
    ageHours,
    estimatedTokens: observation?.content
      ? estimateTokens(observation.content) + 24
      : 0,
    currentHash: observation?.currentHash ?? null,
    issues,
  };
}

function contradictions(manifest: ContextManifest): Contradiction[] {
  const groups = new Map<
    string,
    Array<{
      value: unknown;
      sourceId: string;
      authority: number;
    }>
  >();
  for (const source of manifest.sources) {
    for (const claim of source.claims ?? []) {
      const scope = claim.scope?.trim().toLowerCase() || "global";
      const subject = claim.subject.trim().toLowerCase();
      const predicate = claim.predicate.trim().toLowerCase();
      const key = `${scope}|${subject}|${predicate}`;
      groups.set(key, [
        ...(groups.get(key) ?? []),
        { value: claim.value, sourceId: source.id, authority: source.authority },
      ]);
    }
  }

  const result: Contradiction[] = [];
  for (const [key, entries] of groups) {
    const variants = new Map<
      string,
      { value: unknown; sourceIds: string[]; maxAuthority: number }
    >();
    for (const entry of entries) {
      const valueKey = canonicalJson(entry.value);
      const current = variants.get(valueKey);
      variants.set(valueKey, {
        value: entry.value,
        sourceIds: [...(current?.sourceIds ?? []), entry.sourceId].sort(),
        maxAuthority: Math.max(current?.maxAuthority ?? 0, entry.authority),
      });
    }
    if (variants.size < 2) continue;
    const options = [...variants.values()].sort(
      (left, right) => right.maxAuthority - left.maxAuthority,
    );
    const highest = options[0]?.maxAuthority ?? 0;
    const winners = options.filter((option) => option.maxAuthority === highest);
    const [scope, subject, predicate] = key.split("|") as [
      string,
      string,
      string,
    ];
    result.push({
      key,
      scope,
      subject,
      predicate,
      variants: options,
      resolvedValue: winners.length === 1 ? winners[0]!.value : null,
      unresolved: winners.length !== 1,
    });
  }
  return result.sort((left, right) => left.key.localeCompare(right.key));
}

export function auditContext(
  manifestValue: unknown,
  observations: SourceObservation[],
  now = new Date(),
): ContextAudit {
  assertManifest(manifestValue);
  const manifest = manifestValue;
  const observationMap = new Map(
    observations.map((observation) => [observation.sourceId, observation]),
  );
  const sources = manifest.sources.map((source) =>
    auditSource(source, observationMap.get(source.id), now),
  );
  const conflicts = contradictions(manifest);
  const redundancies: ContextAudit["redundancies"] = [];

  for (let left = 0; left < manifest.sources.length; left += 1) {
    for (let right = left + 1; right < manifest.sources.length; right += 1) {
      const sourceA = manifest.sources[left]!;
      const sourceB = manifest.sources[right]!;
      const contentA = observationMap.get(sourceA.id)?.content;
      const contentB = observationMap.get(sourceB.id)?.content;
      if (!contentA || !contentB) continue;
      const similarity = jaccardSimilarity(contentA, contentB);
      if (similarity >= 0.72) {
        redundancies.push({
          sourceA: sourceA.id,
          sourceB: sourceB.id,
          similarity: Math.round(similarity * 1000) / 1000,
        });
      }
    }
  }

  const totalEstimatedTokens = sources.reduce(
    (total, source) => total + source.estimatedTokens,
    0,
  );
  const budgetExceededBy = Math.max(
    0,
    totalEstimatedTokens - manifest.tokenBudget,
  );
  const sourceById = new Map(manifest.sources.map((source) => [source.id, source]));
  const requiredBroken = sources.some(
    (source) =>
      sourceById.get(source.sourceId)?.required &&
      ["stale", "drifted", "missing", "error"].includes(source.status),
  );
  const requiredConflict = conflicts.some(
    (conflict) =>
      conflict.unresolved &&
      conflict.variants.some((variant) =>
        variant.sourceIds.some((id) => sourceById.get(id)?.required),
      ),
  );
  const warning =
    budgetExceededBy > 0 ||
    conflicts.length > 0 ||
    redundancies.length > 0 ||
    sources.some((source) => source.status !== "healthy");
  const status = requiredBroken || requiredConflict
    ? "blocked"
    : warning
      ? "warning"
      : "ready";

  let penalty = budgetExceededBy > 0 ? 10 : 0;
  penalty += conflicts.filter((conflict) => conflict.unresolved).length * 15;
  penalty += redundancies.length * 3;
  for (const source of sources) {
    const required = sourceById.get(source.sourceId)?.required ?? false;
    if (["stale", "drifted", "missing", "error"].includes(source.status)) {
      penalty += required ? 25 : 10;
    } else if (source.status === "unpinned") {
      penalty += required ? 8 : 4;
    }
  }

  return {
    manifestId: manifest.id,
    status,
    healthScore: Math.max(0, 100 - penalty),
    totalEstimatedTokens,
    tokenBudget: manifest.tokenBudget,
    budgetExceededBy,
    sources,
    contradictions: conflicts,
    redundancies,
    auditedAt: now.toISOString(),
  };
}
