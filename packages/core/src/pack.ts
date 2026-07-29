import { canonicalJson, estimateTokens, sha256 } from "./canonical.js";
import type {
  ContextAudit,
  ContextManifest,
  HandoffPack,
  PackSource,
  PackVerification,
  SourceObservation,
} from "./types.js";
import { assertManifest } from "./validation.js";

function sourceCost(content: string): number {
  return estimateTokens(content) + 24;
}

function renderContent(
  manifest: ContextManifest,
  selected: ContextManifest["sources"],
  observationMap: Map<string, SourceObservation>,
): string {
  const sections = selected.map((source) => {
    const content = observationMap.get(source.id)?.content ?? "";
    return [
      `<context-source id="${source.id}" authority="${source.authority}" captured-at="${source.capturedAt}">`,
      `# ${source.label}`,
      content,
      "</context-source>",
    ].join("\n");
  });
  return [
    "# Agent handoff context",
    "",
    `Goal: ${manifest.goal}`,
    "",
    "Treat each source according to its recorded authority and capture time. Resolve no hidden assumptions beyond this pack.",
    "",
    ...sections,
    "",
  ].join("\n");
}

export async function compilePack(input: {
  manifest: ContextManifest;
  audit: ContextAudit;
  observations: SourceObservation[];
  tokenBudget?: number;
  now?: Date;
}): Promise<HandoffPack> {
  assertManifest(input.manifest);
  if (input.audit.status === "blocked") {
    throw new Error("Cannot compile a handoff pack from blocked context.");
  }
  const budget = input.tokenBudget ?? input.manifest.tokenBudget;
  if (!Number.isInteger(budget) || budget < 100) {
    throw new Error("Token budget must be an integer of at least 100.");
  }
  const observationMap = new Map(
    input.observations.map((observation) => [
      observation.sourceId,
      observation,
    ]),
  );
  const auditMap = new Map(
    input.audit.sources.map((source) => [source.sourceId, source]),
  );
  const eligible = input.manifest.sources.filter((source) =>
    ["healthy", "unpinned"].includes(auditMap.get(source.id)?.status ?? ""),
  );
  const selected: ContextManifest["sources"] = [];
  const excluded: HandoffPack["excludedSources"] = [];
  let used = 60;

  for (const source of eligible.filter((source) => source.required)) {
    const content = observationMap.get(source.id)?.content;
    if (!content) throw new Error(`Required source ${source.id} has no content.`);
    used += sourceCost(content);
    selected.push(source);
  }
  if (used > budget) {
    throw new Error(
      `Required sources need approximately ${used} tokens; budget is ${budget}.`,
    );
  }

  const coveredTopics = new Set(selected.flatMap((source) => source.topics));
  const optional = eligible
    .filter((source) => !source.required)
    .map((source) => {
      const content = observationMap.get(source.id)?.content ?? "";
      const newTopics = source.topics.filter((topic) => !coveredTopics.has(topic));
      const utility =
        source.authority +
        source.priority * 10 +
        newTopics.length * 15 -
        (auditMap.get(source.id)?.ageHours ?? 0) /
          Math.max(1, source.maxAgeHours);
      return { source, content, utility, cost: sourceCost(content) };
    })
    .sort(
      (left, right) =>
        right.utility / Math.sqrt(right.cost) -
          left.utility / Math.sqrt(left.cost) ||
        left.source.id.localeCompare(right.source.id),
    );

  for (const candidate of optional) {
    const redundant = input.audit.redundancies.some(
      (entry) =>
        entry.similarity >= 0.82 &&
        ((entry.sourceA === candidate.source.id &&
          selected.some((source) => source.id === entry.sourceB)) ||
          (entry.sourceB === candidate.source.id &&
            selected.some((source) => source.id === entry.sourceA))),
    );
    if (redundant) {
      excluded.push({
        sourceId: candidate.source.id,
        reason: "redundant-with-selected-source",
      });
    } else if (used + candidate.cost > budget) {
      excluded.push({ sourceId: candidate.source.id, reason: "token-budget" });
    } else {
      selected.push(candidate.source);
      used += candidate.cost;
      candidate.source.topics.forEach((topic) => coveredTopics.add(topic));
    }
  }
  for (const source of input.manifest.sources) {
    if (
      !eligible.some((candidate) => candidate.id === source.id) &&
      !excluded.some((entry) => entry.sourceId === source.id)
    ) {
      excluded.push({
        sourceId: source.id,
        reason: `source-${auditMap.get(source.id)?.status ?? "unobserved"}`,
      });
    }
  }

  const content = renderContent(input.manifest, selected, observationMap);
  const selectedSources: PackSource[] = selected.map((source) => ({
    sourceId: source.id,
    label: source.label,
    currentHash: observationMap.get(source.id)?.currentHash ?? "",
    authority: source.authority,
    required: source.required,
    topics: source.topics,
    estimatedTokens: sourceCost(
      observationMap.get(source.id)?.content ?? "",
    ),
  }));
  const generatedAt = (input.now ?? new Date()).toISOString();
  const manifestHash = await sha256(input.manifest);
  const payload = {
    packVersion: "1.0" as const,
    packId: (await sha256(`${manifestHash}:${generatedAt}`)).slice(0, 24),
    manifestId: input.manifest.id,
    manifestHash,
    goal: input.manifest.goal,
    generatedAt,
    tokenBudget: budget,
    estimatedTokens: estimateTokens(content),
    selectedSources,
    excludedSources: excluded.sort((a, b) =>
      a.sourceId.localeCompare(b.sourceId),
    ),
    content,
  };
  return { ...payload, packHash: await sha256(payload) };
}

export async function verifyPack(input: {
  pack: HandoffPack;
  manifest?: ContextManifest;
}): Promise<PackVerification> {
  const { packHash, ...payload } = input.pack;
  const checks: PackVerification["checks"] = {
    packHash: (await sha256(payload)) === packHash,
    manifestHash: input.manifest
      ? (assertManifest(input.manifest),
        (await sha256(input.manifest)) === input.pack.manifestHash)
      : null,
    selectedSources:
      new Set(input.pack.selectedSources.map((source) => source.sourceId)).size ===
        input.pack.selectedSources.length &&
      input.pack.selectedSources.every(
        (source) => source.currentHash.length === 64,
      ),
    tokenEstimate:
      estimateTokens(input.pack.content) === input.pack.estimatedTokens &&
      input.pack.estimatedTokens <= input.pack.tokenBudget,
  };
  const errors = Object.entries(checks)
    .filter(([, passed]) => passed === false)
    .map(([name]) => `${name} check failed`);
  return { valid: errors.length === 0, checks, errors };
}

export function serializePack(pack: HandoffPack): string {
  return `${canonicalJson(pack)}\n`;
}
