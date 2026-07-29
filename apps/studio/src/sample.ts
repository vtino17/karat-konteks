import type {
  ContextManifest,
  SourceObservation,
} from "@karatkonteks/core";

const rules =
  "Use pnpm for package operations. Run the full quality gate before commit. The API listens on port 4100.";
const duplicate =
  "Use pnpm for package operations. Run the full quality gate before commit. The API listens on port 4100.";

export const sampleManifest: ContextManifest = {
  contextVersion: "1.0",
  id: "checkout-session-07",
  goal: "Continue checkout API implementation without stale assumptions",
  generatedAt: "2026-07-29T02:00:00.000Z",
  tokenBudget: 420,
  sources: [
    {
      id: "project-rules",
      label: "Project rules",
      kind: "file",
      path: "AGENTS.md",
      capturedAt: "2026-07-29T02:00:00.000Z",
      maxAgeHours: 168,
      expectedHash: "a".repeat(64),
      required: true,
      authority: 100,
      priority: 5,
      topics: ["workflow", "api"],
      claims: [{ subject: "api", predicate: "port", value: 4100 }],
    },
    {
      id: "current-state",
      label: "Current task state",
      kind: "inline",
      content:
        "Checkout validation is complete. Remaining: idempotency test and error documentation.",
      capturedAt: "2026-07-29T02:30:00.000Z",
      maxAgeHours: 8,
      expectedHash: "b".repeat(64),
      required: true,
      authority: 85,
      priority: 5,
      topics: ["state", "next-steps"],
    },
    {
      id: "old-handoff",
      label: "Handoff from last week",
      kind: "inline",
      content:
        "Checkout validation has not started. The API listens on port 3000.",
      capturedAt: "2026-07-20T02:00:00.000Z",
      maxAgeHours: 24,
      expectedHash: "c".repeat(64),
      required: false,
      authority: 35,
      priority: 2,
      topics: ["state", "api"],
      claims: [{ subject: "api", predicate: "port", value: 3000 }],
    },
    {
      id: "copied-rules",
      label: "Rules copied into notes",
      kind: "inline",
      content: duplicate,
      capturedAt: "2026-07-29T02:10:00.000Z",
      maxAgeHours: 48,
      expectedHash: "d".repeat(64),
      required: false,
      authority: 40,
      priority: 1,
      topics: ["workflow", "api"],
    },
    {
      id: "design-notes",
      label: "Current interface notes",
      kind: "inline",
      content:
        "Checkout error states need keyboard focus and an aria-live announcement.",
      capturedAt: "2026-07-29T02:15:00.000Z",
      maxAgeHours: 48,
      expectedHash: "e".repeat(64),
      required: false,
      authority: 75,
      priority: 4,
      topics: ["accessibility", "design"],
    },
  ],
};

export const sampleObservations: SourceObservation[] = [
  {
    sourceId: "project-rules",
    exists: true,
    content: rules,
    currentHash: "a".repeat(64),
  },
  {
    sourceId: "current-state",
    exists: true,
    content: sampleManifest.sources[1]!.content!,
    currentHash: "b".repeat(64),
  },
  {
    sourceId: "old-handoff",
    exists: true,
    content: sampleManifest.sources[2]!.content!,
    currentHash: "c".repeat(64),
  },
  {
    sourceId: "copied-rules",
    exists: true,
    content: duplicate,
    currentHash: "d".repeat(64),
  },
  {
    sourceId: "design-notes",
    exists: true,
    content: sampleManifest.sources[4]!.content!,
    currentHash: "e".repeat(64),
  },
];
