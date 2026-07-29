import type {
  ContextAudit,
  ManifestDiff,
  PackVerification,
} from "@handoffseal/core";

const statusLabel = {
  ready: "✓ READY",
  warning: "◇ WARNING",
  blocked: "✕ BLOCKED",
};

const sourceIcon = {
  healthy: "✓",
  unpinned: "◇",
  stale: "⌛",
  drifted: "↯",
  missing: "×",
  error: "!",
};

export function formatAudit(audit: ContextAudit): string {
  return [
    `${statusLabel[audit.status]}  ${audit.manifestId}`,
    `Health       ${audit.healthScore}/100`,
    `Token budget ${audit.totalEstimatedTokens}/${audit.tokenBudget}${audit.budgetExceededBy ? ` · +${audit.budgetExceededBy} over` : ""}`,
    `Conflicts    ${audit.contradictions.length} · ${audit.contradictions.filter((entry) => entry.unresolved).length} unresolved`,
    `Redundancy   ${audit.redundancies.length} pair(s)`,
    "",
    ...audit.sources.map(
      (source) =>
        `${sourceIcon[source.status]} ${source.sourceId.padEnd(22)} ${source.status.padEnd(9)} ${source.estimatedTokens} tokens${source.issues[0] ? ` · ${source.issues[0]}` : ""}`,
    ),
  ].join("\n");
}

export function formatPackVerification(
  verification: PackVerification,
): string {
  return [
    verification.valid ? "✓ VALID handoff pack" : "✕ INVALID handoff pack",
    ...Object.entries(verification.checks).map(([name, value]) => {
      const status = value === null ? "SKIP" : value ? "PASS" : "FAIL";
      return `${status.padEnd(4)}  ${name}`;
    }),
  ].join("\n");
}

export function formatDiff(diff: ManifestDiff): string {
  return [
    `Manifest diff  ${diff.from} → ${diff.to}`,
    `Added          ${diff.added.join(", ") || "none"}`,
    `Removed        ${diff.removed.join(", ") || "none"}`,
    `Modified       ${diff.modified.join(", ") || "none"}`,
    `Weakened       ${diff.weakenedControls.length}`,
    ...diff.weakenedControls.map((entry) => `! ${entry}`),
    `Context drift  ${diff.contextDrift.length}`,
    ...diff.contextDrift.map((entry) => `~ ${entry}`),
  ].join("\n");
}
