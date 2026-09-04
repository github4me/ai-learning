# Curated Weeks 6-12 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Weeks 6-12 with beginner-first, example-driven website lessons while making every content-version update reset the complete browser learning state.

**Architecture:** Keep `course.generated.json` as the untouched website baseline and apply typed, immutable, checked-in revisions from `src/content/curated/` before the runtime course is frozen. Each revised week reuses its route and direct section IDs, collapses old nested subsections into aliases, and replaces their prose with framed lessons that require a problem, purpose, worked content, misconceptions, and an understanding check. One explicit content-version constant controls both the runtime course version and full local-state invalidation.

**Tech Stack:** TypeScript 5.9, Zod, React 19, Vinext, KaTeX, Zustand, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-04-curated-weeks-6-12-design.md`

## Global Constraints

- The current website content is the editorial baseline for Weeks 6-12; do not use the original PDF as an editorial or wording constraint.
- Do not modify `src/content/course.generated.json`, the PDF extraction, PDF correction ledgers, or normalization scripts.
- Rewrite Week 6 first and pass its task review plus non-test verification before beginning Week 7.
- Apply the same beginner-first teaching contract to every direct section in Weeks 7-12.
- Keep unit slugs and direct section IDs stable; removed descendant IDs become aliases on their nearest revised direct section.
- Use globally unique `curated-wNN-...` block IDs and preserve executable snippets as real code blocks.
- Every revised section contains a problem, purpose, concrete worked content, misconceptions, and an understanding check.
- Every mathematical vector and tensor example labels its token order and axes; no unexplained shape transition is allowed.
- `COURSE_CONTENT_VERSION` is bumped whenever curated content changes.
- A persisted state with a different content version resets progress, location, appendix state, bookmarks, notes, quiz attempts, and preferences. A stale import is rejected.
- Reset only `ai-first-principles:learning-state`; never clear unrelated browser storage.
- Per the user's explicit instruction, do not write or run unit, component, integration, or end-to-end tests.
- Verification uses curated-content validation, lint, TypeScript checking, production build, `git diff --check`, and browser inspection at desktop and 390-by-844 mobile widths.
- Weeks 1-5 and Appendix A remain unchanged.

---

### Task 1: Add the curated-content runtime and reset stale learner state

**Files:**
- Create: `src/content/content-version.ts`
- Create: `src/content/curated/types.ts`
- Create: `src/content/curated/builders.ts`
- Create: `src/content/curated/apply-curated-content.ts`
- Create: `src/content/curated/index.ts`
- Create: `scripts/validate-curated-content.mts`
- Modify: `src/content/course-runtime.ts`
- Modify: `src/learning/storage-adapter.ts`
- Modify: `app/layout.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: the schema-valid frozen base `Course` returned by `loadCourse(courseData)`.
- Produces: `applyCuratedContent(course: Readonly<Course>): Course`, `CURATED_WEEK_REVISIONS`, and `COURSE_CONTENT_VERSION`.
- Produces: a revision model that requires every authored section to provide `problem`, `purpose`, `blocks`, `pitfalls`, and `check`.

- [ ] **Step 1: Define the content version and authored revision types**

Create an explicit version constant and the following typed interface family. Body blocks support paragraph, list, formula, code, table, concept chain, and callout content; authors provide strings while the materializer creates `InlineNode[]` and `ContentBlock[]`.

```ts
export const COURSE_CONTENT_VERSION = '2026-09-04-curated-v1';

export type CuratedBodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'formula'; latex: string; accessibleText: string }
  | { type: 'code'; language: string; filename?: string; code: string }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'conceptChain'; steps: string[] }
  | {
      type: 'callout';
      tone: 'concept' | 'principle' | 'example';
      title: string;
      blocks: CuratedBodyBlock[];
    };

export type TeachingCheck = {
  prompt: string;
  answer: CuratedBodyBlock[];
};

export type TeachingSectionRevision = {
  sectionId: string;
  title?: string;
  problem: string;
  purpose: string[];
  blocks: CuratedBodyBlock[];
  pitfalls: string[];
  check: TeachingCheck;
  collapseChildren: true;
};

export type CuratedWeekRevision = {
  weekSlug: `week-${string}`;
  title: string;
  keyQuestion: string;
  objectives: string[];
  estimatedReadingMinutes: number;
  sections: TeachingSectionRevision[];
};
```

- [ ] **Step 2: Materialize teaching frames into runtime content blocks**

Implement deterministic block IDs from the week slug, section ID, semantic role, and local sequence number. Materialize each section in this order:

```text
先看问题 callout
为什么需要它 callout
authored worked blocks
常见误区 callout
knowledge check with answer
```

Nested callout and answer blocks receive unique IDs from the same factory. Every generated block inherits the existing target section's `source` solely to satisfy the runtime schema.

- [ ] **Step 3: Apply revisions immutably and preserve removed descendant anchors**

For each registered week, require its revision section IDs to match the existing direct child IDs exactly. Replace each direct section's title and blocks. When `collapseChildren` is true, collect every descendant ID and alias into the revised section's aliases and set `children: []`. Reject duplicate revision slugs, missing direct sections, extra section revisions, and duplicate curated block IDs before returning the cloned course with `version: COURSE_CONTENT_VERSION`.

- [ ] **Step 4: Integrate the overlay into the runtime course**

Change `course-runtime.ts` to validate/freeze the generated baseline, apply curated revisions, and validate/freeze the final course:

```ts
const generatedCourse = loadCourse(courseData);
const course = loadCourse(applyCuratedContent(generatedCourse));
```

Keep the public runtime selector signatures unchanged.

- [ ] **Step 5: Reset the whole learner state on content-version mismatch**

In `storage-adapter.ts`, after parsing a stored envelope, compare its `contentVersion` with `options.contentVersion`. On mismatch, create the initial state, replace the namespaced stored envelope, clear pending note state, and return the fresh state without creating corrupt-data recovery. In import preview, reject mismatched content with a clear `different course content version` error.

In `app/layout.tsx`, embed `COURSE_CONTENT_VERSION` into the pre-hydration bootstrap. Apply saved preferences only when the envelope version matches; otherwise remove only `ai-first-principles:learning-state` and use default preferences.

- [ ] **Step 6: Add curated-content validation**

Add `pnpm validate:curated`. It must load the final runtime course and verify that every registered revised week:

- has every direct baseline section represented once;
- has no remaining child sections;
- has the standard problem, purpose, misconception, and knowledge-check roles;
- contains no `symbol<digits>` extraction placeholders;
- contains no empty code, formula, table, or knowledge-check answer;
- uses unique block IDs and valid review-section targets.

Add `validate:curated` to the production `build` command after the existing generated-content validation.

- [ ] **Step 7: Run non-test verification**

Run:

```powershell
pnpm validate:curated
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Expected: all commands exit zero. Do not invoke any test script.

- [ ] **Step 8: Commit the runtime foundation**

```powershell
git add src/content/content-version.ts src/content/curated src/content/course-runtime.ts src/learning/storage-adapter.ts app/layout.tsx scripts/validate-curated-content.mts package.json
git commit -m "feat(content): add curated lesson runtime"
```

---

### Task 2: Rewrite and validate Week 6

**Files:**
- Create: `src/content/curated/week-06.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Consumes: `CuratedWeekRevision` and body-block builders from Task 1.
- Produces: `week06Revision`, covering all 20 direct Week 6 sections and using the exact fixed corpus, vocabulary, values, and shapes from the approved spec.

- [ ] **Step 1: Author the Week 6 overview and Sections 1-5**

Cover Token, Tokenizer, Vocabulary, Token ID, `nn.Embedding(V,C)`, one-hot equivalence, the `[V,C]` matrix, full shape semantics, and a visible Embedding update. Use `V=5`, `C=4`, the five-token vocabulary, the three approved sentences, and the exact training tensors from the spec.

- [ ] **Step 2: Author Sections 6-12**

Introduce conditional probability before notation. Include empirical transition counts, the exact labelled five-token logits/Softmax example, the exact `0.524` target loss, the `p-one_hot(target)` logit-gradient intuition, the six flattened classification rows, target dtype, and direct-logits `F.cross_entropy` usage.

- [ ] **Step 3: Author Sections 13-19**

Distinguish `[V,C]` token embeddings from `[V,V]` Bigram logits. Include a runnable Bigram class, training loop, correct `logits[:, -1, :]` generation path, argmax versus sampling, the `[我,喜欢]` versus `[猫,喜欢]` limitation, valid Perplexity conditions, the full final shape trace, and the conceptual bridge to Attention.

- [ ] **Step 4: Register the revision and run the Week 6 content audit**

Register only `week06Revision`. Run `pnpm validate:curated` and inspect its section-role and duplicate-ID report. Search the rendered course data for extraction placeholders and malformed formula text.

- [ ] **Step 5: Run the Week 6 non-test gate**

Run:

```powershell
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

Start or refresh the local preview on port `8787`. Inspect `/week/week-06` at desktop and 390-by-844 mobile widths. Verify navigation, formulas, tables, code indentation, knowledge checks, no horizontal overflow, and the final-position generation explanation.

- [ ] **Step 6: Commit Week 6 only after the gate passes**

```powershell
git add src/content/curated/week-06.ts src/content/curated/index.ts
git commit -m "content(week-06): teach language modeling through one example"
```

No Week 7 work begins until this task's independent review approves both specification compliance and content quality.

---

### Task 3: Rewrite Week 7 around one Attention trace

**Files:**
- Create: `src/content/curated/week-07.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week07Revision`, covering all 20 direct Week 7 sections.
- Uses: `[我,喜欢]` versus `[猫,喜欢]`, `B=2`, `T=2`, `C=4`, `n_head=2`, `head_size=2`.

- [ ] **Step 1: Explain the problem before Q, K, and V**

Start from Bigram's identical `喜欢` row. Define Query as what the current position seeks, Key as what each visible position advertises, and Value as the information carried forward. Explain why three learned projections are useful before showing their matrices.

- [ ] **Step 2: Walk through one complete single-head calculation**

Label every row and column through projections, dot-product scores, division by `sqrt(d_k)`, causal masking, row-wise Softmax, and weighted Value aggregation. Show all shapes from `[B,T,C]` through `[B,T,T]` and back to `[B,T,head_size]`.

- [ ] **Step 3: Expand implementation and limitations**

Map the PyTorch Attention-head code line-by-line to the formula, explain why mask precedes Softmax, build two heads into `C=4`, state the quadratic `T^2` cost with a numeric `T=2` versus `T=1000` example, and clearly state what Attention does not guarantee.

- [ ] **Step 4: Register, validate, review, and commit**

Run `pnpm validate:curated`, lint, TypeScript checking, production build, and `git diff --check`; inspect one score matrix, one mask, the code block, and the mobile layout.

```powershell
git add src/content/curated/week-07.ts src/content/curated/index.ts
git commit -m "content(week-07): explain attention through context lookup"
```

---

### Task 4: Rewrite Week 8 by assembling one Transformer block

**Files:**
- Create: `src/content/curated/week-08.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week08Revision`, covering all 20 direct Week 8 sections.
- Uses: the same two prompts and `B=2`, `T=2`, `C=4`, `n_head=2`, `head_size=2`.

- [ ] **Step 1: Introduce every missing component through its failure case**

Explain what fails without position embeddings, per-token feed-forward processing, nonlinear activation, residual paths, and normalization. Distinguish token mixing from channel mixing with the running tensors.

- [ ] **Step 2: Build a block incrementally with invariant shapes**

Trace token plus position embeddings, pre-norm Attention plus residual, then pre-norm FFN plus residual. Every addition must explicitly show equal `[B,T,C]=[2,2,4]` shapes. Explain the `C→4C→C` FFN with `4→16→4` numbers.

- [ ] **Step 3: Connect stacked blocks to vocabulary logits**

Show why stacking changes representations without changing `[B,T,C]`, then map the final `C=4` vector to `V=5` logits. Compare encoder-only, encoder-decoder, and decoder-only by what context each architecture is allowed to read.

- [ ] **Step 4: Register, validate, review, and commit**

Run the standard non-test gates and inspect the block flow, residual equations, code indentation, and mobile overflow.

```powershell
git add src/content/curated/week-08.ts src/content/curated/index.ts
git commit -m "content(week-08): assemble the transformer step by step"
```

---

### Task 5: Rewrite Week 9 from raw text to training batches

**Files:**
- Create: `src/content/curated/week-09.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week09Revision`, covering all 19 direct Week 9 sections.

- [ ] **Step 1: Compare tokenization units with one mixed-script string**

Use `我喜欢AI，AI也喜欢猫。` to compare character, word, byte, and subword boundaries. Explain consequences for sequence length, vocabulary size, unknown text, model parameters, and human expectations.

- [ ] **Step 2: Demonstrate BPE rather than merely defining it**

Show initial symbols, pair-frequency counts, the highest-frequency merge, the updated corpus, and a second merge. Separate tokenizer training, which learns the vocabulary and merges, from encoding, which applies frozen rules.

- [ ] **Step 3: Trace encoding into model-ready data**

Show Unicode code points versus UTF-8 bytes, special tokens, padding and Attention masks, train/validation splitting, one-dimensional token streams, shifted examples, and a batch with labelled axes. State that the tokenizer defines units and IDs but does not create contextual meaning.

- [ ] **Step 4: Register, validate, review, and commit**

Run the standard non-test gates and inspect BPE tables, mixed Chinese/Latin typography, code, and mobile wrapping.

```powershell
git add src/content/curated/week-09.ts src/content/curated/index.ts
git commit -m "content(week-09): trace text through tokenization"
```

---

### Task 6: Rewrite Week 10 around one tiny GPT configuration

**Files:**
- Create: `src/content/curated/week-10.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week10Revision`, covering all 18 direct Week 10 sections.
- Uses: `vocab_size=5`, `block_size=2`, `n_embd=4`, `n_head=2`, `n_layer=2`.

- [ ] **Step 1: Make configuration fields answer concrete constraints**

Explain each field through the shape, divisibility, context, or capacity decision it controls. Show why `n_embd % n_head == 0` and calculate `head_size=2`.

- [ ] **Step 2: Trace the complete top-level model before showing classes**

Walk `[B,T]→[B,T,C]→two Blocks→final LayerNorm→[B,T,V]`, distinguish training from inference in the shared `forward`, and provide an ownership map for every submodule and parameter group.

- [ ] **Step 3: Make parameter counting and correctness checks concrete**

Hand-calculate token embeddings, position embeddings, Attention, FFN, normalization, and LM-head parameters for the tiny configuration. Explain ModuleList, weight tying, state dictionaries, shape assertions, and causal checks through explicit failure examples.

- [ ] **Step 4: Register, validate, review, and commit**

Run the standard non-test gates and inspect the configuration table, ownership map, parameter calculations, full class code, and mobile layout.

```powershell
git add src/content/curated/week-10.ts src/content/curated/index.ts
git commit -m "content(week-10): assemble a tiny gpt architecture"
```

---

### Task 7: Rewrite Week 11 by separating training, validation, and generation

**Files:**
- Create: `src/content/curated/week-11.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week11Revision`, covering all 23 direct Week 11 sections.
- Uses: the Week 6 three-sentence batch and uniform-loss reference `ln(5)≈1.609`.

- [ ] **Step 1: Explain every training state change**

Expand batch signal counts, step versus epoch, AdamW state, zeroing gradients, forward, loss, backward, clipping, and optimizer updates. Explain the order by showing what goes wrong when a line is omitted or moved.

- [ ] **Step 2: Separate measurement and persistence concerns**

Explain train loss versus validation loss, `train()` versus `eval()`, `no_grad()`, learning-rate symptoms, one-batch overfit diagnosis, and checkpoint contents. Include the uniform initial-loss calculation and a small train/validation interpretation table.

- [ ] **Step 3: Build generation controls one transformation at a time**

Start from last-position logits, show temperature division with labelled probabilities, then Top-k filtering, Softmax, multinomial sampling, appending, and context truncation. Finish with a symptom-to-cause bug checklist.

- [ ] **Step 4: Register, validate, review, and commit**

Run the standard non-test gates and inspect the training loop, validation loop, probability tables, complete generation loop, and mobile rendering.

```powershell
git add src/content/curated/week-11.ts src/content/curated/index.ts
git commit -m "content(week-11): separate training from generation"
```

---

### Task 8: Rewrite Week 12 as one end-to-end Mini GPT trace

**Files:**
- Create: `src/content/curated/week-12.ts`
- Modify: `src/content/curated/index.ts`

**Interfaces:**
- Produces: `week12Revision`, covering all 25 direct Week 12 sections.

- [ ] **Step 1: Establish one trace and project map**

Introduce the project files by responsibility, then follow one fixed raw string through tokenizer, token stream, shifted batch, token and position embeddings, Q/K/V, Attention, Transformer blocks, LM head, and Cross Entropy. Keep the active tensor and its shape visible at every transition.

- [ ] **Step 2: Follow the same example backward and through an update**

Trace the scalar loss through logits, LM head, blocks, embeddings, and selected rows. Explain parameter gradients versus parameter values, show the optimizer update equation, and compare one labelled next-token distribution before and after a didactic update.

- [ ] **Step 3: Follow the trained model through generation and staged diagnosis**

Trace prompt IDs through the final-position distribution, sampling, append, and repeated computation. Organize pipeline, learning, and generalization experiments as three separate stages. Explain safe changes to corpus, tokenizer, context length, width, heads, and layers one at a time.

- [ ] **Step 4: Synthesize all twelve weeks**

Map each earlier week to one concrete responsibility in the final system, provide the final mental model, and end with understanding checks that require tracing data rather than recalling vocabulary.

- [ ] **Step 5: Register, validate, review, and commit**

Run the standard non-test gates and inspect the end-to-end shape trace, backward trace, code blocks, stage checklist, final summary, and mobile layout.

```powershell
git add src/content/curated/week-12.ts src/content/curated/index.ts
git commit -m "content(week-12): trace mini gpt end to end"
```

---

### Task 9: Perform whole-course integration and browser verification

**Files:**
- Modify only if verification exposes a defect: `src/content/curated/*.ts`, `src/content/course-runtime.ts`, `src/learning/storage-adapter.ts`, `app/layout.tsx`, `app/globals.css`, `scripts/validate-curated-content.mts`, `package.json`

**Interfaces:**
- Consumes: all seven registered curated revisions.
- Produces: a clean, production-buildable Weeks 6-12 learning experience and a running local preview.

- [ ] **Step 1: Run the full non-test quality gate**

```powershell
pnpm validate:content
pnpm validate:curated
pnpm lint
pnpm exec tsc --noEmit
pnpm build
git diff --check
```

All commands must exit zero. Do not invoke `pnpm test`, Vitest, Playwright, or any test file.

- [ ] **Step 2: Audit editorial and mathematical continuity**

Confirm each registered week covers every original direct section exactly once, every section has all five teaching-frame roles, all running-example values remain internally consistent, all formulas render, all code indentation survives, all `[B,T,C,V]` axes are labelled, and no PDF-link paragraph or extraction placeholder appears in the revised content.

- [ ] **Step 3: Verify the content-version reset**

Using the browser, create progress, a bookmark, a note, a quiz response, and non-default reading preferences under an intentionally stale content version. Reload the current site and confirm the namespaced envelope is replaced by a fresh current-version state while an unrelated local-storage key remains unchanged. Confirm a stale backup import is rejected with a clear message.

- [ ] **Step 4: Inspect representative desktop and mobile routes**

Inspect `/week/week-06` through `/week/week-12`, with at least one problem/purpose frame, formula, table, code block, misconception, and knowledge check per week. At 390-by-844 verify the course drawer, section anchors, long equations, tables, code scrolling, search results, study drawer, and content width do not overflow the viewport.

- [ ] **Step 5: Keep the verified preview running**

Start the production preview on `0.0.0.0:8787`, verify both `http://127.0.0.1:8787/` and the active LAN URL return HTTP 200, and leave the server running.

- [ ] **Step 6: Commit any verification-only fixes**

If Step 1-5 required changes, commit them together:

```powershell
git add src/content/curated src/content/course-runtime.ts src/learning/storage-adapter.ts app/layout.tsx app/globals.css scripts/validate-curated-content.mts package.json
git commit -m "fix(content): complete curated course verification"
```

If no files changed, record the successful commands and browser routes in the SDD report without creating an empty commit.
