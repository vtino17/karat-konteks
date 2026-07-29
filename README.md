# HandoffSeal

**Context freshness linter and budget-aware handoff compiler for AI agents.**

Long-running agents accumulate instructions, state summaries, copied notes, and
old decisions. A larger context window does not guarantee that this information
is current or mutually consistent.

HandoffSeal inventories context as a manifest, checks freshness and content
drift, resolves structured claim conflicts by authority, finds redundant
sources, and compiles a minimal verifiable handoff pack.

It gives the receiving agent a compact, inspectable context bundle instead of
an opaque summary or an unchecked copy of the previous session.

## Why this is different

Agent package managers make prompts and skills reproducible. Memory frameworks
store and retrieve prior information. HandoffSeal focuses on a different
boundary: **should this exact context still be trusted and carried into the next
session?**

| Capability | HandoffSeal | Agent package manager | Memory/RAG | Chat summary |
| --- | --- | --- | --- | --- |
| Per-source TTL and content pin | Yes | Version-oriented | Varies | No |
| Required source fail-closed | Yes | Dependency failure | No | No |
| Structured contradiction audit | Yes | No | Varies | Model-dependent |
| Redundancy and token pressure | Yes | No | Retrieval-dependent | Hidden |
| Deterministic budget compiler | Yes | No | Ranking only | Model-generated |
| Manifest weakening diff | Yes | Policy-dependent | No | No |
| Content-addressed handoff receipt | Yes | Lockfile | No | No |

No search can prove global uniqueness. The distinctive scope is the combination
of freshness linting, content drift, claim adjudication, redundancy analysis,
and deterministic handoff compilation.

## Included

- `@handoffseal/core`: audit, similarity, claim conflicts, pack compiler, diff,
  and receipt verification;
- `@handoffseal/runner`: safe local file observation, `@file` reference checks,
  and manifest pinning;
- CLI for scan, pin, pack, verify-pack, diff-manifest, and init;
- local React Studio for visual audit and pack rehearsal;
- realistic fresh, stale, redundant, conflicting, drifted, and weakened samples;
- protocol, audit, pack, and threat-model documentation.

## Quick start

Requirements: Node.js 20+ and pnpm 10.

```bash
git clone https://github.com/vtino17/handoff-seal.git
cd handoff-seal
corepack enable
pnpm install
pnpm check
```

Audit the example:

```bash
pnpm seal scan examples/context/fresh-handoff.json \
  --workspace examples/workspace
```

Compile and verify a handoff:

```bash
pnpm seal pack examples/context/fresh-handoff.json \
  --workspace examples/workspace \
  --output .handoff-seal/handoff.md \
  --receipt .handoff-seal/handoff.pack.json

pnpm seal verify-pack .handoff-seal/handoff.pack.json \
  --manifest examples/context/fresh-handoff.json
```

Launch the local Studio:

```bash
pnpm dev
```

## Pinning a manifest

Unpinned context can still be audited, but it receives a warning. Create a new
manifest with current SHA-256 hashes and timestamps:

```bash
pnpm seal pin context.manifest.json \
  --workspace . \
  --output context.pinned.json
```

Existing files are never overwritten.

## Context drift review

```bash
pnpm seal diff-manifest \
  examples/context/fresh-handoff.json \
  examples/context/weakened-handoff.json
```

The command exits non-zero when required sources become optional, freshness
windows expand, or integrity pins disappear.

## How compilation works

Required healthy sources are selected first. Optional sources are ranked by
authority, priority, new topic coverage, freshness, and token cost. Highly
similar optional sources are dropped, and remaining sources compete for the
declared token budget.

The generated Markdown preserves source boundaries and authority metadata. A
JSON receipt binds the exact manifest, content hashes, selection, exclusions,
budget, and final text.

## Research motivation

Recent work on stale agent memory reports a substantial gap between retrieving
new evidence and actually abandoning invalid old assumptions. Separate
long-horizon agent research reports that selective recent context plus
summarization can outperform full history while using far fewer tokens.

- [STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?](https://arxiv.org/abs/2605.06527)
- [Less Context, Better Agents](https://arxiv.org/abs/2606.10209)
- [OpenAI Agents SDK handoff documentation](https://github.com/openai/openai-agents-python/blob/main/docs/handoffs.md)

These sources motivate the project; they do not certify or endorse it.

## Documentation

- [Context Manifest specification](docs/MANIFEST.md)
- [Audit model](docs/AUDIT.md)
- [Handoff Pack specification](docs/PACK.md)
- [Threat model](docs/THREAT-MODEL.md)

## Repository layout

```text
apps/studio/       Local freshness workbench
packages/core/     Audit and pack algorithms
packages/runner/   Workspace observation and pinning
packages/cli/      Developer and CI commands
examples/          Manifests and synthetic workspace
docs/              Protocol and security guidance
```

## Status

HandoffSeal is an experimental reference implementation. It can show that
context is fresh relative to its manifest; it cannot prove that the information
is true or that the manifest author assigned authority correctly.

## License

[MIT](LICENSE)
