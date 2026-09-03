# AI First Principles / AI 第一性原理

A local, PDF-derived 12-week AI learning site, from Linear Regression to a
Mini GPT. It is a React/TypeScript application with no account, backend,
database, cloud sync, or deployment configured.

## Run locally

Prerequisites:

- Node.js `>=22.13.0`
- pnpm `>=10` (the repository pins `pnpm@11.19.0`)

From the normal repository root, not an internal worktree:

```powershell
Set-Location 'C:\Git\AI Learning'
pnpm install
pnpm dev
```

`pnpm dev` prints the local URL to open. Do not assume a particular port.

For a production-style local preview, build first and then start the Workers
preview; it also prints the usable local URL:

```powershell
Set-Location 'C:\Git\AI Learning'
pnpm build
pnpm start
```

## Available validation commands

These commands are available but optional for normal local use:

```powershell
pnpm validate:content  # PDF/source-integrity validation, not a test suite
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

The repository also contains `pnpm test` and `pnpm test:e2e`. They were
explicitly waived by user direction for this handoff and were not run. Do not
represent this delivery as having unit, component, or end-to-end test results.

## Course and source fidelity

The canonical course source is
`public/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf`:

- SHA-256:
  `3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52`
- 170/170 physical PDF pages classified
- 461/461 outline destinations mapped (100%), across 14 roots: overview,
  Weeks 1–12, and Appendix A
- 381 formulas, 39 tables, 380 code-block candidates, and 12 knowledge-check
  candidates reviewed; no unresolved conversion warnings
- Appendix A: 472 lines; SHA-256
  `0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd`

The PDF remains the canonical conversion source; the learner-facing course is
rendered entirely as structured HTML text, formulas, tables, and code. Physical
and printed page labels remain internal provenance metadata for content audits
and are not shown as PDF links in the reading interface.

At runtime, the app reads the checked-in normalized JSON and does not parse the
PDF in the browser. `pnpm normalize:content` is a Node/tsx maintainer operation
that consumes the checked-in source-audit, review-ledger, and review-evidence
artifacts to regenerate the normalized course and conversion report; follow it
with `pnpm validate:content`.

Python with PyMuPDF and pypdf is required only when deliberately recreating the
raw/source-audit evidence from the canonical PDF with `scripts/extract_pdf.py`.
That source-extraction step precedes review of the resulting evidence and the
Node normalization/validation sequence. Normal install, development, build, and
local preview need only the Node/pnpm prerequisites above.

## Features and routes

- `/` — course overview and continue-learning entry point
- `/week/<week-slug>` — all 12 week lessons, with stable section fragments
- `/appendix/mini-gpt` — Appendix A Mini GPT reference
- `/review` — notes and bookmarks grouped for review

The reader provides searchable Chinese/English headings, explanations,
formulae, glossary terms, and code labels; semantic formulas, tables, and code;
source-grounded knowledge checks; progress and last-location continuity;
bookmarks; plain-text notes; review; light/dark/system theme; font size, line
width, and focus-mode controls. Press `Ctrl+K` (Windows/Linux) or `Cmd+K`
(macOS) to open search.

The navigation is responsive: a full 304 px rail at `>=1280px`, a compact
week rail from `1024px` through `1279px`, and an accessible mobile drawer below
`1024px`. The intended viewport coverage is 375, 768, 1024, and 1440 px;
wide tables, code, and formulae scroll within their own regions rather than
forcing page-wide horizontal scrolling.

## Local learning data, privacy, and recovery

Exact in-product privacy copy:

> Your progress, notes, bookmarks, knowledge-check self-assessments, and reading preferences stay only in this browser on this device. This site has no account, cloud sync, or server database. Export a backup to keep or move this data.

Learner state is browser-, device-, and profile-specific and is stored in
`localStorage` under `ai-first-principles:learning-state`. Clearing site data,
using private browsing, changing browsers, storage eviction, or a failed browser
write can remove persisted data. Back up before moving browsers/devices or
clearing site data: **Reading settings → Export backup** downloads a
human-readable JSON file; import validates and previews it before it replaces
the current data.

Limits and safeguards:

- Imports are limited to 5 MiB and reject invalid or unsupported future schemas
  without replacing current data.
- A plain-text note is limited to 20,000 Unicode code points. Notes debounce for
  350 ms and flush on blur, navigation/lifecycle changes, page hide, and when the
  document becomes hidden; abrupt termination can still pre-empt a pending write.
- The versioned envelope migrates supported renamed section IDs. Reset requires
  typing `RESET` and removes only this course's learning data—not the PDF or
  source content.
- If stored data is unreadable, the course opens with fresh state and preserves
  the raw payload for download. If storage is full or unavailable, in-memory
  changes remain exportable and the last valid persisted state is retained;
  failed imports leave current data unchanged and offer a recovery download.

## Known local advisory

The checked-in course payload is about 2 MB raw and has 459 table-of-contents
sections. The current client intentionally caches the complete course payload
for source integrity and simple local operation. On constrained devices this can
make initial load and learner-state updates heavier than an on-demand,
per-unit-content architecture. Treat this as a known performance advisory for a
future optimization pass, not a content-fidelity issue.

## Deployment

This handoff is local only. No deployment origin, public URL, Open Graph/X image
metadata, social preview image, or hosting publication is configured or
authorized. Do not publish or deploy without explicit approval.
