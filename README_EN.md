# AI First Principles

English · [中文说明](README.md)

A twelve-week course for experienced programmers who want a clear mathematical
foundation for AI. Work from concrete numbers and Python through gradients,
neural networks, language models, attention and a teaching Mini GPT.

Both editions contain the full course—not an English summary of the Chinese
edition. Lessons, formulas, tables and code are readable directly on the website.

## Choose your language

| Page | Chinese | English |
|---|---|---|
| Course overview | `/` | `/en` |
| A week (01–12) | `/week/week-06` | `/en/week/week-06` |
| Mini GPT appendix | `/appendix/mini-gpt` | `/en/appendix/mini-gpt` |
| Notes and bookmarks | `/review` | `/en/review` |
| Runnable examples | `/downloads/course-examples.zip` | `/downloads/course-examples-en.zip` |

Use **中文 / English** in the header. Switching retains the corresponding section
and shares progress, bookmarks, notes and reading preferences. Notes are personal
text; switching does not translate or overwrite them. Search uses the selected
course language. Week 9 deliberately keeps an explained Chinese sample to show
Unicode and byte-tokenization behavior.

The [existing public course](https://ai-learning-geadc0g3f5c9h3ek.australiasoutheast-01.azurewebsites.net/)
can be shared without installing anything. **The English edition in this revision
must be deployed before `/en` becomes available on that public site.** Local
implementation and validation do not mean a GitHub push or Azure deployment has occurred.

## Run this checkout

Use Node.js 22.13.0 or newer and the project's pinned pnpm 11.19.0.
The website does not need Python or a GPU.

```sh
pnpm install --frozen-lockfile
pnpm dev --hostname 0.0.0.0 --port 8787
```

Open [English locally](http://localhost:8787/en) or
[Chinese locally](http://localhost:8787/). On a phone connected to the same trusted
network, replace `localhost` with the computer's LAN IPv4 address. `localhost` on
the phone means the phone itself. Confirm the actual listening port in the terminal;
firewall restrictions or Wi-Fi client isolation may prevent access.

## Learning path

| Week | Main problem |
|---|---|
| 1 | Translate scalars, vectors, matrices, dot products and shapes into code. |
| 2 | Measure prediction errors and update linear-regression parameters. |
| 3 | Build neurons, nonlinear hidden layers and task-appropriate outputs. |
| 4 | Follow the chain rule, branches and backpropagation. |
| 5 | Reproduce hand calculations with tensors and PyTorch Autograd. |
| 6 | Connect tokens, embeddings, logits, Softmax, cross-entropy and Bigram training. |
| 7 | Calculate Q/K/V attention, causal masking and multiple heads. |
| 8 | Connect positions, residuals, LayerNorm and FFNs into a Transformer block. |
| 9 | Keep tokenization, document windows and training targets consistent. |
| 10 | Assemble GPT while tracking tensor axes and registered parameters. |
| 11 | Train, evaluate, save, load and generate with the same model. |
| 12 | Trace the system, run an independent-document experiment and change one factor. |

Allow roughly 7–10 hours per week, alternating reading, hand calculations and
experiments. The original section numbers remain for stable references; follow
the current page order rather than rearranging sections by their old numbers.
Small training-loss improvements do not establish generalization or fluent language.

## Reader features and personal data

- Collapsible contents, section links and language-specific search.
- Worked calculations, rendered formulas, code copying and revealable answers.
- Completion state, bookmarks, section notes and a review workspace.
- Light/dark themes and reading preferences. Ctrl+K / Cmd+K opens search.

State lives in your browser's `localStorage`, not in an account or a server-side
database. There is no automatic cross-device or cross-origin synchronization.
Changing a host, IP, port or browser creates a different storage context.

Reading settings provide JSON backup import/export. Back up important notes before
clearing browser data or changing course versions. This language edition preserves
the existing content version and section IDs; it does not reset Chinese learning state.

## English Python examples

Download `/downloads/course-examples-en.zip` from the local or updated deployed
site, extract it, and follow its English README. The bundle includes all weekly
entry points, the data helper and original teaching documents. It excludes virtual
environments, caches, checkpoints and training outputs.

The main word vocabulary is `[you, like, AI, study, we]`, IDs 0–4. Its checkpoints
are not interchangeable with the Chinese word mapping, even though both have five
entries. The independent character-data experiment has a separate configuration
and checkpoint format.

Weeks 1–4 and selected numerical/data labs use standard Python. Other labs need
PyTorch. The English execution review used Python 3.14.7 and PyTorch 2.14.0+cpu on
Windows; the download documents the exact CPU installation command. This is not
a claim of verification on every platform or GPU.

The [English learning route](src/content/english/examples/LEARNING_ROUTE.md) and
[example instructions](src/content/english/examples/README.md) are also readable
in the repository. Recorded observations are in
[English implementation and verification status](docs/ENGLISH_VERSION_STATUS.md).

## Build and maintain

```sh
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm start
```

The build runs existing source-content validators and emits a standalone Node
server. `PORT` selects the production port; its default is 3000.

English dictionaries in `src/content/english` translate the **final reviewed
website content**, not the historical PDF. Stable IDs and source identity fields
are preserved. Editing a Chinese source string intentionally exposes a missing
translation instead of silently keeping an outdated translation.

```sh
node --import tsx scripts/translation-inventory.mts
pnpm export:examples:en
```

The English export requires Python's standard-library ZIP support as well as Node
and project dependencies. Set `COURSE_PYTHON` if the executable is not named
`python`. It uses fresh staging, exports displayed definitions, applies reviewed
standalone-lab translations and produces the English ZIP and public README.
It does not overwrite the Chinese examples or archive.

Zero missing translations and a successful build do not replace semantic or
numerical review. Keep formulas, token mappings, worked targets and downloadable
code in agreement. Re-run the affected examples after changing them.

## Azure publishing

The existing `.github/workflows/azure-app-service.yml` builds a Linux Node package
and deploys using GitHub-to-Azure OIDC when configured. After this revision is
merged and pushed to `main`, the configured workflow can publish both languages
together. See the existing [Azure setup guide](docs/AZURE_DEPLOYMENT.md) for account
and repository configuration. Do not include development `node_modules`, secrets
or local experiment files in a deployment package.

The independent `AstroCourse` directory remains excluded from this repository.
