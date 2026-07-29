import { access, readFile, realpath, stat } from "node:fs/promises";
import {
  assertManifest,
  auditContext,
  sha256,
} from "@karatkonteks/core";
import type {
  ContextAudit,
  ContextManifest,
  SourceObservation,
} from "@karatkonteks/core";
import { safePath } from "./path.js";

const defaultMaxSourceBytes = 2_000_000;

function references(content: string): string[] {
  const matches = content.matchAll(
    /(?:^|[\s(])@([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+)/g,
  );
  return [...new Set([...matches].map((match) => match[1]!))].sort();
}

async function referenceStatus(
  workspace: string,
  path: string,
): Promise<{ path: string; exists: boolean }> {
  try {
    await access(await safePath(workspace, path));
    return { path, exists: true };
  } catch {
    return { path, exists: false };
  }
}

async function observeSource(
  source: ContextManifest["sources"][number],
  workspace: string,
  maxSourceBytes: number,
): Promise<SourceObservation> {
  try {
    let content: string;
    let sizeBytes: number;
    if (source.kind === "inline") {
      content = source.content ?? "";
      sizeBytes = Buffer.byteLength(content);
    } else {
      const absolute = await safePath(workspace, source.path ?? "");
      const stats = await stat(absolute);
      if (!stats.isFile()) throw new Error("Source path is not a regular file.");
      if (stats.size > maxSourceBytes) {
        throw new Error(
          `Source is ${stats.size} bytes; limit is ${maxSourceBytes}.`,
        );
      }
      content = await readFile(absolute, "utf8");
      sizeBytes = stats.size;
    }
    const brokenReferences = await Promise.all(
      references(content).map((path) => referenceStatus(workspace, path)),
    );
    return {
      sourceId: source.id,
      exists: true,
      content,
      currentHash: await sha256(content),
      sizeBytes,
      brokenReferences,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      sourceId: source.id,
      exists: !message.includes("ENOENT"),
      error: message,
    };
  }
}

export async function observeManifest(
  manifestValue: unknown,
  options: {
    workspace: string;
    maxSourceBytes?: number;
  },
): Promise<SourceObservation[]> {
  assertManifest(manifestValue);
  const workspace = await realpath(options.workspace);
  return Promise.all(
    manifestValue.sources.map((source) =>
      observeSource(
        source,
        workspace,
        options.maxSourceBytes ?? defaultMaxSourceBytes,
      ),
    ),
  );
}

export async function scanManifest(
  manifestValue: unknown,
  options: {
    workspace: string;
    maxSourceBytes?: number;
    now?: Date;
  },
): Promise<{ audit: ContextAudit; observations: SourceObservation[] }> {
  assertManifest(manifestValue);
  const observations = await observeManifest(manifestValue, options);
  return {
    audit: auditContext(manifestValue, observations, options.now),
    observations,
  };
}

export async function pinManifest(
  manifestValue: unknown,
  options: {
    workspace: string;
    maxSourceBytes?: number;
    now?: Date;
  },
): Promise<ContextManifest> {
  assertManifest(manifestValue);
  const observations = await observeManifest(manifestValue, options);
  const byId = new Map(
    observations.map((observation) => [observation.sourceId, observation]),
  );
  for (const source of manifestValue.sources) {
    const observation = byId.get(source.id);
    if (!observation?.exists || !observation.currentHash || observation.error) {
      throw new Error(`Cannot pin source "${source.id}": ${observation?.error ?? "missing"}.`);
    }
  }
  const capturedAt = (options.now ?? new Date()).toISOString();
  return {
    ...manifestValue,
    generatedAt: capturedAt,
    sources: manifestValue.sources.map((source) => ({
      ...source,
      capturedAt,
      expectedHash: byId.get(source.id)!.currentHash!,
    })),
  };
}
