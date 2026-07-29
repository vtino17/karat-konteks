# Handoff Pack 1.0

The compiler creates the smallest useful context pack under a declared token
budget.

1. Select every eligible required source.
2. Fail if required sources alone exceed the budget.
3. Score optional sources by authority, priority, new topic coverage, freshness,
   and token cost.
4. Skip high-similarity duplicates.
5. Stop when the remaining budget cannot fit another source.

Selected content is wrapped in explicit `<context-source>` boundaries with
authority and capture metadata. Excluded sources retain a machine-readable
reason such as `token-budget`, `redundant-with-selected-source`, or
`source-stale`.

The pack receipt binds the exact manifest hash, source hashes, selection,
content, estimated budget, and timestamp through SHA-256.

Hashes detect mutation but do not authenticate the compiler. Sign `packHash`
with a separately controlled identity when authorship matters.
