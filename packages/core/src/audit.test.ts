import { describe, expect, it } from "vitest";
import { sha256 } from "./canonical.js";
import { auditContext } from "./audit.js";
import { validateManifest } from "./validation.js";
import type {
  ContextManifest,
  SourceObservation,
} from "./types.js";

const now = new Date("2026-07-29T03:00:00.000Z");

async function fixture(): Promise<{
  manifest: ContextManifest;
  observations: SourceObservation[];
}> {
  const current = "The API uses port 4100 and requires authentication.";
  const old = "The API uses port 3000 and requires authentication.";
  return {
    manifest: {
      contextVersion: "1.0",
      id: "session-1",
      goal: "Continue API implementation",
      generatedAt: "2026-07-29T01:00:00.000Z",
      tokenBudget: 1000,
      sources: [
        {
          id: "architecture",
          label: "Architecture",
          kind: "file",
          path: "ARCHITECTURE.md",
          capturedAt: "2026-07-29T02:00:00.000Z",
          maxAgeHours: 24,
          expectedHash: await sha256(current),
          required: true,
          authority: 90,
          priority: 5,
          topics: ["api"],
          claims: [{ subject: "api", predicate: "port", value: 4100 }],
        },
        {
          id: "old-notes",
          label: "Old notes",
          kind: "inline",
          content: old,
          capturedAt: "2026-07-20T02:00:00.000Z",
          maxAgeHours: 24,
          required: false,
          authority: 30,
          priority: 1,
          topics: ["api"],
          claims: [{ subject: "api", predicate: "port", value: 3000 }],
        },
      ],
    },
    observations: [
      {
        sourceId: "architecture",
        exists: true,
        content: current,
        currentHash: await sha256(current),
      },
      {
        sourceId: "old-notes",
        exists: true,
        content: old,
        currentHash: await sha256(old),
      },
    ],
  };
}

describe("context audit", () => {
  it("finds stale context and resolves lower-authority contradictions", async () => {
    const { manifest, observations } = await fixture();
    const audit = auditContext(manifest, observations, now);

    expect(audit.status).toBe("warning");
    expect(audit.sources[1]?.status).toBe("stale");
    expect(audit.contradictions[0]?.resolvedValue).toBe(4100);
    expect(audit.contradictions[0]?.unresolved).toBe(false);
  });

  it("blocks drift in a required source", async () => {
    const { manifest, observations } = await fixture();
    observations[0] = {
      ...observations[0]!,
      currentHash: await sha256("changed"),
    };
    const audit = auditContext(manifest, observations, now);

    expect(audit.status).toBe("blocked");
    expect(audit.sources[0]?.status).toBe("drifted");
  });

  it("rejects non-finite authority and claim values", async () => {
    const { manifest } = await fixture();
    manifest.sources[0]!.authority = Number.NaN;
    manifest.sources[0]!.claims![0]!.value = Number.POSITIVE_INFINITY;

    const paths = validateManifest(manifest).map((entry) => entry.path);
    expect(paths).toContain("sources[0].authority");
    expect(paths).toContain("sources[0].claims[0]");
  });
});
