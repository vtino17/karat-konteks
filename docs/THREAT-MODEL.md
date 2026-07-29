# Threat model

## In scope

- stale instructions survive into a new agent session;
- source content changes after a handoff was prepared;
- two sources assert incompatible facts;
- copied context wastes limited model input;
- an optional source crowds out required context;
- a file path or symlink escapes the workspace;
- an included document references a missing local artifact;
- a manifest change weakens freshness or removes integrity pins;
- a handoff pack is modified after compilation.

## Controls

- explicit TTL, authority, priority, and required fields;
- local SHA-256 observation and pinning;
- fail-closed required source handling;
- deterministic claim precedence and tie detection;
- similarity-based redundancy reporting;
- budget-aware source selection with required-first ordering;
- workspace path and realpath containment;
- broken `@path/file` reference checks;
- manifest weakening diff and content-addressed pack receipts.

## Out of scope

KaratKonteks does not determine whether content is factually true, safe, or free
from prompt injection. Authority is declared by the manifest author, not
cryptographically proven.

The tool reads local context and can place it into a pack. Do not include secrets
unless the receiving agent and pack storage are authorized to access them.

The token estimator is approximate. Always reserve headroom for system prompts,
tool schemas, conversation turns, and model output.
