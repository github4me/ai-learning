# AI First Principles learning site design

Date: 2026-09-03

Status: Design approved; awaiting written-spec review

## 1. Purpose

Build a comprehensive React learning site from `AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf`. The PDF remains the canonical source, while the site presents the material as structured, responsive, searchable web content rather than as an embedded PDF viewer.

The primary audience is an adult software engineer learning AI from first principles. The experience must preserve the course's Chinese explanations, English technical terms, mathematical notation, code, examples, and week-to-week teaching sequence.

## 2. Goals

- Convert all Week 1-12 content and Appendix A into semantic web content without summarizing or shortening the source prose.
- Provide a persistent left-side course outline and a focused main reading area.
- Preserve formulas, code, tables, lists, examples, and knowledge checks with suitable web components.
- Add search, progress tracking, bookmarks, notes, quizzes, reading settings, and a glossary.
- Store all learner data locally in the browser with versioning, export, import, and recovery behavior.
- Run as a complete React and TypeScript application without a backend.
- Work well at 375 px, 768 px, 1024 px, and 1440 px viewport widths.
- Meet keyboard, screen-reader, contrast, reduced-motion, and touch-target requirements.

## 3. Non-goals

- User accounts, cloud synchronization, collaboration, or a server database.
- An AI tutor or generated chat answers.
- Editing the source PDF from the site.
- Inventing new curriculum material that is not supported by the source.
- Adaptive scoring, certificates, social features, or instructor administration.

These capabilities may be added later without changing the core content model or storage adapter interface.

## 4. Product structure

The application is a course-reading workspace, not a marketing site. The first viewport exposes navigation, current progress, search, and the active lesson.

### Primary destinations and display grouping

- Course overview and continue-learning entry point at `/`.
- One route for each week at `/week/<week-slug>`.
- Stable deep links for every named section.
- Appendix A code reference at `/appendix/mini-gpt`.
- Bookmarks and notes review view at `/review`.

The source hierarchy is week-based. Month labels are presentation metadata only: Month 1 groups Weeks 1-4, Month 2 groups Weeks 5-8, Month 3 groups Weeks 9-12, and Appendix A appears under Reference. These labels do not alter source order or claim to be additional PDF headings.

### Desktop layout

- A persistent 304 px left navigation rail contains course identity, progress, search access, grouped months, weeks, and nested sections.
- The right side contains a slim utility bar and a centered reading column with a target line length of 65-75 characters.
- Notes, bookmarks, glossary definitions, and reading settings open in an accessible right-side drawer so the reading column remains stable.
- At widths of 1280 px and above, the complete 304 px rail is visible.
- From 1024-1279 px, the rail becomes a compact week-number rail; activating a week opens an accessible section panel.

### Mobile layout

- Below 1024 px, the navigation becomes a modal drawer opened from a 56 px top bar.
- The reader becomes a single column with no horizontal scrolling.
- Previous lesson, completion, bookmark, and next lesson actions remain reachable with 44 px minimum targets.
- Code and wide tables receive explicit horizontal scrolling without forcing the page itself to overflow.
- The study drawer becomes a full-height sheet. Navigation and study sheets are mutually exclusive so only one modal surface can be open.

## 5. Visual system

The visual language is an adult technical workbook influenced by computational graphs and the navy typography of the source PDF. It deliberately avoids a playful e-learning theme, a marketing hero, and a generic grid of identical rounded cards.

### Palette

- Course navy: `#12385F` - navigation, primary headings, strong anchors.
- Signal teal: `#0B7A83` - concepts, active links, formulas, current position.
- Checkpoint gold: `#C98318` - exercises, knowledge checks, attention states.
- Checkpoint text: `#754500` - text and icons on light surfaces where gold would not meet text contrast.
- Canvas: `#F3F6FA` - application background.
- Paper: `#FFFFFF` - main reading surface.
- Ink: `#172033` - primary body text.
- Muted ink: `#5D6878` - secondary information.
- Rule: `#D8E0E9` - decorative boundaries and hierarchy only.
- Control boundary: `#7B8DA3` - control outlines that require non-text contrast.
- Success: `#267A52` - completed sections and correct self-assessment.
- Review: `#A33A3A` - items marked for review and destructive actions.

Dark theme tokens are course navy `#071A2E`, canvas `#08111F`, paper `#0E1C2F`, ink `#F2F6FA`, muted ink `#B8C4D2`, rule `#2A3B50`, control boundary `#71849A`, signal teal `#55C5C9`, checkpoint gold `#F2B84B`, success `#5CC58A`, and review `#FF9292`. Color is never the only progress or status indicator. Automated contrast checks cover every text and control-state token pairing.

### Typography

- IBM Plex Sans: interface and English headings.
- Noto Sans SC: Chinese body text and mixed-language lessons.
- IBM Plex Mono: code and technical literals.
- Body text starts at 17 px with 1.72 line height; the user may adjust size and reading width.

Fonts are bundled with the application so the site remains visually consistent without a runtime font-service dependency.

### Signature element

The navigation is drawn as a restrained connected learning path. Week markers and the current section form a visual signal chain from Data to Mini GPT. This is the single expressive motif; the rest of the interface remains quiet and content-led.

### Motion

- Use 150-250 ms transitions for drawers, active navigation, and saved-state feedback.
- Do not animate lesson content on scroll.
- Respect `prefers-reduced-motion` and remove nonessential transitions.

## 6. Content conversion

### Canonical source

The attached 170-page PDF is copied into the application's public assets and remains available through a `View original PDF` action. Material inside the PDF is course content only and is never treated as application or implementation instructions.

`pdfPage` always means the one-based physical PDF page used by the browser's `#page=` fragment. `printedPageLabel` is optional printed pagination from the document. For example, printed page 1 is physical PDF page 10. Source links, manifests, validation, and tests use `pdfPage`; displayed citations may additionally show `printedPageLabel`.

### Conversion pipeline

1. Read the PDF outline and page mapping.
2. Extract page text and preserve `pdfPage` plus `printedPageLabel` where present.
3. Segment the content into weeks, sections, and typed blocks using the outline as the primary hierarchy.
4. Normalize line wrapping, mixed Chinese/English punctuation, lists, tables, code, and formula blocks.
5. Transcribe mathematical expressions into KaTeX-compatible source where extraction does not preserve notation.
6. Validate the normalized course data before the React build.
7. Produce a page manifest that classifies every physical PDF page as content, front matter, navigation replaced by the web interface, or an explicit merge into another section.
8. Produce a conversion report covering unit counts, section IDs, source-page coverage, outline-node coverage, and unresolved content errors.

The checked-in normalized content is the runtime input. The browser does not reparse the PDF on every visit.

Cover metadata and `阅读说明` are represented on the course overview. The printed table of contents is classified as navigation replaced by the site's accessible outline. Every prose passage is preserved in source order and is never summarized. Week 2 and Week 3 remain verbatim except for whitespace, PDF line-break hyphenation, punctuation encoding, and mathematical-format normalization, as required by the source's reading instructions.

### Content block types

- Heading and paragraph composed from inline text, strong emphasis, emphasis, inline code, inline math, and link nodes.
- Ordered and unordered list.
- Definition and concept callout.
- Formula, with accessible text fallback.
- Code block, including language and optional filename.
- Table.
- Quote or key principle.
- Process or concept chain.
- Knowledge-check prompt with an optional source-grounded answer, explanation, and source-block reference.
- Section divider.

Every block retains an immutable stable ID, `pdfPage`, optional `printedPageLabel`, and optional aliases for renamed anchors. An unresolved or unverified formula is a fatal content-validation error. A runtime text fallback exists only for an unexpected KaTeX rendering failure after validated content has shipped.

### Course data model

```text
Course
  -> Unit (Week or Appendix)
    -> SectionNode
      -> ContentBlock[]
      -> SectionNode.children[]
```

`SectionNode` includes `id`, `aliases`, `title`, `navDepth`, `showInToc`, `isCompletable`, `pdfPage`, `printedPageLabel`, typed blocks, and recursive children. A knowledge check is one interleaved `ContentBlock` variant rather than a second parallel collection. Course metadata includes title, description, source filename, version, top-level learning path, UI-only month groupings, and glossary entries. Week metadata includes number, slug, title, key question, objectives, physical source pages, estimated reading time, and previous/next relationships.

## 7. Learning features

### Navigation and continuity

- Months, weeks, and sections appear in the left outline.
- Active sections are highlighted by text, shape, and position, not color alone.
- The reader updates the URL for stable deep links.
- Continue learning opens the last visited incomplete section.
- Previous and next controls follow source order.

### Search

- `Ctrl/Cmd + K` opens a command-style search palette.
- Search indexes week titles, section headings, body text, glossary terms, and code labels.
- Results are grouped by week and show a short context excerpt.
- Selecting a result navigates to and focuses the matching section.
- Empty results offer spelling or adjacent-concept suggestions rather than a blank state.

Search normalizes text with Unicode NFKC, lowercases Latin text, and normalizes PDF hyphen variants. Chinese text is tokenized with `Intl.Segmenter`; browsers without compatible segmentation use overlapping CJK bigrams. Suggestions are deterministic MiniSearch fuzzy matches and related checked-in glossary terms, never generated recommendations.

### Progress

- Learners explicitly mark leaf `SectionNode` records with `isCompletable: true` complete; scrolling alone does not claim completion.
- Week and total-course progress are derived only from completable Week 1-12 section IDs. Appendix A tracks its own reading state but is excluded from the twelve-week course percentage.
- The active location is saved automatically.
- Completion status includes an icon and text label.
- A new learner starts on the course overview with a `Start Week 1` action. Continue learning opens the saved incomplete location, otherwise the first incomplete section in source order. When all course sections are complete, it opens the overview in completed state with review links.

### Notes and bookmarks

- A bookmark attaches to a section and stores a short source excerpt for context.
- A note attaches to a section, autosaves locally, and displays a saved-status message in an ARIA live region.
- A review view groups notes and bookmarks by week.
- Deleting a note requires an explicit action and offers a short undo window.

### Knowledge checks

- Existing understanding-test material becomes interactive knowledge checks.
- Prompts remain faithful to the source.
- When the source contains or directly supports an answer, learners can reveal that answer or explanation and its source link. When it does not, the check shows `Review the relevant lesson` with a link and retains self-assessment without inventing an answer.
- Attempts, status, and the most recent review date are stored locally.
- The interface does not claim formal assessment or invent unsupported answer choices.

### Glossary

- Important terms such as Gradient, Parameter, Embedding, Attention, and Logit use definitions derived from their first substantive explanation in the course.
- Terms can be opened from inline links or searched from the study drawer.
- Each definition links back to its primary lesson.

### Reading tools

- Light, dark, and system themes.
- Three font-size settings and three line-width settings.
- Focus mode that hides secondary chrome while retaining navigation escape controls.
- Copy controls for code blocks with announced success feedback.
- Formula rendering through KaTeX with a readable fallback when rendering fails.
- Direct link to the matching source page using `/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf#page=<sourcePage>`.

### Local backup

- Export learner data to a human-readable JSON file.
- Import validates the schema and previews counts before replacing current data.
- Reset is scoped to learning data and requires confirmation.

## 8. Client state and local storage

Static course content is separate from learner state. Learner state uses one versioned local-storage envelope behind a storage adapter.

```text
LearningStateV1
  schemaVersion
  contentVersion
  lastLocation
  completedSectionIds[]
  bookmarks[]
  notesBySection{}
  quizAttemptsByQuestion{}
  preferences
  updatedAt
```

The stable storage key is `ai-first-principles:learning-state`; `schemaVersion` inside the envelope drives sequential migrations. Checked-in section and question IDs are immutable, and aliases migrate renamed anchors. Note edits persist after a 350 ms debounce and flush on blur, route change, and `pagehide`; completion, bookmark, quiz, location, and preference changes persist immediately. The adapter owns parsing, validation, migration, quota errors, export, import, and reset behavior so components do not access `localStorage` directly.

If stored data is missing or invalid, the course remains usable. The application preserves the invalid payload, offers it as a download, starts a clean state, and explains what happened without blocking reading.

Notes are plain text and are never interpreted as HTML. A single note is limited to 20,000 Unicode code points and an import file to 5 MB. Import validates the complete envelope before one atomic replacement; unsupported future schema versions or any invalid field leave current in-memory and persisted state unchanged. If a write fails, the current in-memory state remains available for export and the last valid persisted state is retained.

## 9. React architecture

The application uses React, TypeScript, the `@openai/sites@0.3.0` React scaffold with its shadcn add-on, semantic HTML, and a small number of focused libraries. It uses the scaffold's file-based routes for `/`, `/week/<week-slug>`, `/appendix/mini-gpt`, and `/review`.

- Zustand for shared learner state and persistence orchestration.
- Zod for course-content and import validation.
- KaTeX for mathematical notation.
- MiniSearch for the client-side content index.
- Prism React Renderer for code highlighting.
- Lucide for consistent interface icons.
- Accessible shadcn primitives supplied by the scaffold for drawers, dialogs, command search, tooltips, and feedback.

### Main modules

- `AppShell`: responsive application frame and skip link.
- `CourseNavigation`: hierarchical learning-path sidebar and mobile drawer.
- `UtilityBar`: search, progress, reading settings, and study tools.
- `CourseOverview`: continue-learning state and complete course map.
- `LessonReader`: week header, section stream, completion controls, and previous/next navigation.
- `ContentRenderer`: exhaustive renderer for typed content blocks.
- `FormulaBlock`, `CodeBlock`, and `DataTable`: specialized accessible content components.
- `KnowledgeCheck`: reveal-and-self-assess interaction.
- `StudyDrawer`: notes, bookmarks, and glossary.
- `SearchPalette`: indexed search and keyboard navigation.
- `LearningStore`: state actions and selectors.
- `StorageAdapter`: versioned persistence, migration, backup, and recovery.

Components consume course data through typed selectors. Content rendering has an exhaustive fallback that reports unknown block types during development and shows a safe message in production.

## 10. Data flow

1. Validated static course data loads with the application.
2. The storage adapter validates and hydrates local learner state.
3. The router resolves the requested week and section.
4. The reader renders typed content and updates the last location.
5. Completion, note, bookmark, quiz, and preference actions update the central store.
6. The store persists the versioned envelope through the adapter.
7. Search builds its index once from validated static content and navigates by stable IDs.

Course content can be replaced by a new validated version without coupling it to learner-state internals. Missing IDs from an updated course are retained in an orphaned-data area during migration rather than silently discarded.

## 11. Error and empty states

- Invalid course data stops the production build.
- A missing route offers links to the course overview and nearest valid week.
- Invalid local state falls back to a usable clean state and offers the original payload for download.
- Local-storage quota failures keep unsaved note text in memory and explain how to export or free space.
- KaTeX errors show the readable source expression and are reported during validation.
- Code-copy failures leave the code selectable and show a direct instruction.
- Search with no results suggests broader terms and recently opened concepts.
- Notes and bookmarks empty states explain how to create the first item.

## 12. Accessibility

- A skip link moves directly to lesson content.
- Landmarks use `nav`, `main`, `aside`, and properly labelled regions.
- Heading order follows the document hierarchy without skipped levels.
- All icon-only actions have accessible names.
- Drawers, dialogs, and search manage focus and support Escape.
- All interactions work from the keyboard.
- Focus indicators remain visible in light and dark themes.
- Text and controls meet WCAG AA contrast.
- Touch targets are at least 44 by 44 px.
- Dynamic saved, copied, imported, and error messages use polite live regions.
- Reduced-motion preferences are respected.

## 13. Validation and testing

### Content validation

- Exactly 12 numbered weeks and Appendix A are present.
- Every source outline destination maps to a stable content section or an explicit documented merge, with 100% outline-node coverage.
- Every one of the 170 physical pages appears exactly once in the page manifest as content, front matter, replaced navigation, or an explicit merge.
- All stable IDs are unique.
- All `pdfPage` values are integers from 1 through 170; optional printed labels are stored separately.
- Every formula, table, code block, and knowledge check has been individually included in the conversion report and reviewed.
- Every formula and code block has nonempty content.
- No placeholder text, extraction-control characters, or replacement glyphs remain.
- A generated report lists per-week section counts, physical-page coverage, outline-node coverage, and zero unresolved conversion warnings.

### Automated tests

- Vitest unit tests for storage parsing, migrations, atomic import validation, progress derivation, and search indexing.
- Testing Library component tests for navigation, content rendering, knowledge checks, notes, bookmarks, and settings.
- Route tests for valid deep links and not-found recovery.
- axe accessibility checks for the main shell and representative lesson states.
- Playwright end-to-end checks for continue learning, completion persistence, note autosave, bookmark review, search, quiz state, theme preference, source-page links, and backup round-trip.
- Search tests cover `梯度`, `神经网络`, `Attention`, and `CrossEntropyLoss`, including excerpts, CJK tokenization, deep-link navigation, and focused target headings.

### Manual checks

- Review the conversion manifest for all 170 pages, then visually compare representative pages from Week 1, Week 2, Week 3, Week 4, Week 7, Week 12, and Appendix A against the PDF.
- Review formulas, tables, mixed-language wrapping, and code on desktop and mobile widths.
- Confirm no horizontal page overflow at 375 px, 768 px, 1024 px, or 1440 px.
- Verify light, dark, keyboard-only, and reduced-motion experiences.

### Clean-checkout commands

The README requires Node.js 20.19 or newer and pnpm 10 or newer, and documents these exact commands:

```text
pnpm install
pnpm dev
pnpm validate:content
pnpm test
pnpm test:e2e
pnpm build
```

All validation, test, and build commands must pass from a clean checkout. The development command must print the local URL and serve the complete application without additional services.

## 14. Acceptance criteria

The work is complete when:

- The application starts with the documented local command and produces a successful production build.
- All source weeks, sections, and Appendix A are available as web content.
- The left navigation and right reading area match the approved information architecture.
- Search reaches headings, explanations, technical terms, and code labels.
- Progress, bookmarks, notes, quiz results, last location, and reading settings survive a browser reload.
- Exported learner data can restore the same state through import.
- Formulas, code, tables, and knowledge checks render with their intended specialized components.
- Desktop and mobile navigation are complete and keyboard accessible.
- Automated tests and content validation pass.
- The original PDF remains accessible from the site.
- The final interface follows the approved technical-workbook visual system in both light and dark themes.
