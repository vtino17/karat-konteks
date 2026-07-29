export type SourceKind = "file" | "inline";
export type SourceStatus =
  | "healthy"
  | "unpinned"
  | "stale"
  | "drifted"
  | "missing"
  | "error";
export type AuditStatus = "ready" | "warning" | "blocked";

export interface ContextClaim {
  subject: string;
  predicate: string;
  value: unknown;
  scope?: string;
}

export interface ContextSource {
  id: string;
  label: string;
  kind: SourceKind;
  path?: string;
  content?: string;
  capturedAt: string;
  maxAgeHours: number;
  expectedHash?: string;
  required: boolean;
  authority: number;
  priority: 1 | 2 | 3 | 4 | 5;
  topics: string[];
  claims?: ContextClaim[];
}

export interface ContextManifest {
  contextVersion: "1.0";
  id: string;
  goal: string;
  generatedAt: string;
  tokenBudget: number;
  sources: ContextSource[];
}

export interface BrokenReference {
  path: string;
  exists: boolean;
}

export interface SourceObservation {
  sourceId: string;
  exists: boolean;
  content?: string;
  currentHash?: string;
  sizeBytes?: number;
  brokenReferences?: BrokenReference[];
  error?: string;
}

export interface SourceAudit {
  sourceId: string;
  status: SourceStatus;
  ageHours: number;
  estimatedTokens: number;
  currentHash: string | null;
  issues: string[];
}

export interface Contradiction {
  key: string;
  scope: string;
  subject: string;
  predicate: string;
  variants: Array<{
    value: unknown;
    sourceIds: string[];
    maxAuthority: number;
  }>;
  resolvedValue: unknown | null;
  unresolved: boolean;
}

export interface Redundancy {
  sourceA: string;
  sourceB: string;
  similarity: number;
}

export interface ContextAudit {
  manifestId: string;
  status: AuditStatus;
  healthScore: number;
  totalEstimatedTokens: number;
  tokenBudget: number;
  budgetExceededBy: number;
  sources: SourceAudit[];
  contradictions: Contradiction[];
  redundancies: Redundancy[];
  auditedAt: string;
}

export interface PackSource {
  sourceId: string;
  label: string;
  currentHash: string;
  authority: number;
  required: boolean;
  topics: string[];
  estimatedTokens: number;
}

export interface HandoffPack {
  packVersion: "1.0";
  packId: string;
  manifestId: string;
  manifestHash: string;
  goal: string;
  generatedAt: string;
  tokenBudget: number;
  estimatedTokens: number;
  selectedSources: PackSource[];
  excludedSources: Array<{ sourceId: string; reason: string }>;
  content: string;
  packHash: string;
}

export interface PackVerification {
  valid: boolean;
  checks: {
    packHash: boolean;
    manifestHash: boolean | null;
    selectedSources: boolean;
    tokenEstimate: boolean;
  };
  errors: string[];
}

export interface ManifestDiff {
  from: string;
  to: string;
  added: string[];
  removed: string[];
  modified: string[];
  weakenedControls: string[];
  contextDrift: string[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}
