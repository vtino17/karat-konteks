import { describe, expect, it } from "vitest";
import { auditContext } from "./audit.js";
import { sha256 } from "./canonical.js";
import { compilePack, verifyPack } from "./pack.js";
import type {
  ContextManifest,
  SourceObservation,
} from "./types.js";

describe("handoff pack compiler", () => {
  it("keeps required context and excludes redundant optional context", async () => {
    const requiredContent =
      "Use pnpm for all package operations. Run pnpm test before committing changes.";
    const duplicateContent =
      "Use pnpm for all package operations. Run pnpm test before committing changes.";
    const extraContent = "The user interface must meet WCAG AA contrast.";
    const manifest: ContextManifest = {
      contextVersion: "1.0",
      id: "pack",
      goal: "Continue implementation",
      generatedAt: "2026-07-29T00:00:00.000Z",
      tokenBudget: 500,
      sources: [
        {
          id: "rules",
          label: "Rules",
          kind: "inline",
          content: requiredContent,
          capturedAt: "2026-07-29T00:00:00.000Z",
          maxAgeHours: 48,
          expectedHash: await sha256(requiredContent),
          required: true,
          authority: 100,
          priority: 5,
          topics: ["workflow"],
        },
        {
          id: "duplicate",
          label: "Duplicate",
          kind: "inline",
          content: duplicateContent,
          capturedAt: "2026-07-29T00:00:00.000Z",
          maxAgeHours: 48,
          expectedHash: await sha256(duplicateContent),
          required: false,
          authority: 40,
          priority: 2,
          topics: ["workflow"],
        },
        {
          id: "design",
          label: "Design",
          kind: "inline",
          content: extraContent,
          capturedAt: "2026-07-29T00:00:00.000Z",
          maxAgeHours: 48,
          expectedHash: await sha256(extraContent),
          required: false,
          authority: 80,
          priority: 4,
          topics: ["design"],
        },
      ],
    };
    const observations: SourceObservation[] = await Promise.all(
      manifest.sources.map(async (source) => ({
        sourceId: source.id,
        exists: true,
        content: source.content,
        currentHash: await sha256(source.content ?? ""),
      })),
    );
    const audit = auditContext(
      manifest,
      observations,
      new Date("2026-07-29T01:00:00.000Z"),
    );
    const pack = await compilePack({
      manifest,
      audit,
      observations,
      now: new Date("2026-07-29T01:01:00.000Z"),
    });
    const verification = await verifyPack({ pack, manifest });

    expect(pack.selectedSources.map((source) => source.sourceId)).toEqual([
      "rules",
      "design",
    ]);
    expect(pack.excludedSources).toContainEqual({
      sourceId: "duplicate",
      reason: "redundant-with-selected-source",
    });
    expect(verification.valid).toBe(true);
  });
});
