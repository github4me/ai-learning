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

The raw extraction is regeneration-only and remains under ignored `tmp/`; runtime and builds consume only the checked-in JSON.

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

The final course contains 461 sections and 5,109 blocks:

| Runtime block type |     Count |
| ------------------ | --------: |
| Paragraph          |     5,078 |
| Formula            |        20 |
| Table              |         3 |
| Code               |         4 |
| Knowledge check    |         4 |
| **Total**          | **5,109** |

The 20 deliberately structured display-formula candidates are not a raw math-font count; other inline/source math remains preserved in prose. Every structured candidate is tied to positioned source spans and strict validation.

### Appendix A recovery

Appendix A is reconstructed from positioned lines on physical pages 161-170 using a measured 62.362 pt left base and 1.79125 pt per-space grid. The result is one Python block with:

- 472 visual lines
- 18,411 characters
- SHA-256 `0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd`
- a successful Python `ast.parse` gate using the bundled Python executable

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
7. Current targeted results: course schema 9/9, generated content 4/4, validator 1/1.

## Prose and fidelity validation

`scripts/validate-content.mts` independently rereads raw extraction plus generated artifacts and recomputes every gate. It does not trust the report's summary counters. It validates:

- pinned source and public-copy checksums;
- 170 physical pages and printed-label mapping;
- 461 unique outline destinations, 14 roots, and 461 resolvable section mappings;
- exactly 12 sequential weeks plus Appendix A, with a separate page-10 overview;
- global uniqueness of runtime section/block IDs and source-span dispositions;
- exact Week 2 and Week 3 normalized token sequences and independently recomputed checksums;
- correction-map source span checksums and reviewed status;
- strict KaTeX rendering of all 20 formulas;
- table cell order/text against source line spans;
- literal code source order and Appendix hash/line count/AST;
- absence of replacement glyphs and forbidden control characters;
- zero unresolved warnings.

Week 2 has 3,623 normalized tokens and Week 3 has 7,008. In both cases, source and output token sequences are identical after only Unicode NFKC, whitespace tokenization, extraction-NUL removal, Han-character token separation, and U+2010/U+2011/U+2013/U+2212 compatibility normalization.

## Reviewed rendered-source evidence

Source pages were rendered with bundled Poppler at 100 dpi. Individual pages and 2x2 contact sheets were compared against the exact correction values and report span references.

- p10: overview and complete 12-row chapter table.
- p20, p69, p84, p159: all four knowledge-check prompts and review targets.
- p21-35: every Week 2 page, including the x/y table, `predict` code, learning-chain text, and display formulas.
- p36-73: every Week 3 page, including prose flow and formula pages.
- p74: Week 4 entry and formula values.
- p107 and p109: attention equation, negative-infinity notation, and `AttentionHead` indentation/order.
- p129-136: GPT configuration code and surrounding structured content.
- p150-160: Week 12 integration and final check.
- p161-170: every Appendix page, including first/last endpoints and all visible indentation depths.

The review found no discrepancy between the checked correction values and rendered source pages. All 20 formulas, 3 tables, 4 code blocks, and 4 knowledge checks are marked reviewed because their value/order/page and source-span evidence were actually compared. The machine-readable candidate records retain reviewer, status, physical page, span IDs, and source checksum.

## Commands and observed results

Node/pnpm commands prepended the bundled Node and pnpm fallback directories to `PATH`.

| Command                                                    | Result                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm normalize:content`                                   | PASS — 170/170 pages, 461/461 outline, 10,762 assigned + 31,646 excluded spans, 472 Appendix lines, 0 warnings                                                                                                       |
| hash generated artifacts → normalize again → hash again    | PASS — all four emitted files byte-identical                                                                                                                                                                         |
| `pnpm validate:content`                                    | PASS — 170 pages, 461 outline/sections, 5,109 blocks, 20 formulas, 3 tables, 4 code blocks, 4 knowledge checks, 472 Appendix lines, 0 warnings                                                                       |
| `pnpm test -- tests/content/course-content.test.ts`        | PASS — 5 files, 16 tests (the package runner treats the arguments after `--` as Vitest filters/options and executes the full current suite)                                                                          |
| `pnpm test`                                                | PASS — 5 files, 16 tests                                                                                                                                                                                             |
| `pnpm exec vitest run tests/content/course-schema.test.ts` | PASS — 1 file, 9 tests                                                                                                                                                                                               |
| `pnpm exec tsc --noEmit`                                   | PASS                                                                                                                                                                                                                 |
| `pnpm exec oxlint scripts src/content tests/content`       | PASS                                                                                                                                                                                                                 |
| `pnpm build`                                               | PASS — all five vinext build stages complete                                                                                                                                                                         |
| `pnpm lint`                                                | FAIL outside Task 3 — pre-existing UI/component rules in `src/components/course/course-overview.tsx`, `components/ui/*`, and `hooks/use-mobile.ts`; Task 3-owned paths are clean under the scoped lint command above |

## Files changed

- `scripts/extract_pdf.py`
- `scripts/content-corrections.mts`
- `scripts/normalize-course.mts`
- `scripts/validate-content.mts`
- `src/content/course.generated.json`
- `src/content/page-manifest.generated.json`
- `src/content/conversion-report.generated.json`
- `src/content/schema.ts`
- `src/content/load-course.ts`
- `tests/content/course-content.test.ts`
- `tests/content/content-validator.test.ts`
- `tests/content/course-schema.test.ts`
- `reports/content-conversion.md`
- `public/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf`
- `package.json`
- `tsconfig.json`

## Self-review

- The runtime/build path has no Python or PDF parsing dependency; all content is checked-in JSON.
- Source identity is checked at extraction and validation, including the public copy.
- The direct outline map, stable IDs, manifest page mapping, and span accounting are recomputed rather than accepted from summary counts.
- Structured corrections fail closed when source geometry/text changes.
- Generated output is deterministic and contains no timestamps that vary per run.
- The approved overview and page-manifest interface changes remain minimal and preserve the 13-unit invariant.
- No manual-review claim was made before the relevant rendered page/span comparison was completed.

## Concerns and follow-up

1. The bundled Python interpreter includes pypdf but not PyMuPDF on this host. Raw regeneration therefore currently needs the recorded Python 3.12 `PYTHONPATH`; runtime/build/test do not. A future reproducible-tooling task should place the pinned PyMuPDF version in the workspace bundle or project-managed regeneration environment.
2. The repository-wide lint command is not green because of existing UI/component violations outside Task 3. Task 3-owned scripts, content runtime, and tests pass scoped oxlint.
3. Formula typing is deliberately conservative: 20 display candidates are explicit structured formula blocks, while other mathematical source text remains losslessly preserved as paragraph text. Expanding semantic formula coverage should add reviewed correction entries rather than infer LaTeX silently.
