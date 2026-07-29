# Audit model

KaratKonteks performs four independent checks.

## Freshness and integrity

Source timestamps are compared with `maxAgeHours`, and current content is
compared with `expectedHash`. `pin` writes a new manifest instead of modifying
the original.

## Claim conflicts

Claims are grouped by scope, normalized subject, and predicate. If values differ,
the value from the uniquely highest-authority source is shown as resolved. A tie
at the highest authority remains unresolved. Unresolved conflicts involving a
required source block handoff.

This is deterministic precedence, not semantic reasoning. Claims such as
“moving office invalidates commute time” must be modeled explicitly.

## Redundancy

Normalized three-word shingles are compared using Jaccard similarity. Pairs at
or above 0.72 are reported; the pack compiler suppresses optional duplicates at
or above 0.82 when a matching source is already selected.

## Token pressure

Tokens are estimated as Unicode character count divided by four plus per-source
framing overhead. This is intentionally model-neutral and approximate. Exact
tokenizers vary by provider and model.

The health score is explanatory. Blocking decisions come from required source
integrity and unresolved required conflicts, not from an arbitrary score cutoff.
