# Task 3 implementation report — complete PDF conversion

Date: 2026-09-03
Branch: `feat/ai-learning-site`
Source: `AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf`

## Outcome

The pinned 170-page PDF is converted into checked-in, runtime-validated JSON. All 461 unique outline destinations are represented by stable recursive sections: page 10 and the `阅读说明` root are represented by `course.overview`, while `course.units` remains exactly 12 sequential week units followed by Appendix A. The page manifest accounts for every physical page, and the conversion report accounts for every positioned source span.

The content validator passes with zero unresolved warnings. The generated artifacts are byte-for-byte deterministic across a second normalization run.

## Pinned source and extraction

- Expected and observed SHA-256: `3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52`
- Physical pages: 170
- Unique outline title/page destinations: 461
- Outline depths: 14 roots, 288 depth-1 nodes, 159 depth-2 nodes
- Positioned spans: 42,408
- Positioned lines: 7,498
- pypdf visitor spans: 16,366
- Extractor versions used for the checked raw extraction: pypdf 6.16.1 and PyMuPDF 1.28.2

`scripts/extract_pdf.py` computes and asserts the source checksum before extraction. It emits source metadata, the recursively flattened outline with parent indexes, pypdf plain text and visitor spans, PyMuPDF positioned spans/lines (including font, size, and bounding boxes), and detected printed-page labels. Raw text is retained unchanged for audit; compatibility normalization is applied only in comparison projections.

The first direct bundled-Python attempt failed because the bundled environment did not contain PyMuPDF (`ModuleNotFoundError: fitz`). The successful regeneration used the bundled Python executable with the available Python 3.12 site-packages added through `PYTHONPATH`:

```powershell
$env:PYTHONPATH='C:\Users\Chao\AppData\Local\Programs\Python\Python312\Lib\site-packages'
& 'C:\Users\Chao\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/extract_pdf.py --input 'C:\Users\Chao\Desktop\AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf' --output tmp/pdf-extraction/raw.json
```

Successful extraction summary:

```json
{
  "sha256": "3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52",
  "pageCount": 170,
  "outlineDestinations": 461,
  "extractorVersions": { "pypdf": "6.16.1", "PyMuPDF": "1.28.2" }
}
```

The full raw extraction is regeneration-only and remains under ignored `tmp/`. A deterministic 1,336,369-byte `src/content/source-audit.generated.json.gz` contains the source outline, pages, lines, spans, coordinates, fonts, and checksums needed for independent clean-checkout validation. Runtime and builds consume checked-in JSON only.

## Implementation

### Outline-driven course construction

`scripts/normalize-course.mts` verifies correction checksums, creates one stable `SectionNode` for every outline destination, reconstructs the source hierarchy, assigns source lines to the active outline node, and emits:

- `src/content/course.generated.json`
- `src/content/page-manifest.generated.json`
- `src/content/conversion-report.generated.json`
- `reports/content-conversion.md`

Two source-outline destinations point to the page immediately before their visible heading. The normalizer records explicit page-edge heading corrections for outline indexes 358 (source destination p131, visible heading p132) and 431 (source destination p155, visible heading p156), plus eight same-page heading-line corrections. No destination is dropped.

All 42,408 positioned spans have exactly one disposition: 10,762 are assigned to runtime blocks and 31,646 are reviewed exclusions. Exclusions are limited to explicitly explained front matter/navigation replacement, running headers, printed footers, and headings represented structurally by section nodes.

### Page manifest

- Pages 1-170 occur once each and in physical order.
- Page 1 is `frontMatter` with a nonempty reason.
- Pages 2-9 are `navigationReplaced` with nonempty reasons.
- Pages 10-170 are `content` and carry exact printed-page labels 1-161.
- Content pages resolve to a stable runtime section.

### Structured blocks and correction maps

`scripts/content-corrections.mts` is the checked, source-critical correction map. Every entry contains its physical page, exact line indexes, source-span checksum, final typed value, and review disposition. Any source checksum change is fatal.

The final course contains 461 sections and 4,354 blocks when nested callout/check blocks are counted recursively:

| Runtime block type |     Count |
| ------------------ | --------: |
| Paragraph          |     3,869 |
| List               |        62 |
| Callout             |        15 |
| Concept chain       |        26 |
| Formula            |       371 |
| Table              |         3 |
| Code               |         4 |
| Knowledge check    |         4 |
| **Total**          | **4,354** |

Formula discovery is independent of corrections: 605 LatinModernMath rows are grouped by raw span geometry into 381 candidates. Rendered review classified 371 as display formulas and 10 as inline math. Corrections resolve known formulas but do not create the discovery universe. Every independently discovered formula/table/code/check candidate has checksummed source evidence and a reviewed disposition.

### Appendix A recovery

Appendix A is reconstructed from positioned lines on physical pages 161-170 using a measured 62.362 pt left base and 1.79125 pt per-space grid. The result is one Python block with:

- 472 visual lines
- 18,411 characters
- SHA-256 `0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd`
- successful extraction-time Python `ast.parse` evidence using the bundled Python executable

The validator hashes the raw JSON code value rather than the schema-trimmed runtime string so the exact final newline and line count are audited.

## Required interface changes and RED/GREEN evidence

Two source facts made small Task 2 contract extensions necessary; both were approved before implementation.

### Required course overview

Page 10 and the top-level `阅读说明` outline root cannot be placed in the invariant 13-unit learning sequence without misrepresenting the source. The `Course` contract therefore adds required `overview: SectionNode`; the loader now includes it in stable-ID validation and `findSection`, while preserving exactly Weeks 1-12 followed by Appendix A.

- RED: the new schema test expected `overview.id === 'overview'`; the prior Zod object stripped the field and returned `undefined`.
- GREEN: the schema/loader suite passed after adding the required field and updating fixtures/invariants.
- Selector RED: `findSection(course, 'overview')` returned `undefined`.
- Selector GREEN: `findSection` now traverses `[course.overview, ...course.units]`; targeted result is 9/9 passing.

### Auditable page classifications

`PageManifestEntry` adds optional `printedPageLabel?: string` and `reason?: string`. A schema refinement requires a nonempty reason for every classification other than `content`; the existing camelCase values remain unchanged.

- RED: `printedPageLabel` was stripped from parsed entries, and `frontMatter` without `reason` was accepted.
- GREEN: both tests passed after the schema extension/refinement; fixtures and generated manifest were updated consistently.

## Test-driven development record

1. `pnpm test -- tests/content/course-content.test.ts` — expected RED: Vite/Vitest could not resolve the three not-yet-created generated JSON imports.
2. Overview schema test — expected RED: overview absent after parsing.
3. Page-manifest tests — expected RED: printed label absent and unexplained non-content entry accepted.
4. `tests/content/content-validator.test.ts` — expected RED: `scripts/validate-content.mts` did not exist.
5. First validator GREEN attempt correctly failed on a Week 3 token mismatch. Root cause: the canonical tokenizer did not isolate Han characters adjacent to Latin text. The projection was corrected, then the validator exposed table source-line concatenation and the schema-trimmed Appendix final newline. Both validators were corrected at the comparison boundary, not suppressed.
6. Overview selector test — expected RED: `findSection` searched units only; GREEN after overview traversal was added.
7. Current targeted results after fix round 1: generated-content semantics 8/8 and validator/mutation coverage 9/9.

## Prose and fidelity validation

`scripts/validate-content.mts` independently reads the checked compressed source audit plus generated artifacts and recomputes every gate. It does not read ignored `tmp/` data and does not trust the report's summary counters. It validates:

- pinned source and public-copy checksums;
- 170 physical pages and printed-label mapping;
- 461 unique outline destinations, 14 roots, and 461 resolvable section mappings;
- exactly 12 sequential weeks plus Appendix A, with a separate page-10 overview;
- global uniqueness of runtime section/block IDs and source-span dispositions;
- exact Week 2 and Week 3 normalized token sequences and independently recomputed checksums;
- the independently detected candidate universe, candidate checksums, reviewed dispositions, and block links;
- correction-map source span checksums and reviewed status;
- strict KaTeX rendering of all 371 display formulas;
- table cell order/text against source line spans;
- literal code source order and Appendix hash/line count plus portable `@lezer/python` grammar parsing;
- absence of replacement glyphs and forbidden control characters;
- zero unresolved warnings.

Week 2 has 3,956 normalized tokens and Week 3 has 7,775. In both cases, the source stream is rebuilt independently from all body spans and structural headings on physical pages 21-73, and source/output token sequences are identical after only Unicode NFC, whitespace tokenization, proven visual-line dehyphenation, extraction-NUL removal, Han-character token separation, and the explicitly permitted U+2010/U+2011/U+2013/U+2212-to-ASCII-hyphen mappings. Compatibility-character changes therefore remain detectable.

## Reviewed rendered-source evidence

Source pages were rendered with bundled Poppler at 100 dpi. Category-colored audit overlays were produced for all 148 pages containing at least one independently discovered candidate and inspected across 13 contact sheets against the exact audit spans and report dispositions.

- p10: overview and complete 12-row chapter table.
- p20, p69, p84, p159: all four knowledge-check prompts and review targets.
- p21-35: every Week 2 page, including the x/y table, `predict` code, learning-chain text, and display formulas.
- p36-73: every Week 3 page, including prose flow and formula pages.
- p74: Week 4 entry and formula values.
- p107 and p109: attention equation, negative-infinity notation, and `AttentionHead` indentation/order.
- p129-136: GPT configuration code and surrounding structured content.
- p150-160: Week 12 integration and final check.
- p161-170: every Appendix page, including first/last endpoints and all visible indentation depths.

The review found no discrepancy between the candidate geometry/dispositions and rendered source pages. The complete reviewed universe is 381 formula candidates (371 structured, 10 inline), 39 table candidates (4 mapped to 3 tables, 35 not-table), 380 code candidates (13 mapped to 4 code blocks, 367 not-code), and 12 check candidates (4 structured, 8 not-check). The machine-readable candidate records retain reviewer, status, physical page, line indexes, span IDs, source checksum, rationale, disposition, and block ID where applicable.

## Commands and observed results

Node/pnpm commands prepended the bundled Node and pnpm fallback directories to `PATH`.

| Command                                                    | Result                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm normalize:content`                                   | PASS — 170/170 pages, 461/461 outline, 381/39/380/12 independent candidates, 10,762 assigned + 31,646 excluded spans, 472 Appendix lines, 0 warnings                                                                 |
| hash generated artifacts → normalize again → hash again    | PASS — all four emitted files byte-identical                                                                                                                                                                         |
| `pnpm validate:content`                                    | PASS — 170 pages, 461 outline/sections, 4,354 recursive blocks, 371 formulas, 3 tables, 4 code blocks, 4 knowledge checks, 472 Appendix lines, 0 warnings                                                            |
| `pnpm test -- tests/content/course-content.test.ts`        | PASS — earlier baseline run, before fix-round additions                                                                                                                                                              |
| `pnpm test`                                                | PASS — 5 files, 28 tests                                                                                                                                                                                             |
| `pnpm exec vitest run tests/content/course-schema.test.ts` | PASS — 1 file, 9 tests                                                                                                                                                                                               |
| `pnpm exec tsc --noEmit`                                   | PASS                                                                                                                                                                                                                 |
| `pnpm exec oxlint scripts src/content tests/content`       | PASS                                                                                                                                                                                                                 |
| `pnpm build`                                               | PASS — all five vinext build stages complete                                                                                                                                                                         |
| `pnpm lint`                                                | FAIL outside Task 3 — pre-existing UI/component rules in `src/components/course/course-overview.tsx`, `components/ui/*`, and `hooks/use-mobile.ts`; Task 3-owned paths are clean under the scoped lint command above |

## Files changed

- `scripts/extract_pdf.py`
- `scripts/content-corrections.mts`
- `scripts/normalize-course.mts`
- `scripts/source-audit.mts`
- `scripts/candidate-review-ledger.mts`
- `scripts/validate-content.mts`
- `src/content/course.generated.json`
- `src/content/page-manifest.generated.json`
- `src/content/conversion-report.generated.json`
- `src/content/source-audit.generated.json.gz`
- `src/content/candidate-review-ledger.json`
- `src/content/schema.ts`
- `src/content/load-course.ts`
- `tests/content/course-content.test.ts`
- `tests/content/content-validator.test.ts`
- `tests/content/course-schema.test.ts`
- `reports/content-conversion.md`
- `reports/content-review-evidence/index.json`
- `reports/content-review-evidence/sheet-*.jpg` (13 checked contact sheets)
- `public/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`

## Self-review

- The runtime/build path has no Python or PDF parsing dependency; all content is checked-in JSON.
- Source identity is checked at extraction and validation, including the public copy.
- The direct outline map, stable IDs, manifest page mapping, and span accounting are recomputed rather than accepted from summary counts.
- Independent candidate detection is source-derived; structured corrections fail closed when source geometry/text changes.
- Generated output is deterministic and contains no timestamps that vary per run.
- The approved overview and page-manifest interface changes remain minimal and preserve the 13-unit invariant.
- No manual-review claim was made before the relevant rendered page/span comparison was completed.

## Concerns and follow-up

1. The bundled Python interpreter includes pypdf but not PyMuPDF on this host. Full PDF re-extraction therefore currently needs the recorded Python 3.12 `PYTHONPATH`; clean validation, normalization, runtime, build, and Appendix syntax validation do not.
2. The repository-wide lint command is not green because of existing UI/component violations outside Task 3. Task 3-owned scripts, content runtime, and tests pass scoped oxlint.
3. Reviewed formula candidates without a hand-authored correction use a safe KaTeX text representation backed by exact accessible source text and span checksums. This preserves source content and display structure, but hand-authoring normalized mathematical LaTeX for all 371 formulas would be a separate editorial enhancement.

## Fix round 1/5 — independent discovery and semantic reconstruction

The first Task 3 review correctly identified circular formula discovery, visual-line paragraphs, flattened semantic blocks, report-trusting validation, overly broad NFKC prose checks, ignored raw-audit dependency, host-specific Python parsing, and insufficient negative coverage. All findings were addressed without narrowing the candidate universe.

### Genuine RED evidence

- `pnpm exec vitest run tests/content/course-content.test.ts` — RED, 4/8 failed: page-12 vector had 0 structured formulas; the cited Week 1 wrapped paragraph was split; representative overview/Week 2 lists were missing; the Week 2 concept chain/callout was flattened.
- `pnpm exec vitest run tests/content/content-validator.test.ts` — corrected RED, 7 failed/1 passed: clean fixture failed without `raw.json`; omitted formula candidate, altered outline evidence, fabricated exclusion, invalid disposition, NFKC compatibility mutation, and excluded Week 2 prose were all incorrectly accepted. The malformed Appendix mutation was already rejected by the existing hash/line gate.
- After the first validator GREEN, a final required semantic-regression test split the cited Week 2 joined paragraph back into two visual-line paragraphs while preserving its source text and report accounting. Genuine RED was 1 failed/8 passed because the validator accepted the split. The independent paragraph-to-ordered-source-line projection was then added; focused GREEN is 9/9.

### GREEN implementation evidence

- Independent detector starts from all 605 math-font rows and geometry-groups 381 candidates before consulting corrections. Physical page 12 is one candidate and one runtime formula.
- Semantic line joining uses outline boundaries, body font geometry, vertical spacing, indentation/alignment, punctuation/full-line wrapping, explicit arrow continuation, and page-edge continuity. It preserves source token equality. Representative Chinese, English, and mixed-language regressions pass.
- Consecutive source bullets become 62 lists; explicit arrow pipelines become 26 concept chains recursively; source regions wrapping chains become 15 callouts. Source span ordering and checksums remain auditable.
- The validator independently derives all 461 outline title/page/parent/depth mappings and one-to-one section IDs, candidate universes, allowed exclusions, Week 2/3 source streams, and exact candidate dispositions. Removing a candidate from both report collections still fails against the source-derived universe.
- Every paragraph must independently reproduce the token stream of its ordered assigned audit lines after the same evidence-based visual-wrap projection. An unassigned, split, or text-altered paragraph now fails with a semantic-paragraph error.
- `src/content/source-audit.generated.json.gz` makes clean-checkout validation self-contained. Its SHA-256 is `F26C0033C8CD4B7A6B47459281F1C6887037A84685312D2565DFC01FD4A23DFD`; two independent writes reproduced that byte hash.
- Appendix validation uses `@lezer/python` in Node plus exact 472-line, 18,411-character, and SHA-256 gates. A direct malformed-Python parser assertion and a malformed Appendix mutation both fail without invoking host Python.

### Fix-round verification performed

- `pnpm exec vitest run tests/content/course-content.test.ts` — PASS, 8/8.
- `pnpm exec vitest run tests/content/content-validator.test.ts` — PASS, 9/9, including omitted candidate, altered outline title/page/parent, unjustified exclusion, invalid disposition, compatibility character, excluded prose, semantic paragraph regression, and malformed Appendix mutations.
- Raw-absence proof: `tmp/pdf-extraction/raw.json` was renamed out of place; `pnpm validate:content` and `pnpm normalize:content` both passed; all three generated JSON hashes remained unchanged; the raw file was restored in `finally`.
- Deterministic audit proof: two regenerated gzip artifacts and the checked artifact all hashed to `F26C0033C8CD4B7A6B47459281F1C6887037A84685312D2565DFC01FD4A23DFD`.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm exec oxlint scripts/source-audit.mts scripts/normalize-course.mts scripts/validate-content.mts tests/content/course-content.test.ts tests/content/content-validator.test.ts` — PASS.
- `pnpm exec oxlint scripts src/content tests/content` — PASS.
- `pnpm test` — PASS, 5 files and 28 tests.
- `pnpm validate:content` — PASS with 170 pages, 461 source-equal outline mappings/sections, 4,354 recursive blocks, 381/39/380/12 independent candidates, 10,762 assigned spans, 31,646 justified exclusions, 472 Appendix lines, and zero warnings.
- `pnpm build` — PASS, all five vinext stages completed.

## Fix round 2/5 — structural formulas and immutable review evidence

The second scoped review found four remaining trust-boundary problems: the physical-page-12 vector was typed as a formula but flattened to text, paragraph grouping could be coordinated with report assignments, outline identity/hierarchy was not fully source-derived, and review outcomes were still being stamped during normalization rather than joined to an immutable decision record.

### Genuine RED evidence

- `pnpm exec vitest run tests/content/course-content.test.ts` — RED, 1 failed/7 passed. The physical-page-12 formula retained its five source lines in `accessibleText`, but its LaTeX was `\text{x= [ 100 3 8 ]}` rather than a three-row vector.
- `pnpm exec vitest run tests/content/content-validator.test.ts` — RED, 8 failed/9 passed. Validation accepted: a valid three-line paragraph split at a real source-line boundary with the affected span assignments coordinated to the two new blocks; coordinated runtime/report/manifest section-ID changes; altered heading page/line evidence; a changed runtime title; a source section moved under the wrong runtime parent; flattened page-12 vector LaTeX with unchanged accessible text; a removed/changed review-ledger decision; and a tampered visual-review index.

### Page-12 vector structure

The source detector independently resolves physical page 12, lines 21-25, as candidate `math-p012-g000`. The source geometry contains the opening expression/bracket plus three numeric rows at distinct vertical coordinates (`100`, `3`, `8`) and the closing bracket. A reviewed formula correction now emits:

`x = \begin{bmatrix} 100 \\ 3 \\ 8 \end{bmatrix}`

The exact source accessibility text remains `𝑥= [\n100\n3\n8\n]`. The immutable ledger binds candidate fingerprint `55beca09e052a1ef0e884717d1d46e8bf72e05614f515427ae51073bbae2c9fa` to structured target `formula-math-p012-g000` and correction fingerprint `72b397530fed81fc4109883d7329d2567bcb46c4175033e8305fa96b12efbbbf`. Validation independently rechecks the five audited lines, three distinct row coordinates, correction fingerprint, exact accessibility text, `bmatrix` delimiters, row separators, and value order.

### Independent paragraph and outline models

Paragraph validation now begins with checked source-audit pages and independently:

1. resolves heading lines and active source outline nodes;
2. removes only independently derived headings, running furniture, checked structured regions, and Appendix code geometry;
3. reconstructs atomic body lines and semantic joins from source spacing, indentation, full-line width, page-edge continuation, punctuation/list boundaries, and language-aware wrapping;
4. derives list and concept-chain boundaries; and
5. compares the resulting section-scoped paragraph token multiset directly with runtime blocks.

Report span assignments are not an input to this gate. The coordinated mutation that split `body-00048` between source spans `p011-s00061` and `p011-s00062`/`p011-s00063`, then reassigned the latter spans to the new block, is rejected by the independently derived single paragraph boundary.

For every one of the 461 outline nodes, validation now deterministically recomputes the stable section ID from source index/title, the runtime title from resolved audited heading lines, parent ID from `parentOutlineIndex`, navigation depth, source page, `headingPdfPage`, and `headingLineIndexes`. Runtime hierarchy, report mappings, and page-manifest section targets must all match that source model. Exclusion reasons for heading spans use these derived IDs and never a report-provided ID.

### Immutable candidate-review ledger

`src/content/candidate-review-ledger.json` is a checked, normalization-independent ledger with exactly 812 decisions. Each entry records:

- deterministic fingerprint over category, candidate ID, physical page, audited line indexes, span IDs, source checksum, and detector;
- explicit disposition and rationale;
- reviewer identity without a fabricated timestamp;
- structured target block when applicable; and
- a canonical correction fingerprint when a formula/table/code correction is required.

Normalization only reads and joins this ledger to the 812 independently detected candidates. It fails on missing/extra/fingerprint-mismatched decisions, category/page drift, invalid positive/negative disposition, missing structured target, or correction fingerprint mismatch. Thus removing a positive table/code/formula correction cannot silently recast its source candidate as a reviewed negative. The validator performs the same source-to-ledger join independently and compares emitted report evidence back to the ledger. The canonical parsed-ledger SHA-256 is `1bb5866569279cc14cae623119165eb514ab3e47089cc78a92143f2814f831e2`.

### Checked visual-review evidence

The rendered review is now auditable in `reports/content-review-evidence/`:

- 13 checked JPEG contact sheets, retaining the category-colored source-geometry overlays;
- 148 indexed physical-page cells, covering every page containing a detected candidate;
- every cell's row/column, candidate IDs, and aggregate candidate-fingerprint checksum;
- per-sheet SHA-256 checksums; and
- an index binding the source SHA, canonical ledger SHA, reviewer, 4x3 sheet layout, legend, page count, and all cells.

The checked sheets total 12,808,267 bytes. The validator reads every sheet, verifies its checksum, and proves exact page/candidate/fingerprint coverage against the immutable ledger. Post-compression spot inspection of sheets `002-013` (including the page-12 vertical vector) and `153-166` (including the Appendix transition and dense code pages) found the overlays and labels legible and unchanged.

### Fix-round GREEN evidence

- `pnpm exec vitest run tests/content/course-content.test.ts` — PASS, 8/8.
- `pnpm exec vitest run tests/content/content-validator.test.ts` — PASS, 17/17.
- Combined content-focused run — PASS, 25/25.
- `pnpm normalize:content` — PASS with the unchanged 170/461/candidate/span/Appendix gates.
- `pnpm validate:content` — PASS with 170 pages, 461 source-derived outline sections, 4,354 recursive blocks, 381/39/380/12 ledger-bound candidates, 10,762 assigned spans, 31,646 justified exclusions, 472 Appendix lines, and zero warnings.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm exec oxlint scripts src/content tests/content` — PASS.

### Completion-boundary verification

- Normalization determinism and immutability check — PASS. Hashes for the four normalized outputs, immutable ledger, visual index, and 13 contact sheets were captured; `pnpm normalize:content` changed none of the 19 artifacts.
- Source-audit regeneration — PASS. Two fresh gzip writes from `tmp/pdf-extraction/raw.json` and the checked audit all reproduced SHA-256 `F26C0033C8CD4B7A6B47459281F1C6887037A84685312D2565DFC01FD4A23DFD`.
- `pnpm test` — PASS, 5 files and 36 tests.
- `pnpm validate:content` — PASS with the exact source/content counts above.
- `pnpm exec tsc --noEmit` — PASS.
- `pnpm exec oxlint scripts src/content tests/content` — PASS.
- `pnpm build` — PASS, all five vinext stages completed.

### Fix-round self-review

- The validator's canonical paragraph groups begin with audited lines and source outline anchors; report assignments are only checked later as a separate accounting layer.
- Section identity, title, parent, heading coordinates, manifest target, and heading-exclusion reasons all originate from source outline/audit evidence.
- Candidate detection remains the same full 812-item universe. The immutable ledger cannot be emitted or changed by normalization, and every correction-backed positive decision is fingerprint-bound.
- The visual evidence index is line-ending independent: it hashes canonical parsed ledger JSON, while the binary sheet checksums remain exact.
- The page-12 formula preserves both dimensions of fidelity: exact extracted accessible text and explicit three-row vector semantics.
- No review timestamps were invented. Machine detector descriptions remain in detection evidence; human review identity and decisions live separately in the immutable ledger.
