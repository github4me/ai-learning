# Course Content Proofreading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every website lesson faithful to the complete 170-page PDF, with mathematically correct symbols and layout, preserved prose, and validation that prevents silent formatting regressions.

**Architecture:** The checked-in PDF extraction remains the immutable source. Formula transcription will consume positioned source spans instead of flattened text, and every structured formula will be pinned in a checksum-backed review ledger; ambiguous stacked layouts receive explicit human-reviewed LaTeX. The validator will independently require complete ledger coverage, source coverage, valid KaTeX, reviewed formula fidelity, and the absence of extraction placeholders.

**Tech Stack:** TypeScript, checked-in compressed PyMuPDF extraction, KaTeX, Zod, React, vinext, PowerShell/Poppler for visual review.

**Spec:** `docs/superpowers/specs/2026-09-03-ai-first-principles-learning-site-design.md`

## Global Constraints

- The source of truth is `C:\Users\Chao\Desktop\AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf` with SHA-256 `3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52`.
- Preserve source prose in source order; do not paraphrase or invent course content. The only exception is an objectively wrong or materially misleading source claim documented by the independent correctness audit and applied through a checksum-backed override.
- Correct formula display must preserve superscripts, subscripts, fractions, roots, matrices, accents, operators, arrows, Greek letters, and function names.
- Every generated formula must remain linked to its PDF page, source lines, span IDs, and checksum.
- Unknown math layouts or characters must stop generation instead of being emitted as readable-looking placeholder text.
- Per the user's instruction, do not write or run the repository test suites. Use source audits, content validation, lint, type checking, production build, and visual browser checks.
- Keep the local production preview available on port `8787` after completion.

---

### Task 1: Establish the complete fidelity audit

**Files:**
- Create: `tmp/formula-audit/audit-pages-010-060.md`
- Create: `tmp/formula-audit/audit-pages-061-115.md`
- Create: `tmp/formula-audit/audit-pages-116-160.md`
- Modify: `docs/superpowers/plans/2026-09-04-course-content-proofreading.md`

**Interfaces:**
- Consumes: `source-audit.generated.json.gz`, `course.generated.json`, `conversion-report.generated.json`, and rendered PDF pages.
- Produces: a block-ID-indexed list of expected LaTeX and accessible text for every defect.

- [x] **Step 1: Inventory every structured formula**

  Enumerate all `formula` blocks and join each block ID to `candidateAudit.lineIndexes`, `sourceSpanIds`, and its PDF page.

- [x] **Step 2: Inspect all formula-bearing pages**

  Render relevant PDF pages with Poppler and compare every formula against the generated website value, recording the expected expression and evidence.

- [x] **Step 3: Audit prose preservation and obvious extraction corruption**

  Compare normalized source body tokens with generated paragraphs for every course unit, separately accounting for headings and structured blocks.

### Task 2: Preserve one-line mathematical structure from source spans

**Files:**
- Modify: `scripts/source-audit.mts`
- Modify: `scripts/normalize-course.mts`
- Create: `scripts/formula-transcription.mts`

**Interfaces:**
- Consumes: ordered `RawSpan.textRaw`, `font`, `size`, `bbox`, and `origin` values for one single-line formula candidate.
- Produces: `transcribeOneLineFormula(spans): { latex: string; accessibleText: string }`.

- [x] **Step 1: Retain the source baseline data**

  Add `origin: [number, number]` to the shared `RawSpan` type and derive the dominant formula baseline from the largest math spans.

- [x] **Step 2: Convert glyphs without flattening scripts**

  Convert smaller spans above the baseline to `^{...}` and smaller spans below it to `_{...}`. Convert mathematical Unicode letters to ordinary math-mode letters and preserve operators with explicit LaTeX commands.

  ```ts
  type FormulaRendering = { latex: string; accessibleText: string };

  function transcribeOneLineFormula(
    spans: readonly RawSpan[],
  ): FormulaRendering;
  ```

- [x] **Step 3: Handle accents and upright names**

  Reconstruct hat accents such as `\\hat{y}` and render source-upright names such as `Loss`, `MSE`, `ReLU`, and `softmax` with `\\mathrm` or `\\operatorname`.

### Task 2A: Audit objective instructional correctness

**Files:**
- Create: `tmp/formula-audit/content-correctness-pages-010-088.md`
- Create: `tmp/formula-audit/content-correctness-pages-089-170.md`

**Interfaces:**
- Consumes: the source extraction, rendered PDF, generated course, and authoritative primary documentation where an API claim is time-sensitive.
- Produces: a page/block-indexed list of objectively incorrect or materially misleading claims, distinguished from website-only conversion defects.

- [x] **Step 1: Check calculations and mathematical claims**

  Recompute examples, tensor shapes, derivatives, parameter counts, and formula-to-explanation mappings across the complete course.

- [x] **Step 2: Check code and terminology claims**

  Verify code/output descriptions, architecture terminology, and API behavior; avoid stylistic rewrites and record only material correctness issues.

- [x] **Step 3: Apply only evidence-backed corrections**

  Add checksum-backed source overrides for confirmed source mistakes and preserve verbatim source text everywhere else.

### Task 3: Pin every formula to a reviewed transcription ledger

**Files:**
- Create: `src/content/formula-review-ledger.json`
- Create: `scripts/formula-review-ledger.mts`
- Modify: `scripts/normalize-course.mts`

**Interfaces:**
- Consumes: the three range-audit reports, source candidate checksums, and the Task 2 one-line transcription output.
- Produces: one reviewed, checksum-backed payload for every structured formula, including explicit transcriptions for matrices, vectors, fractions, sums/products with limits, piecewise expressions, and other multi-line candidates.

- [x] **Step 1: Add complete reviewed formula coverage**

  For all 371 structured formula candidates, add the detector candidate ID, target block ID, exact PDF page, line indexes, source checksum, LaTeX, accessible text, reviewer, and review status.

  ```ts
  export type ReviewedFormula = {
    candidateId: string;
    blockId: string;
    pdfPage: number;
    lineIndexes: number[];
    sourceSpanIds: string[];
    sourceChecksum: string;
    sourceGeometryChecksum: string;
    latex: string;
    accessibleText: string;
    reviewer: string;
    status: 'reviewed';
  };
  ```

- [x] **Step 2: Require ledger-backed handling**

  Stop normalization when any structured formula has no exact ledger entry or when its source evidence changed; never fall back to flattened `\\text{...}`.

### Task 4: Add independent regression gates and regenerate content

**Files:**
- Modify: `scripts/content-corrections.mts`
- Modify: `scripts/validate-content.mts`
- Modify: `scripts/content-review-trust-root.mts`
- Modify: `src/content/course.generated.json`
- Modify: `src/content/conversion-report.generated.json`
- Modify: `reports/content-conversion.md`

**Interfaces:**
- Consumes: regenerated course content and source audit.
- Produces: a successful validation only when every source formula is semantically represented and all source content is accounted for.

- [x] **Step 1: Add structural formula invariants**

  Reject unresolved `symbol<hex>` tokens, script-like flattened tokens such as `x2` when span geometry marks a script, unreviewed multi-line formulas, empty expressions, and KaTeX warnings/errors.

- [x] **Step 2: Extend prose parity to all course units**

  Independently rebuild source and output projections for Weeks 1-12 and Appendix A and require matching normalized token streams after documented math/format transformations.

- [x] **Step 2A: Correct reviewed body-structure and source-content defects**

  Repair the audited split fractions, missing diagram nodes, missing `d_v` subscripts, `row42` merge, inline-math geometry, and any independently confirmed source-content errors through checksum-backed normalization rules rather than edits to generated JSON.

- [x] **Step 3: Regenerate checked-in artifacts**

  Run `pnpm normalize:content` and `pnpm validate:content`, then confirm there are zero unresolved warnings and no placeholder matches.

### Task 5: Verify production rendering and handoff

**Files:**
- No additional source files expected.

**Interfaces:**
- Consumes: the production build and LAN preview.
- Produces: a clean commit and a verified mobile URL.

- [x] **Step 1: Run non-test quality gates**

  Run `pnpm validate:content`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and `git diff --check`.

- [x] **Step 2: Inspect representative formulas at mobile width**

  Check at least scripts, matrices, fractions, roots, sums, Greek symbols, arrows, and code/prose boundaries at a 390-by-844 viewport.

- [x] **Step 3: Restart and verify the LAN preview**

  Start the production worker on `0.0.0.0:8787`, verify the loopback and LAN URLs return `200`, and keep the server running.

- [x] **Step 4: Commit the complete correction**

  Commit the generator, reviewed corrections, generated content, validation rules, and audit documentation together with a descriptive message.
