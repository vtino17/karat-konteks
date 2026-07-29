# Context Manifest 1.0

A Context Manifest inventories information intended for an AI agent session.
Each source records provenance, freshness expectations, authority, priority,
topics, and optional structured claims.

## Source fields

| Field | Purpose |
| --- | --- |
| `id` | Stable identifier used in audit and packs |
| `kind` | `file` or `inline` |
| `path` / `content` | Local source location or embedded content |
| `capturedAt` | When the source was accepted as context |
| `maxAgeHours` | Maximum safe age before refresh |
| `expectedHash` | Optional SHA-256 content pin |
| `required` | Whether a bad source blocks handoff |
| `authority` | Conflict precedence from 0–100 |
| `priority` | Pack selection importance from 1–5 |
| `topics` | Coverage labels used by the compiler |
| `claims` | Structured subject/predicate/value assertions |

At least one source must be required. File paths are workspace-relative and
existing symlinks must resolve inside the workspace.

## States

- `healthy`: observed hash and TTL pass.
- `unpinned`: source is fresh but has no expected hash.
- `stale`: source age exceeds its TTL.
- `drifted`: current hash differs from the pin.
- `missing`: source is absent.
- `error`: observation failed or a referenced `@path/file` is broken.

A required stale, drifted, missing, or errored source blocks compilation.
