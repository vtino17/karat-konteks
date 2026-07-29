import { describe, expect, it } from "vitest";
import { diffManifests } from "./diff.js";
import type { ContextManifest } from "./types.js";

const base: ContextManifest = {
  contextVersion: "1.0",
  id: "v1",
  goal: "Continue work",
  generatedAt: "2026-07-29T00:00:00.000Z",
  tokenBudget: 1000,
  sources: [
    {
      id: "rules",
      label: "Rules",
      kind: "inline",
      content: "Use pnpm.",
      capturedAt: "2026-07-29T00:00:00.000Z",
      maxAgeHours: 24,
      expectedHash: "abc",
      required: true,
      authority: 100,
      priority: 5,
      topics: ["workflow"],
    },
    {
      id: "goal",
      label: "Goal",
      kind: "inline",
      content: "Ship a verified handoff.",
      capturedAt: "2026-07-29T00:00:00.000Z",
      maxAgeHours: 24,
      required: true,
      authority: 100,
      priority: 5,
      topics: ["goal"],
    },
  ],
};

describe("manifest diff", () => {
  it("flags weaker freshness and removed pins", () => {
    const result = diffManifests(base, {
      ...base,
      id: "v2",
      sources: [
        {
          ...base.sources[0]!,
          maxAgeHours: 168,
          expectedHash: undefined,
          required: false,
        },
        base.sources[1]!,
      ],
    });
    expect(result.weakenedControls).toHaveLength(3);
  });
});
