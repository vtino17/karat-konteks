import type {
  ContextManifest,
  ValidationIssue,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasText(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string" && record[key].trim().length > 0;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isJsonValue(entry, ancestors))
    : Object.values(value).every((entry) => isJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

function issue(
  issues: ValidationIssue[],
  path: string,
  message: string,
): void {
  issues.push({ path, message });
}

export function validateManifest(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) {
    return [{ path: "$", message: "Manifest must be a JSON object." }];
  }
  const issues: ValidationIssue[] = [];
  if (value.contextVersion !== "1.0") {
    issue(issues, "contextVersion", 'Must equal "1.0".');
  }
  for (const key of ["id", "goal", "generatedAt"]) {
    if (!hasText(value, key)) issue(issues, key, "Must be a non-empty string.");
  }
  if (
    typeof value.generatedAt === "string" &&
    Number.isNaN(Date.parse(value.generatedAt))
  ) {
    issue(issues, "generatedAt", "Must be a valid ISO-8601 timestamp.");
  }
  if (
    !Number.isInteger(value.tokenBudget) ||
    Number(value.tokenBudget) < 100
  ) {
    issue(issues, "tokenBudget", "Must be an integer of at least 100.");
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    issue(issues, "sources", "Must contain at least one context source.");
    return issues;
  }

  const ids = new Set<string>();
  value.sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!isRecord(source)) {
      issue(issues, path, "Must be an object.");
      return;
    }
    for (const key of ["id", "label", "capturedAt"]) {
      if (!hasText(source, key)) {
        issue(issues, `${path}.${key}`, "Must be a non-empty string.");
      }
    }
    if (typeof source.id === "string") {
      if (ids.has(source.id)) {
        issue(issues, `${path}.id`, "Source id must be unique.");
      }
      ids.add(source.id);
    }
    if (!["file", "inline"].includes(String(source.kind))) {
      issue(issues, `${path}.kind`, "Must be file or inline.");
    }
    if (source.kind === "file" && !hasText(source, "path")) {
      issue(issues, `${path}.path`, "File sources require a relative path.");
    }
    if (
      source.kind === "file" &&
      typeof source.path === "string" &&
      (source.path.startsWith("/") || source.path.startsWith("\\"))
    ) {
      issue(issues, `${path}.path`, "Must be relative to the workspace.");
    }
    if (source.kind === "inline" && !hasText(source, "content")) {
      issue(issues, `${path}.content`, "Inline sources require content.");
    }
    if (
      typeof source.capturedAt === "string" &&
      Number.isNaN(Date.parse(source.capturedAt))
    ) {
      issue(issues, `${path}.capturedAt`, "Must be a valid ISO-8601 timestamp.");
    }
    if (
      typeof source.maxAgeHours !== "number" ||
      !Number.isFinite(source.maxAgeHours) ||
      source.maxAgeHours <= 0
    ) {
      issue(issues, `${path}.maxAgeHours`, "Must be a positive number.");
    }
    if (typeof source.required !== "boolean") {
      issue(issues, `${path}.required`, "Must be a boolean.");
    }
    if (
      typeof source.authority !== "number" ||
      !Number.isFinite(source.authority) ||
      source.authority < 0 ||
      source.authority > 100
    ) {
      issue(issues, `${path}.authority`, "Must be between 0 and 100.");
    }
    if (![1, 2, 3, 4, 5].includes(Number(source.priority))) {
      issue(issues, `${path}.priority`, "Must be an integer from 1 to 5.");
    }
    if (
      !Array.isArray(source.topics) ||
      source.topics.some((topic) => typeof topic !== "string")
    ) {
      issue(issues, `${path}.topics`, "Must be an array of strings.");
    }
    if (source.claims !== undefined) {
      if (!Array.isArray(source.claims)) {
        issue(issues, `${path}.claims`, "Must be an array.");
      } else {
        source.claims.forEach((claim, claimIndex) => {
          if (
            !isRecord(claim) ||
            !hasText(claim, "subject") ||
            !hasText(claim, "predicate") ||
            !isJsonValue(claim.value)
          ) {
            issue(
              issues,
              `${path}.claims[${claimIndex}]`,
              "Must include subject, predicate, and a JSON-compatible finite value.",
            );
          }
        });
      }
    }
  });

  if (
    Array.isArray(value.sources) &&
    !value.sources.some(
      (source) => isRecord(source) && source.required === true,
    )
  ) {
    issue(issues, "sources", "At least one source must be required.");
  }
  return issues;
}

export function assertManifest(
  value: unknown,
): asserts value is ContextManifest {
  const issues = validateManifest(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid context manifest:\n${issues
        .map((entry) => `- ${entry.path}: ${entry.message}`)
        .join("\n")}`,
    );
  }
}
