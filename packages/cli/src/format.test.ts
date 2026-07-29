import { describe, expect, it } from "vitest";
import { formatAudit, formatPackVerification } from "./format.js";

describe("CLI formatting", () => {
  it("shows health and source state", () => {
    const text = formatAudit({
      manifestId: "handoff",
      status: "warning",
      healthScore: 82,
      totalEstimatedTokens: 1200,
      tokenBudget: 1000,
      budgetExceededBy: 200,
      sources: [
        {
          sourceId: "notes",
          status: "stale",
          ageHours: 48,
          estimatedTokens: 200,
          currentHash: "hash",
          issues: ["Source is stale."],
        },
      ],
      contradictions: [],
      redundancies: [],
      auditedAt: "2026-07-29T00:00:00.000Z",
    });
    expect(text).toContain("◇ WARNING");
    expect(text).toContain("82/100");
    expect(text).toContain("+200 over");
  });

  it("renders invalid pack checks", () => {
    const text = formatPackVerification({
      valid: false,
      checks: {
        packHash: false,
        manifestHash: true,
        selectedSources: true,
        tokenEstimate: true,
      },
      errors: ["packHash check failed"],
    });
    expect(text).toContain("✕ INVALID");
    expect(text).toContain("FAIL  packHash");
  });
});
