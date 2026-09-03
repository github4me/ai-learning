# Task 4 implementation report

## TDD evidence

### RED

After adding behavior-focused storage, store, and search tests, this command
failed because the new production modules did not yet exist:

```powershell
pnpm test -- tests/learning/storage-adapter.test.ts tests/learning/learning-store.test.ts tests/search/course-search.test.ts
```

Vitest reported unresolved imports for `@/src/learning/storage-adapter`,
`@/src/learning/learning-store`, and `@/src/search/course-search`.

### GREEN

The focused suite passes after implementing the modules:

```powershell
pnpm test -- tests/learning tests/search
# 8 files, 59 tests passed
```

Verification also passed:

```powershell
pnpm exec oxlint src/learning src/search tests/learning tests/search
node node_modules/typescript/bin/tsc --noEmit
pnpm test
pnpm build
```

`pnpm test` passed 8 files / 59 tests. The production build completed
successfully (with Vinext's pre-existing informational dynamic-route notice).

## Delivered behavior

- Versioned Zod-validated V1 learner state, V0 migration, alias application, and
  deterministic collision retention.
- Defensive browser storage with recovery payloads, 20,000-code-point note and
  5 MiB import limits, atomic import writes, quota retention, and debounced note
  flushing on browser lifecycle events.
- Testable vanilla Zustand learning store with progress and continue selectors,
  immediate non-note persistence, appendix isolation, and undoable note removal.
- Normalized MiniSearch indexing for visible course sections, recursive plain-text
  extraction, CJK segmentation fallback, deterministic source-stable results, and
  safe capped excerpts.

## Review fix round 1

### RED

Added regressions for quota-failed import recovery/retry, strict V0/V1 and nested
unknown-key rejection, throwing `getItem`/`removeItem`, returned store persistence
outcomes, real `Intl.Segmenter` absence, and exact generated search targets. The
focused run failed on the prior import throw/rollback, non-strict parsing,
unsurfaced store results, missing automatic CJK fallback, and Attention ranking.

### GREEN

`StorageAdapter` now validates and canonicalizes imports before the one storage
write. A failed import returns a structured result and retains the canonical
candidate only in its recovery slot; the active state and local-storage value stay
unchanged. V0/V1 and all nested records are strict, store mutations return typed
persistence outcomes, and the CJK fallback activates whenever `Intl.Segmenter` is
actually unavailable. Exact target assertions pass for gradient descent, neural
network, Attention, and CrossEntropyLoss.

## Review fix round 2

### RED

Added a regression that seeds a strict-invalid stored payload, verifies clean
hydration plus recovery retention without an overwrite, and then requires a valid
persist to succeed. It failed because hydration treated parse/schema errors as a
storage-access failure. The canonical query tests were also strengthened to require
exact IDs and safe, query-relevant excerpts for every required query.

### GREEN

Storage reads are now separated from parse/migration work: only an actual
`getItem` exception marks storage unavailable. Corrupt or unsupported serialized
state remains recoverable while the backend stays writable. The focused suite
passes 68 tests with the strengthened canonical-excerpt assertions.
