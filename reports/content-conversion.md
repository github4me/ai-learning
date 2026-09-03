# PDF content conversion report

Generated from the pinned source on 2026-09-03. This report is backed by the machine-readable conversion report in `src/content/conversion-report.generated.json`.

## Source and coverage

- SHA-256: `3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52`
- Physical pages: 170/170
- Outline destinations: 461/461 (100%)
- Top-level roots: 14 (overview, 12 weeks, Appendix A)
- Positioned spans: 10762 assigned + 31646 reviewed exclusions = 42408
- Unresolved warnings: 0

## Reviewed special blocks

| Type | Discovered | Reviewed |
| --- | ---: | ---: |
| Formula | 20 | 20 |
| Table | 3 | 3 |
| Code block | 4 | 4 |
| Knowledge check | 4 | 4 |

Every typed candidate records its physical source page(s), exact positioned-span IDs, a SHA-256 checksum, reviewer, final status, and disposition in the JSON report. Formula review used the rendered pages and strict KaTeX validation; table review checked header/body order and cell text against source spans; code review checked literal source order and indentation. The Appendix was additionally checked at its first and last page and across every indentation depth.

## Prose preservation

- Week 2: 3623 normalized tokens; source/output checksum `497c0d163d0e007f9326cdd815bcce9038affed3786ee19248e50c9c274464e6`; match: true
- Week 3: 7008 normalized tokens; source/output checksum `03605634dd0e98560c19bb92d7dc5482e2cd733a5074862ecec3c352a3b98ac8`; match: true

The comparison projection applies Unicode NFKC, whitespace tokenization, removal of extraction NUL artifacts, and U+2010/U+2011/U+2013/U+2212 to ASCII-hyphen compatibility. Raw text and source span text remain unchanged in `tmp/pdf-extraction/raw.json`.

## Appendix A

- One Python block spanning physical pages 161-170
- 472 lines, 18,411 characters
- Code SHA-256: `0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd`
- Indentation recovered from the 62.362 pt base and 1.79125 pt per space grid
- Python AST is a mandatory validator gate

## Rendered-source QA checklist

- [x] Physical page(s) 10: overview and chapter table
- [x] Physical page(s) 21-35: Week 2 tables, formulas, and code
- [x] Physical page(s) 36-73: Week 3 prose and formulas
- [x] Physical page(s) 74: Week 4 entry and formulas
- [x] Physical page(s) 109: attention code and negative infinity
- [x] Physical page(s) 129-136: GPT code and tables
- [x] Physical page(s) 150-160: Week 12 integration and final check
- [x] Physical page(s) 161-170: Appendix code indentation and endpoints

## Explicit exclusions

Physical page 1 is front matter represented by metadata. Physical pages 2-9 are the printed table of contents replaced by web navigation. Repeated running headers, printed page-number footers, and outline headings represented by section nodes are retained in the raw extraction and listed as reviewed exclusions; none are silently discarded.
