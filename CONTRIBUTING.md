# Contributing

Contributions are welcome, especially adversarial context fixtures and improved
model-neutral selection strategies.

1. Keep freshness and pack decisions deterministic.
2. Do not add model calls to the audit path.
3. Preserve required-first, fail-closed compilation.
4. Add tests for stale, drifted, conflicting, and budget-bound behavior.
5. Update the threat model for trust-boundary changes.
6. Run `pnpm check`.
