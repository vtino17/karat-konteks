import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

function inside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export async function safePath(
  workspace: string,
  requested: string,
): Promise<string> {
  if (isAbsolute(requested)) throw new Error("Absolute paths are not allowed.");
  const root = await realpath(workspace);
  const candidate = resolve(root, requested);
  if (!inside(root, candidate)) throw new Error("Path escapes the workspace.");
  const resolved = await realpath(candidate);
  if (!inside(root, resolved)) {
    throw new Error("Symlink resolves outside the workspace.");
  }
  return resolved;
}
