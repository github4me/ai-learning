# English edition implementation

Branch: `codex/english-course`, based on `f0c914a` (current reviewed website).

## Scope and decisions

- Complete English edition of all 12 weeks, exercises/answers, glossary, overview,
  appendix, interface and example instructions. Chinese remains available.
- Translate the assembled course, not the historical PDF or intermediate sources.
- Existing Chinese routes stay unchanged; English uses `/en`. Shared opaque IDs
  preserve corresponding sections and learning state. Switching must flush notes.
- Exact source-string translation keys expose stale/missing translations. Keep
  formulas, code logic and numeric fixtures consistent; review adapted vocabularies
  as one cross-chapter change, not independent word replacements.
- No deployment or push until the English edition is complete and reviewed.
- No new test suite. Use existing type/build/content checks and focused manual
  mobile, navigation, search and storage verification.

## Current state (2026-09-09)

- Implemented server-selected language roots: Chinese route group preserves
  original paths; `/en` uses the English root document (`html lang=en`). A shared
  client context supplies the selected course, paths and glossary to all readers,
  navigation, search, notes/bookmarks and self-assessment links.
- Language links perform full document navigation, preserve the latest fragment
  and flush pending notes. Both editions use the same content/storage version.
  Search indexes are cached per course object, not in a global single-language slot.
- Added exact-source-string dictionaries (global metadata plus per-unit content)
  and a read-only missing-translation inventory. An edited Chinese source becomes
  missing instead of silently keeping an obsolete translation. Keep single-token
  example substitutions scoped to their chapter; do not globally turn all cat
  examples into we examples.
- Weeks 1–12 have no remaining untranslated source strings in the inventory,
  including their explanations, exercises and answers. This is translation
  coverage, not a declaration of complete semantic or release review.
- Week 1 explicitly distinguishes vector coordinates from tensor axes, preserves
  the row-sample X @ W + b convention, and qualifies claims about feature effects.
- Week 2 distinguishes single-sample and mean losses, local derivatives and finite
  changes, simultaneous updates and sequential updates, and training improvement
  on toy data versus generalization. Its 292 source strings are translated.
- Week 6 now includes conditional paths, the six-task worked exercise, Bigram,
  training, sampling, generation and conclusions. Its adapted toy vocabulary is
  [you, like, AI, study, we], with unchanged IDs and numerical calculations.
  Generation preconditions and the no-padding assumption of the illustrated
  perplexity function are explicit; neither snippet is claimed to implement all
  production input validation or ignored-target handling.
- Week 3 preserves the neuron-to-network progression, positive/negative output
  comparison and XOR example. It qualifies weight-importance and hidden-feature
  interpretations, distinguishes affine maps from nonlinear networks, and keeps
  task-specific output choices explicit. All 533 source strings are translated.
- Week 4 explains local derivatives, multiplication along paths, signed branch
  contributions, simultaneous updates and the distinction between backward and
  optimizer operations. All 220 source strings are translated.
- Week 5 preserves the fixed Week 2 data and update baseline. It separates
  parameter registration, gradient storage, gradient accumulation, grad mode and
  train/eval mode; clarifies shape checks by loss interface; and labels the
  original course's reported environment as historical, not an English-run claim.
  All 221 source strings are translated.
- The overview and all 45 glossary entries are translated. Glossary aliases are
  reader-facing vocabulary and now translated explicitly, while opaque section
  aliases stay protected. The inventory uses the same glossary path as runtime.
- Week 7's 405 source strings and Week 8's 333 are translated. Q/K/V examples use
  the same adapted token IDs as Week 6. Worked matrices and fixed-table outputs
  stay unchanged; descriptions distinguish rounded displays from full precision.
  The independent Week 7 masking illustration uses “you like AI.” Week 8's random
  trainable-interface example changes B's final target from ID 3 to ID 0 (“we like
  you”) to match Week 7 and natural English. This does not change the deterministic
  two-head table, which has no target-dependent calculation.
- Week 9's 553 source strings and Week 10's 439 are translated. Week 9 retains
  explicitly explained Chinese sample data for code-point/UTF-8/BPE calculations;
  this intentional foreign-language data is not untranslated instructional prose.
  Its character warm-up, byte BPE, readable V=11 snapshot and five-token main path
  remain separate artifacts. Week 10 returns to [you,like,AI,study,we] at IDs 0..4.
  Its English checkpoint artifact has a different digest from the Chinese one.
- Week 11's 659 source strings are translated. The English canonical vocabulary
  remains [you,like,AI,study,we]. Explanations distinguish optimizer-state resumption
  from exact replay, same-corpus scoring from held-out evaluation, token-weighted
  aggregation from batch-mean averaging, and sampling from model updates.
- Week 12's 562 entries and the appendix's 12 entries are now translated. All
  12 weeks, overview, appendix and glossary have zero missing source entries.
  This is coverage, not a claim that the final semantic/release audit is finished.
- English downloads now rebuild with `pnpm export:examples:en`. Complete displayed
  Week 9–12 definitions and standalone labs share the English vocabulary contract.
  The appendix links to course-examples-en.zip and its English README. Chinese
  examples and their archive are not overwritten. Only the deliberate separate
  Week 9 Unicode/tokenizer artifact keeps its Chinese sample data.
- Created an isolated, git-ignored CPU environment at tmp/english-course-venv.
  Python 3.14.7 / PyTorch 2.14.0+cpu is now available and has run selected examples
  from Weeks 5–8. No global Python installation was modified. Added standard Python
  bytecode/cache ignores to avoid including generated files in commits.
- The local release review is complete; the unconditional preview banner is
  removed. A future missing-translation warning remains, and the build now fails
  on missing source entries. Nothing committed, pushed or deployed. Production
  server PID 9220 serves this worktree's final build on 0.0.0.0:8787. Verify the
  live listener before reusing or restarting it; previous dev PID 26560 is stopped.

## Actual verification

- `pnpm exec tsc --noEmit`: passed.
- `pnpm lint`: passed after adding locale to review memo dependencies.
- `pnpm validate:content` and `pnpm validate:curated`: passed. These existing checks
  validate the Chinese source pipeline, not English translation completeness.
- `pnpm build`: passed and emitted `dist/standalone/`. Subsequent edits include
  additional translations and a fragment-link safeguard; rerun before release.
- HTTP GET: `/en/week/week-06` and `/week/week-06` return 200, with respectively
  `html lang=en` and `html lang=zh-CN`, correct localized h1s and English navigation
  URLs. `/de/week/week-06` returns 404.
- Compared all section IDs, aliases and completion flags: unchanged. Compared
  content/storage version: unchanged. Parsed all 493 candidate formulas with
  KaTeX successfully (format validation only).
- Independently recalculated logits [0,2,1,-1,0] using JavaScript arithmetic:
  exp sum 12.475217368561138; p(like)=0.5922987857150971;
  loss=0.5237440658193385; gradient(like)=-0.4077012142849029.
  Direct-logit illustrative SGD step, learning rate 0.1: p(like)=0.605689832923779,
  loss=0.5013872507993509. These are calculations, not PyTorch training logs.
- No test suite run or added. Browser-rendered mobile interaction, storage across
  a real language switch, production-runtime startup and full translation/code
  correctness review remain pending.

### Checks after completing Weeks 1, 2 and 6

- `pnpm exec tsc --noEmit` and `pnpm lint`: rerun successfully.
- English runtime loaded successfully and all 493 formula blocks parsed with
  KaTeX (`throwOnError: true`). This checks rendering syntax, not mathematical truth.
- Missing-string inventory for each of Weeks 1, 2 and 6: empty.
- `python course_examples/week01_linear_layer.py`: produced the expected F01
  batch [[1.4, 1.1], [3.2, 2.1]], swapped-input [1.5, approximately 0],
  and zero-input bias [0.1, -0.2], allowing floating-point rounding.
- `python course_examples/week02_loss_gradient.py`: L(1)=9,
  L(1.001)=8.988004000000002, forward difference=-11.99599999999812.
  Initial batch (loss,dw,db)=(41,-35,-12); first updated loss=28.45315.
  At learning rate 0.01 after 1,000 updates: w=2.0048610156782556,
  b=0.9857080211211781, loss=0.00003411404393828708.
  Learning rate 0.0001 ended at loss=1.461123777993001; learning rate 0.2
  reached non-finite values at update 415 and stopped. These are actual runs.
- At this earlier checkpoint, system Python had no PyTorch. This was subsequently
  resolved with the isolated environment documented below; system Python remains
  unchanged. See the later records for the actual subset of PyTorch runs.
- All changes remain local and uncommitted. Existing Chinese content was not
  rewritten by these English dictionary additions.

## Next work

Continue Week 12, then the appendix and supporting materials. The inventory
automatically skips completed translations. Validate formulas, examples,
language-specific search/links and unchanged storage on switch. Intentional
foreign-language tokenization examples need English explanations rather than
blind substitution. English downloadable code/README material remains pending,
even where the corresponding on-site chapter is translated.

### Checks after completing Weeks 3–5, overview and glossary

- `python course_examples/week03_neuron.py`: hidden approximately [1.4,1.1],
  prediction [1.3], negative-output comparison approximately [-1.4].
- `python course_examples/week03_xor.py`: predictions 0,1,1,0; removing ReLU gives
  2,1,1,0. The code demonstrates given-parameter capacity, not trained success.
- `python course_examples/week04_gradient_check.py`: analytical gradients
  [-12,-6,-12,-6]; central differences approximately
  [-12.000000000078613,-6.000000000039306,-12.000000000078613,-6.000000000039306].
  Updated parameters [1.12,0.06,1.12,0.06]; new loss 5.5884959999999975.
- Three translated Week 3 Python definition/exercise blocks parsed with Python
  `ast`; ASTs match their source calculations after excluding comments and string
  contents. This checks code preservation, not execution of arbitrary fragments.
  An initial diagnostic pipe hit Windows text encoding; rerunning Python with
  `-X utf8` succeeded. No course-file encoding rewrite was needed.
- English course loaded through the schema; 493 display formulas parsed with
  KaTeX. No inlineMath nodes were present in the assembled runtime to check.
  All course IDs, section aliases, source references, slugs, completion flags and
  content versions were compared with Chinese and are unchanged.
- All 45 English glossary entries, including their aliases, contain no Han text.
  Their translated definitions still require final cross-chapter semantic review.
- `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`: passed. Build includes
  the existing Chinese source/curated validators and emits dist/standalone.
- HTTP GET `/en/week/week-03` on the existing port 8787 server: 200, lang=en,
  translated output-layer explanation and language-switch markup present.
  This is HTTP evidence, not a browser-interaction or mobile-layout pass.
- Autograd wording was checked against the official notes, especially dynamic
  graph construction, saved intermediates and gradient modes:
  https://docs.pytorch.org/docs/2.14/notes/autograd.html . This documentation check
  does not replace the still-pending PyTorch runtime checks.
- No test suite was added or run. No commit, push or deployment was performed.

### Checks after completing Weeks 7–8

- Environment created with `python -m venv tmp/english-course-venv`, then its own
  Python installed `torch==2.14.0` from https://download.pytorch.org/whl/cpu .
  Actual versions: Python 3.14.7, torch 2.14.0+cpu. Use
  `tmp/english-course-venv/Scripts/python.exe -X utf8` for subsequent examples.
  NumPy is absent; PyTorch prints an optional NumPy-initialization warning. The
  tensor-only runs below complete successfully; NumPy interoperability is not
  claimed. Add/declare that dependency if later examples require it.
- Ran course_examples/week05_three_ways.py: Python/Tensor/Module first updates
  agree at approximately (0.35,0.12), loss 41→28.45315. Wrong target broadcasting
  produced (4,4); corrected errors have shape (4,1).
- Ran week06_probability.py: target probability 0.5922987857150971,
  loss 0.5237440658193385, target logit gradient -0.4077012142849029.
  Bigram/contextual lower bounds 0.46209812037329684 / 0.23104906018664842.
- Ran week06_bigram.py: initial loss 1.6094379425048828; first updated loss
  1.5983563661575317; 500-update loss 0.5594306588172913. Its original printed token
  labels are still Chinese; English downloads remain pending. These are actual
  runs of the matching numeric data, not a claim that every English snippet ran.
- Ran week07_attention.py: last-row weights A=[0.598688,0.401312],
  B=[0.425557,0.574443]; B head output [-0.425557,0.574443]. Mean loss
  1.3168361788396372, dL/dWq[1,0]=-0.07615875823519717, updated q
  1.000761587582352, updated loss 1.3167781849212228.
- Ran week08_bridge.py: reproduced Week 7 outputs, both Pre-Norm branches,
  FFN control outputs 0.210336→0.748988, and the LayerNorm scale comparison.
- Executed the actual translated Week 8 deterministic two-head code from its
  dictionary. A final logits [1.1128,-2.7390,-1.5262,2.1336,1.7397]; B final logits
  [1.0100,-2.6987,-1.5887,2.6821,1.9674]. Both attention/FFN updates and final hidden
  rows match the chapter's displayed four-decimal values.
- Executed the assembled English Week 8 TransformerBlock and MiniGPT snippets in
  chapter order, seed 7, CPU: block [2,2,4], logits [2,2,5], scalar loss. In eval
  mode, changing only inputs[0,1] gave earlier-position max logit difference 0 and
  other-batch difference 0. LM-head gradient norm 1.1716240644454956; SGD(0.01)
  changed that weight by norm 0.011716246604919434. This is a focused example
  diagnostic, not full final-MiniGPT or all-input validation.
- Explicitly observed a requires-grad leaf in-place update rejected in grad mode;
  the same update in no_grad changed 1→approximately 0.8. A Linear in eval mode
  still produced an output with requires_grad=True.
- Type check, lint and production build passed. All 493 assembled display formulas
  parsed; course identity/source/completion fields remain identical to Chinese.
  HTTP /en/week/week-08 returned 200, lang=en and translated residual section text.
- Browser-rendered mobile behavior, actual language switching/storage persistence,
  remaining chapter runtimes, English downloads and final semantic audit remain.
  No new test suite, commit, push or deployment.

### Checks after completing Weeks 9–10

- Extracted and executed all 10 displayed Python blocks from the assembled English
  Week 9 in the isolated Python 3.14.7 / PyTorch 2.14.0+cpu environment. Each block
  ran in a fresh namespace, with course_examples on the import path. Assertions
  covered the 13-character round trip, readable V=11 document stream, T+1 windows,
  12 valid padded-loss targets, 31-byte UTF-8 representation, normalization and
  BPE history ((0x41,0x49),256,2,29), ((0x96,0x9C),257,2,27).
  The final bridge uses the original data helper's identical numeric x/y; the
  English downloadable helper and its displayed token labels remain pending.
- Ran all 14 displayed English Week 10 Python blocks in chapter order, seed 7.
  Existing chapter assertions checked registration, parameter counts and invalid
  input/target cases. Canonical count=520; optional tied count=500; earlier-position
  max logit difference under the illustrated future perturbation=0.0.
- Called the actual translated save/load functions after the illustrated one-step
  AdamW update. A temporary trusted checkpoint restored logits with max difference
  0.0; a caller with swapped ordered tokens was rejected. English tokenizer digest:
  06a16a31c918aa6bec72a8e2a1ac0f9f9204a5d9c23fb2b8dff45b52efc71391.
  This verifies inference restoration, not faithful training resumption. The
  translated loader explicitly warns that weights_only=False requires trust.
- Called the displayed greedy generator on two length-3 histories with three new
  tokens: result [2,6], original prefixes retained, training mode restored on normal
  return and model state unchanged. This is a valid-input demonstration, not a
  claim that this minimal helper handles every invalid input or exception path.
- Separate block_size=3 instance with B=1,T=3 produced [1,3,5] logits. This is an
  additional unequal-axis example, not a change to the canonical configuration.
- Rechecked 493 formula blocks with KaTeX and compared 10,935 protected identity,
  source and completion fields against Chinese: unchanged. Translation inventory
  for Weeks 9 and 10 is empty. These are scoped checks, not a final semantic audit.
- During review, corrected source-index mapping mistakes that had put prose into
  some Week 9 code/data entries, then executed the corrected assembled blocks.
  The isolated environment still emits its non-blocking optional NumPy warning.
- No test suite, commit, push or deployment. Browser/mobile language switching,
  shared learning-state persistence and final English downloads remain pending.
- Type check, lint and production build passed after the Week 9–10 changes.
  The build emitted dist/standalone and ran the existing Chinese validators.
  Live development server PID 26560 remains on 0.0.0.0:8787. HTTP requests for
  /en/week/week-09, /en/week/week-10 and /week/week-10 returned 200; browser-rendered
  interactions have not been checked by these HTTP requests.

### Checks after completing Week 11

- Ran course_examples/week11_adamw_numbers.py with the isolated Python: supplied
  gradients 2 and 4 produced theta=0.98900000005 then 0.9783591798222495; m/v were
  approximately 0.2/0.004 then 0.58/0.019996. These are arithmetic demonstrations,
  not MiniGPT training logs.
- Assembled the actual English Week 10/11 displayed definitions in memory using
  the same section selectors as export-course-examples.mts. Registered the two
  modules in sys.modules so Week 11 imported the English Week 10 checkpoint and
  vocabulary contract. No rewritten stand-in model was used. Python 3.14.7,
  torch 2.14.0+cpu, one CPU thread, seed 7.
- One train_mini_gpt_step: pre-update loss 1.582396388053894, pre-clip gradient norm
  2.117048978805542, completed_updates=1. Then 500 updates through the displayed
  overfit helper gave final recomputed same-batch loss 0.3694435656070709. Last
  pre-update loss was 0.37001362442970276. Identical [you] contexts produced identical
  logits. Its final probabilities included like=0.4937257469 and study=0.4293523133.
  This is fixed-batch learning, not held-out validation or attainment of the ideal
  ln(2)/3=0.23104906018664842 lower bound.
- External ignored-target loss over one batch versus differently packed batches
  was 0.42418460845947265 versus 0.4241845726966858. This checked token weighting on
  the same corpus only. Empty and all-ignored inputs raised their documented
  errors, and the previous training mode was restored.
- Saved a temporary trusted English checkpoint with optimizer state at update 501.
  The actual resume loader restored the count and optimizer. Applying the same next
  fixed-batch update to original and restored models gave max parameter difference
  0.0. This controlled no-dropout CPU comparison is not proof of exact replay with
  shuffled data, random layers or different devices; that extra RNG/data state is
  not saved by this format.
- Seed 19: four equal microbatches accumulated into one update matched one repeated
  full batch to max parameter difference 9.313225746154785e-10. An incomplete
  three-microbatch window with accumulation_steps=4 was rejected without changing
  model state or its prior evaluation mode.
- Fixed five-logit probabilities at tau=0.5,1,2 reproduced the chapter tables;
  probability of like was 0.8599431110, 0.6115883299 and 0.4025691872 respectively.
  top_k=1 selected ID 1. Zero/tiny temperatures and invalid k values were rejected.
- Actual sampled generator grew [2,3] histories to [2,6], retained original
  prefixes, did not change model state, and restored mode on both normal return
  and a sampling-temperature error.
- Week 11 has 19 displayed Python blocks and none contain Han text. The checks
  above execute its exported definitions and selected behaviors, not a claim that
  every demonstration fragment is a standalone program. English downloads are
  still pending. All 493 formulas parsed; 10,935 protected identity/source/
  completion fields match Chinese. No new test suite, commit, push or deployment.
- Type check, lint and production build passed after Week 11. The existing
  Chinese source/curated validators also passed as build prerequisites.

Inventory: `node --import tsx scripts/translation-inventory.mts`

Inspect a unit: append `--unit=week-06 --offset=0 --limit=40`.

Inspect glossary vocabulary: `--unit=glossary --limit=40`.

### English download and mobile checks — 2026-09-09

- Exported the English package to a new temporary staging directory using an
  explicit file allowlist. No virtual environment, run output, checkpoint or
  maintenance test suite enters the archive. The export stops on stale standalone
  lab translations, remaining instructional Han text, or missing course entries.
- Extracted public/downloads/course-examples-en.zip into a new independent folder:
  D:/Tmp/ai-learning-english-unzip-764afb5563744759b442d3eb7bcc32e4/course_examples_en.
  Every command below ran in its own process there using the isolated Python
  3.14.7 / PyTorch 2.14.0+cpu interpreter from this worktree. Optional NumPy warning
  remains non-blocking. No test suite was added or run.
- All documented weekly entry points ran successfully: week01_linear_layer,
  week02_loss_gradient, week03_neuron, week03_xor, week04_gradient_check (existing
  numerical learning tool), week05_three_ways, week06_probability, week06_bigram,
  week07_attention, week08_bridge, week09_data_protocol, w09_readable_v1,
  mini_gpt_walkthrough, week11_adamw_numbers, week11_minimal_loop and
  week12_end_to_end. All five week10_stages modes ran: embedding, single, multi,
  block, full. This proves their documented executions, not every possible input.
- Project A: 520 parameters, 100 updates, same-batch loss
  1.582396388053894 → 1.1980470418930054; English ordered vocabulary
  (you,like,AI,study,we); checkpoint_round_trip=PASS; generated IDs [0,1,0,1,1],
  decoded as "you like you like like". Not a generalization claim.
- Project B actual command: python -X utf8 week12_generalization.py --steps 200
  --eval-every 20 --seed 7 --output runs/first. Evaluation uses 1,920 train and
  816 validation targets. Training eval loss 3.396806573867798 →
  2.2179028511047365; validation 3.4022300243377686 → 2.5694546699523926.
  Validation briefly worsens during training; the complete CSV retains this.
- Project C actual command differs only by --learning-rate 0.001 and
  --output runs/lower-lr. Train loss ends at 2.3388961791992187, validation at
  2.5451366901397705. Same starting values/config/seed except learning rate/output.
  One small comparison does not establish a universally better learning rate.
- Both runs report save/load logit max difference 0; no full validation document
  is contained in training and all three 48-character overlap counts are 0.
  Scope remains finite, whitespace-normalized overlap, not all near duplicates.
  Ran the documented generate-only command with prompt "a " and 80 new tokens.
  It produced poor but executable character output; no quality claim is made.
- Real config/data reports, CSVs, SVGs, samples and English interpretation templates
  are retained under docs/english-validation/{first,lower-lr}. No checkpoints are
  committed or included in downloads. Original course_examples has no changes.
- English ZIP SHA-256 at this verification:
  0bd819e9ca1b078445275e04a1b1203000e7e78ecf0d75bed8eb279686e532df.
  HTTP English appendix, ZIP, English README and Chinese Week 6 all returned 200.
  Build packaging now requires both English download artifacts.
- Chrome DevTools isolated context english-review at 127.0.0.1:8787. Initial
  desktop width 2,529; mobile emulation 390×844 with touch. Not a physical iPhone
  or Safari check. English Week 6 has no rendered KaTeX error elements.
- In that isolated browser, completed and bookmarked o0222-week-6, typed a mixed
  English/Chinese note, closed Study, switched to Chinese and back. Exact section
  hash, stored completion/bookmark/note/content version survived. Chinese heading
  and html lang=zh-CN replaced English; returning restored html lang=en.
- Found and fixed a cascade bug: a later 5rem base scroll margin overrode the
  mobile 8rem rule. After correction the section top is approximately 128px,
  safely below the 106px bilingual header. Reader observation now measures header
  height with ResizeObserver instead of assuming 64px for every layout.
- Found and fixed stale copied/auxiliary language links after replaceState scroll
  updates or same-page search navigation. The reader emits a location notification;
  switch links retain query/hash and refresh on scroll, hash, popstate and search.
  Verified actual hrefs track Softmax after scrolling and selecting a search result.
- Mobile search for cross entropy: dialog x=16,width=358 inside width=390; input
  font 16px, document scrollWidth=390. Enter selects the English result, closes
  the dialog and focuses its heading without horizontal page enlargement.
- Type check, lint and production build passed after these changes. Reparsed all
  493 formulas and compared 10,935 identity/source/completion fields: unchanged.

### Final local release audit — 2026-09-09

| Requirement | Evidence and scope |
|---|---|
| Full English course, not a summary | Twelve complete per-week dictionaries, overview, all 45 glossary entries and appendix translate the final assembled website. Coverage is zero missing entries. Chapter-by-chapter explanations, examples, exercises and answers were reviewed during translation; numeric/code evidence is recorded above. |
| Mathematical/code consistency | 493 formulas parse; fixed examples and displayed/exported implementations were executed as recorded per week. All English ZIP entry commands ran in fresh processes after extraction. Cross-chapter token IDs, target shifts and separate character/tokenizer artifacts are explicit. |
| Intentional foreign-language data distinguished from untranslated prose | Final Han-text inspection found the explained Week 9 Unicode/BPE sample and its Week 12 recap, not untranslated instructional paragraphs. The five-word main sequence remains English throughout its models and downloads. |
| Language choice without losing learning data | Mobile English→Chinese→English preserved exact section, progress, bookmark and note. Production review-page switching preserved those plus an understood knowledge-check result. Chinese section IDs, content version and source identities remain unchanged (10,935 compared fields). |
| Readable working site | Rendered overview, all 12 English weeks, appendix and review in the production build: English headings/lang, two language links, metadata in head, no KaTeX error elements or viewport-wide overflow at 390×844. Desktop 1365×900 navigation collapse/expand and Week 8→9 navigation worked. See browser-routes.json. |
| Search, glossary and review | Search selection retains the English route and focuses the heading; query/section-aware language hrefs update after scrolling and search. Glossary filter returns exactly the expected ten gradient-related entries, all 45 source-section IDs resolve. Notes/bookmarks render under localized course titles without rewriting personal text. |
| Downloads | English ZIP and README are generated separately, available via localized appendix links, and return HTTP 200. Its independent extraction ran all documented labs, all five model stages and Projects A/B/C including inference reload. Chinese examples have no edits. |
| Error pages and discovery | Invalid English lesson and unsupported locale return 404. English recovery links target /en and /en/week/week-01, with an explicit Chinese alternative. Chapter-specific titles, descriptions, canonical and language-alternate links are in head in production. Review metadata is noindex. |
| Verification and delivery | Final tsc, lint, production build and git diff --check pass. Build includes validate:english. Full local site and downloads respond on 192.168.68.114:8787. README_EN.md explains both editions, running, learning data, examples and publishing status. |

Additional fixes discovered in rendered review:

- The inline-code selector accidentally styled code inside pre, putting a pale
  background behind gray code. Restricted that selector to non-pre code and raised
  syntax-comment contrast. Button accessible names now include their visible labels.
- Moved search dialog title/description inside its popup and gave empty/prompt
  states explicit disabled options. Populated search has valid listbox/group/option
  ownership and keyboard selection. Compact DevTools snapshots still omit some
  result descendants; no screen-reader certification is claimed from that alone.
- Actual Lighthouse snapshots of Week 6 and final empty/populated search report
  100 accessibility, best practices, SEO and agentic-browsing scores with no failed
  audits. They are scoped automated audits, not proof of universal accessibility.
  Summaries are preserved in docs/english-validation/browser-audits.json.
- Multiple glossary terms shared a section ID as their React key. Filtering could
  retain unrelated/duplicate rows. Keys now combine section ID and term; a rendered
  gradient filter matches the ten source entries exactly.
- Local synchronous metadata is resolved before HTML for all clients using the
  supported htmlLimitedBots configuration. This keeps descriptions and language
  links in head rather than the framework's streamed body metadata.

The temporary production probe on 8788 and old development process were stopped
after checking their exact command lines. The final standalone build is serving
on 0.0.0.0:8787, PID 9220, exec session 95807 at verification time. LAN IPv4
192.168.68.114 was read from the active Ethernet interface. Phone/Safari hardware
was not available; mobile checks used Chrome emulation, not a physical iPhone.

No new test suite was written or run. No global Python environment was changed.
No commit, push or Azure deployment was performed. Publishing is a separate,
user-authorized follow-up; the bilingual local implementation is delivered.
