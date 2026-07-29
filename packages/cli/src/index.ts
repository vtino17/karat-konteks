#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  compilePack,
  diffManifests,
  verifyPack,
} from "@karatkonteks/core";
import type {
  ContextManifest,
  HandoffPack,
} from "@karatkonteks/core";
import {
  pinManifest,
  scanManifest,
} from "@karatkonteks/runner";
import {
  formatAudit,
  formatDiff,
  formatPackVerification,
} from "./format.js";
import { starterManifest } from "./template.js";

const help = `KaratKonteks — context freshness and handoff compiler

Usage:
  karat-konteks scan <manifest.json> [--workspace <dir>] [--json]
  karat-konteks pin <manifest.json> --output <pinned.json> [--workspace <dir>]
  karat-konteks pack <manifest.json> --output <handoff.md> --receipt <pack.json>
                       [--workspace <dir>] [--budget <tokens>] [--json]
  karat-konteks verify-pack <pack.json> [--manifest <manifest.json>] [--json]
  karat-konteks diff-manifest <old.json> <new.json> [--json]
  karat-konteks init [context.manifest.json]

All source inspection is local. Existing output files are never overwritten.`;

interface Parsed {
  command: string | undefined;
  positionals: string[];
  flags: Map<string, string[]>;
}

function parseArgs(args: string[]): Parsed {
  const [command, ...rest] = args;
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]!;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = rest[index + 1];
    const flagValue = next && !next.startsWith("--") ? next : "true";
    flags.set(key, [...(flags.get(key) ?? []), flagValue]);
    if (flagValue !== "true") index += 1;
  }
  return { command, positionals, flags };
}

async function readJson<T>(path: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    throw new Error(
      `Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function files(parsed: Parsed, count: number): string[] {
  if (parsed.positionals.length < count) {
    throw new Error(`Expected ${count} file argument(s).\n\n${help}`);
  }
  return parsed.positionals;
}

function print(value: unknown, text: string, json: boolean): void {
  process.stdout.write(
    json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n`,
  );
}

async function writeNew(path: string, content: string): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content, { encoding: "utf8", flag: "wx" });
}

async function scanCommand(parsed: Parsed): Promise<number> {
  const [manifestPath] = files(parsed, 1) as [string];
  const manifest = await readJson<ContextManifest>(manifestPath);
  const { audit } = await scanManifest(manifest, {
    workspace: parsed.flags.get("workspace")?.at(-1) ?? process.cwd(),
  });
  print(audit, formatAudit(audit), parsed.flags.has("json"));
  return audit.status === "ready" ? 0 : audit.status === "warning" ? 3 : 2;
}

async function pinCommand(parsed: Parsed): Promise<number> {
  const [manifestPath] = files(parsed, 1) as [string];
  const output = parsed.flags.get("output")?.at(-1);
  if (!output || output === "true") {
    throw new Error("pin requires --output <pinned.json>.");
  }
  const manifest = await readJson<ContextManifest>(manifestPath);
  const pinned = await pinManifest(manifest, {
    workspace: parsed.flags.get("workspace")?.at(-1) ?? process.cwd(),
  });
  await writeNew(output, `${JSON.stringify(pinned, null, 2)}\n`);
  process.stdout.write(`✓ Pinned manifest written to ${output}\n`);
  return 0;
}

async function packCommand(parsed: Parsed): Promise<number> {
  const [manifestPath] = files(parsed, 1) as [string];
  const output = parsed.flags.get("output")?.at(-1);
  const receiptPath = parsed.flags.get("receipt")?.at(-1);
  if (!output || output === "true" || !receiptPath || receiptPath === "true") {
    throw new Error("pack requires --output <handoff.md> and --receipt <pack.json>.");
  }
  const manifest = await readJson<ContextManifest>(manifestPath);
  const { audit, observations } = await scanManifest(manifest, {
    workspace: parsed.flags.get("workspace")?.at(-1) ?? process.cwd(),
  });
  const budgetValue = parsed.flags.get("budget")?.at(-1);
  const budget = budgetValue ? Number(budgetValue) : undefined;
  const pack = await compilePack({
    manifest,
    audit,
    observations,
    ...(budget !== undefined ? { tokenBudget: budget } : {}),
  });
  await writeNew(output, pack.content);
  await writeNew(receiptPath, `${JSON.stringify(pack, null, 2)}\n`);
  print(pack, `✓ Pack compiled · ${pack.selectedSources.length} sources · ${pack.estimatedTokens}/${pack.tokenBudget} tokens\nMarkdown     ${output}\nReceipt      ${receiptPath}\nHash         ${pack.packHash}`, parsed.flags.has("json"));
  return 0;
}

async function verifyCommand(parsed: Parsed): Promise<number> {
  const [packPath] = files(parsed, 1) as [string];
  const manifestPath = parsed.flags.get("manifest")?.at(-1);
  const [pack, manifest] = await Promise.all([
    readJson<HandoffPack>(packPath),
    manifestPath && manifestPath !== "true"
      ? readJson<ContextManifest>(manifestPath)
      : Promise.resolve(undefined),
  ]);
  const result = await verifyPack({
    pack,
    ...(manifest ? { manifest } : {}),
  });
  print(result, formatPackVerification(result), parsed.flags.has("json"));
  return result.valid ? 0 : 5;
}

async function diffCommand(parsed: Parsed): Promise<number> {
  const [oldPath, newPath] = files(parsed, 2) as [string, string];
  const [oldManifest, newManifest] = await Promise.all([
    readJson<ContextManifest>(oldPath),
    readJson<ContextManifest>(newPath),
  ]);
  const diff = diffManifests(oldManifest, newManifest);
  print(diff, formatDiff(diff), parsed.flags.has("json"));
  return diff.weakenedControls.length > 0 ? 4 : 0;
}

async function initCommand(parsed: Parsed): Promise<number> {
  const output = parsed.positionals[0] ?? "context.manifest.json";
  await writeNew(output, `${JSON.stringify(starterManifest, null, 2)}\n`);
  process.stdout.write(`✓ Starter manifest written to ${output}\n`);
  return 0;
}

export async function run(args = process.argv.slice(2)): Promise<number> {
  const parsed = parseArgs(args);
  if (!parsed.command || parsed.command === "help" || parsed.flags.has("help")) {
    process.stdout.write(`${help}\n`);
    return 0;
  }
  if (parsed.command === "scan") return scanCommand(parsed);
  if (parsed.command === "pin") return pinCommand(parsed);
  if (parsed.command === "pack") return packCommand(parsed);
  if (parsed.command === "verify-pack") return verifyCommand(parsed);
  if (parsed.command === "diff-manifest") return diffCommand(parsed);
  if (parsed.command === "init") return initCommand(parsed);
  throw new Error(`Unknown command: ${parsed.command}\n\n${help}`);
}

const entrypoint = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (entrypoint) {
  run()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
