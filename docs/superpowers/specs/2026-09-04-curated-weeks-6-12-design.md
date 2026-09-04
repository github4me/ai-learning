# Curated Weeks 6-12 Content Redesign

## Status

Approved in chat on 2026-09-04. The user approved the expanded Week 6 draft and authorized applying the same beginner-first teaching standard to Weeks 7-12 after Week 6 passes verification.

## Goal

Rewrite Weeks 6-12 as a coherent beginner learning path in which every concept is introduced by the problem it solves, its practical meaning, its use, a concrete running example, the necessary mathematics and tensor shapes, and the mistakes a beginner is likely to make.

## Source of truth

- The current website course is the editorial baseline.
- The original PDF is no longer an editorial constraint for Weeks 6-12.
- Do not regenerate, compare against, or preserve wording merely because it appears in the PDF.
- Keep the generated course JSON as an untouched base artifact and apply checked-in curated revisions at runtime so future PDF normalization cannot overwrite the rewritten lessons.
- Weeks 1-5 and Appendix A remain unchanged in this project.

## Pedagogical contract

Every rewritten numbered section must make the following sequence clear where it applies:

1. What problem has appeared?
2. Why does this concept exist?
3. What does it mean in plain language?
4. Where is it used in the model or workflow?
5. How does it operate in the week's running example?
6. What are the relevant equations, values, and tensor shapes?
7. What common misunderstanding should the learner avoid?
8. What short question can the learner answer to check understanding?

Additional rules:

- Introduce intuition before notation.
- Define every symbol before using it.
- Keep one vocabulary, example, and set of dimensions stable within a week.
- Label every numeric vector with the token or tensor position it represents.
- Never present an unexplained shape transition.
- Render executable snippets as code blocks with preserved indentation.
- Put optional derivations, implementation details, and edge cases after the main explanation and label them as advanced material.
- Distinguish training from generation whenever both appear.
- Use technically precise language without implying that probabilities are facts, embeddings are human-authored meanings, or attention guarantees understanding.

## Week 6: approved running example

Use the vocabulary:

| ID | Token |
|---:|---|
| 0 | 我 |
| 1 | 喜欢 |
| 2 | AI |
| 3 | 学习 |
| 4 | 猫 |

Use the corpus:

```text
我 喜欢 AI
猫 喜欢 我
我 学习 AI
```

Use the fixed dimensions:

- `B = 3`: three sequences in the batch.
- `N = 3`: three source tokens per sequence.
- `T = 2`: two next-token training positions after shifting.
- `C = 4`: four features per token embedding.
- `V = 5`: five vocabulary candidates.

The training tensors are:

```text
inputs  = [[0,1], [4,1], [0,3]]
targets = [[1,2], [1,0], [3,2]]
```

The six prediction tasks are:

```text
我→喜欢, 喜欢→AI,
猫→喜欢, 喜欢→我,
我→学习, 学习→AI
```

The chapter must trace:

```text
raw IDs [3,3]
→ shifted inputs [3,2]
→ embeddings [3,2,4]
→ logits [3,2,5]
→ flattened logits [6,5]
→ flattened targets [6]
→ scalar mean cross-entropy loss
```

For the labelled Softmax example, use candidate order `[我, 喜欢, AI, 学习, 猫]`, logits `[0,2,1,-1,0]`, exponentials `[1.000,7.389,2.718,0.368,1.000]`, sum `12.475`, probabilities `[0.080,0.592,0.218,0.029,0.080]`, and loss `-ln(0.592) ≈ 0.524` when the target is `喜欢`.

Week 6 must explicitly distinguish:

- Token, Tokenizer, Vocabulary, and Token ID.
- Token ID as an address versus Embedding as a learned continuous representation.
- Tensor rank, axis, axis size, and the meanings of `B`, `N`, `T`, `C`, and `V`.
- A semantic/input table `nn.Embedding(V,C)` versus the Bigram shortcut `nn.Embedding(V,V)` that directly stores next-token logits.
- A general language model using the available left context versus a Bigram model using only the current token.
- Teacher-forced parallel training versus iterative autoregressive generation.
- `logits[:, -1, :]` as the only distribution used to append the next generated token.

## Week 7: Attention

Use `[我,喜欢]` and `[猫,喜欢]` as the central contrast. Both end in `喜欢`, so the Week 6 Bigram returns the same row; Attention must let the second position use the earlier `我` or `猫`.

Use `B=2`, `T=2`, `C=4`, `n_head=2`, and `head_size=2` for visible shape examples. Explain the progression `x → Q/K/V → scores [B,T,T] → causal mask → weights → weighted Values → output`, and label rows and columns of every `[T,T]` matrix. Q, K, and V must first be introduced as three different questions the layer must answer, not as unexplained letters.

## Week 8: Transformer

Continue the same two prompts and `C=4` representation. Explain why Attention alone lacks position handling, per-token nonlinear processing, stable information paths, and normalization. Build one Transformer block incrementally:

```text
token + position embeddings
→ pre-norm attention + residual
→ pre-norm feed-forward + residual
→ contextual representation
```

Every residual addition must show identical input/output shapes. Clearly distinguish what mixes information across token positions from what processes each token position independently.

## Week 9: Tokenizer

Start again from raw text rather than pre-assigned IDs. Use one visible string containing Chinese, Latin letters, punctuation, and a repeated substring. Compare character-, word-, byte-, and subword-level choices before introducing BPE. Show at least two manual BPE merge rounds with frequency counts, then separate tokenizer training from encoding. Trace raw text to tokens, IDs, a one-dimensional token stream, shifted examples, and a batch.

## Week 10: GPT architecture

Assemble the earlier pieces with one deliberately tiny configuration. Use `vocab_size=5`, `block_size=2`, `n_embd=4`, `n_head=2`, and `n_layer=2` for hand-checkable shape and parameter examples. Explain each configuration field by the failure or ambiguity it prevents. Trace ownership and shape through embeddings, blocks, final normalization, and the language-model head before presenting the full class.

## Week 11: Training and inference

Return to the Week 6 three-sentence corpus for concrete batches. Explain each training-loop line by the state change it causes. Use `ln(V)=ln(5)≈1.609` as the uniform-prediction initial-loss reference. Separate training, validation, checkpointing, and inference. Generation examples must take the last-position logits and then introduce temperature and top-k one transformation at a time with labelled probabilities.

## Week 12: complete Mini GPT

Use one end-to-end trace as the spine of the chapter. Begin with raw text and follow one batch through tokenization, embeddings, Attention, Transformer blocks, logits, loss, backward, optimizer update, checkpointing, and autoregressive generation. Existing implementation details remain, but each is introduced only after the learner can locate it in the pipeline. End with a staged debugging workflow and a final mental model that points back to Weeks 1-11.

## Runtime content architecture

- Add a small typed curated-content layer under `src/content/curated/`.
- A revision targets an existing week slug and existing section IDs.
- It may replace a section title and blocks while preserving the route and section identity.
- Curated blocks receive their source metadata from the existing website section only because the runtime schema currently requires it; the metadata is not an editorial fidelity claim and is not shown as repeated body links.
- Load and validate the generated base course first, apply the revisions immutably, then validate and freeze the final runtime course.
- Assign globally unique curated block IDs with a `curated-wNN-...` prefix.
- Keep one explicit `COURSE_CONTENT_VERSION` constant. Every curated content change must bump it.

## Learner-state reset contract

When persisted `contentVersion` differs from `COURSE_CONTENT_VERSION`:

- Ignore and replace the entire stored learning-state envelope.
- Reset progress, last location, appendix reading state, bookmarks, notes, quiz attempts, and reading preferences.
- Do not migrate aliases or retain orphaned learner data.
- Ignore stale preferences during the pre-hydration theme bootstrap.
- Reject an imported backup whose content version differs from the current course version.

The reset applies only to the namespaced key `ai-first-principles:learning-state` and must not touch unrelated browser storage.

## Verification contract

The user explicitly requested no new tests and no repository test execution. Verification therefore consists of:

- Runtime schema and duplicate-ID validation.
- Curated-content structural audit: every targeted numbered section has problem, purpose, example, misconception, and understanding-check material.
- Mathematical and shape audit against the fixed examples in this specification.
- `pnpm lint`.
- `pnpm exec tsc --noEmit`.
- `pnpm build`.
- `git diff --check`.
- Browser inspection at desktop and 390-by-844 mobile widths.
- Direct checks of Week 6, then one representative concept/formula/code section from each of Weeks 7-12.
- Confirmation that a stale local learner-state envelope is reset after the content-version change.

## Out of scope

- Rewriting Weeks 1-5.
- Rewriting Appendix A.
- Preserving PDF prose or PDF page parity for Weeks 6-12.
- Adding a new backend, account system, or cloud persistence.
- Writing or running unit, component, or end-to-end tests.
