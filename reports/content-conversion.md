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
| Formula | 381 | 381 |
| Table | 39 | 39 |
| Code block | 380 | 380 |
| Knowledge check | 12 | 12 |

Every independently detected candidate records its physical source page, exact positioned-span IDs, a SHA-256 checksum, reviewer, final status, and disposition in the JSON report. Formula review used all detected LatinModernMath components and strict KaTeX validation; table review checked repeated-column signals; code review checked compact code-like regions; question/check review began from outline title patterns. The Appendix was additionally checked at its first and last page and across every indentation depth.

## Prose preservation

- Week 2: 3956 normalized tokens; source/output checksum `2aa668a91a5538319d52ba39a747d9a530dd433e84d9de9b54e3397c894768ea`; match: true
- Week 3: 7775 normalized tokens; source/output checksum `21fdd80f8a074ba7594d7531a0af5378e0173dac0749e2362226c70b25385097`; match: true

The comparison projection applies Unicode NFC, whitespace tokenization, proven visual-line dehyphenation, removal of extraction NUL artifacts, and only U+2010/U+2011/U+2013/U+2212 to ASCII-hyphen compatibility. The source-side stream is independently rebuilt from every body line on physical pages 21-73; it does not use generated span assignments. Raw text and source span text remain unchanged in the checked-in compressed source audit.

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
