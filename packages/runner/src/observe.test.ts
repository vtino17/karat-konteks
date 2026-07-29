import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ContextManifest } from "@karatkonteks/core";
import { pinManifest, scanManifest } from "./observe.js";

function manifest(path: string): ContextManifest {
  return {
    contextVersion: "1.0",
    id: "test",
    goal: "Continue implementation",
    generatedAt: "2026-07-29T00:00:00.000Z",
    tokenBudget: 1000,
    sources: [
      {
        id: "rules",
        label: "Rules",
        kind: "file",
        path,
        capturedAt: "2026-07-29T00:00:00.000Z",
        maxAgeHours: 48,
        required: true,
        authority: 100,
        priority: 5,
        topics: ["workflow"],
      },
    ],
  };
}

describe("local context observer", () => {
  it("pins file content and passes a subsequent freshness scan", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "karat-observe-"));
    await writeFile(join(workspace, "RULES.md"), "Use pnpm.\n", "utf8");
    const pinned = await pinManifest(manifest("RULES.md"), {
      workspace,
      now: new Date("2026-07-29T01:00:00.000Z"),
    });
    const result = await scanManifest(pinned, {
      workspace,
      now: new Date("2026-07-29T02:00:00.000Z"),
    });

    expect(pinned.sources[0]?.expectedHash).toHaveLength(64);
    expect(result.audit.status).toBe("ready");
  });

  it("detects broken @file references", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "karat-reference-"));
    await writeFile(
      join(workspace, "HANDOFF.md"),
      "Read @docs/missing.md before continuing.\n",
      "utf8",
    );
    await mkdir(join(workspace, "docs"));
    const pinned = await pinManifest(manifest("HANDOFF.md"), {
      workspace,
      now: new Date("2026-07-29T01:00:00.000Z"),
    });
    const result = await scanManifest(pinned, {
      workspace,
      now: new Date("2026-07-29T02:00:00.000Z"),
    });

    expect(result.audit.status).toBe("blocked");
    expect(result.audit.sources[0]?.issues[0]).toContain("missing.md");
  });

  it("rejects traversal outside the workspace", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "karat-traversal-"));
    const result = await scanManifest(manifest("../outside.md"), {
      workspace,
      now: new Date("2026-07-29T02:00:00.000Z"),
    });
    expect(result.audit.status).toBe("blocked");
    expect(result.audit.sources[0]?.issues[0]).toContain("escapes");
  });
});
