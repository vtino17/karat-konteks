import type { ContextManifest } from "@karatkonteks/core";

export const starterManifest: ContextManifest = {
  contextVersion: "1.0",
  id: "agent-handoff-v1",
  goal: "Continue the current task with fresh and sufficient context",
  generatedAt: "2026-07-29T00:00:00.000Z",
  tokenBudget: 4000,
  sources: [
    {
      id: "project-rules",
      label: "Project rules",
      kind: "file",
      path: "AGENTS.md",
      capturedAt: "2026-07-29T00:00:00.000Z",
      maxAgeHours: 168,
      required: true,
      authority: 100,
      priority: 5,
      topics: ["workflow", "constraints"],
    },
    {
      id: "current-state",
      label: "Current implementation state",
      kind: "inline",
      content: "Replace this with the current state, remaining work, and verified blockers.",
      capturedAt: "2026-07-29T00:00:00.000Z",
      maxAgeHours: 8,
      required: true,
      authority: 80,
      priority: 5,
      topics: ["state", "next-steps"],
    },
  ],
};
