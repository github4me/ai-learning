# AI First Principles — English course examples

A twelve-week path from numerical intuition to a teaching Mini GPT. Start with
[LEARNING_ROUTE.md](LEARNING_ROUTE.md) and the corresponding English website lesson.
These are learning experiments, not a production chatbot.

## Install and run

Run the commands below from this extracted `course_examples_en` directory.
The translation review uses Python 3.14.7 and PyTorch 2.14.0+cpu on Windows.
A GPU, NumPy, notebooks and downloaded language datasets are not required.
Other platforms have not yet been verified for this edition.

Windows PowerShell:

~~~powershell
py -3.14 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt --index-url https://download.pytorch.org/whl/cpu
~~~

Use `.\.venv\Scripts\python.exe` instead of `python` in every command below,
or activate the environment with `.\.venv\Scripts\Activate.ps1`. If activation
is restricted, using the executable directly does not require changing global policies.

On macOS/Linux, the equivalent environment commands are:

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
~~~

For other devices or wheel availability, consult the
[official PyTorch installation selector](https://pytorch.org/get-started/locally/).
A version pin alone is not a claim of availability on every Python/platform combination.

Weeks 1–4, the Week 9 data protocol and Week 11 AdamW arithmetic use standard
Python only. Tensor, attention and GPT experiments need PyTorch. Use
`python -X utf8 filename.py` if an older console cannot print Unicode.

## Weekly entry points

These are learning commands and expected observations, not a substitute for the
repository's actual verification record.

| Command | What to observe |
|---|---|
| `python week01_linear_layer.py` | Two output rows from the same X/W/b; swapped features give approximately [1.5,0]. |
| `python week02_loss_gradient.py` | L(1), L(1.001), one batch update and three learning rates; divergence is reported. |
| `python week03_neuron.py` | Two hidden neurons, a linear output and the negative-output counterexample. |
| `python week03_xor.py` | Hand-set ReLU weights represent XOR; removing ReLU gives 2−x1−x2. |
| `python week04_gradient_check.py` | Compare hand gradients with small numerical perturbations. |
| `python week05_three_ways.py` | Python, Tensor and Module agree with equal initialization and mean MSE. |
| `python week06_probability.py` | The lesson's logits, cross-entropy and gradient values. |
| `python week06_bigram.py` | Six prediction tasks, a zero-initialized score table, updates and generation. |
| `python week07_attention.py` | Q/K/V through vocabulary loss, then change one query parameter. |
| `python week08_bridge.py` | Reuse Week 7 inputs; inspect normalization, branches and residuals. |
| `python week09_data_protocol.py` | Fixed five-word IDs, an unknown token and the T+1 boundary. |
| `python w09_readable_v1.py` | The separate readable-tokenizer artifact described in Week 9. |
| `python week10_stages.py --stage embedding` | Then run single, multi, block and full; identify each added computation. |
| `python mini_gpt_walkthrough.py` | V=5, C=4, H=2, two blocks, untied weights: 520 parameters. |
| `python week11_adamw_numbers.py` | Two supplied gradients, m/v, bias correction and parameter changes. |
| `python week11_minimal_loop.py` | A minimal training loop without accumulation or complex restoration. |
| `python week12_end_to_end.py` | Project A: trace, train, save, reload and generate from three fixed sentences. |
| `python week12_generalization.py --steps 200 --output runs/first` | Project B: independent documents, real CSV/SVG records and inference reload. |

The website's function fragments are not all standalone programs. The exported
Week 10/11 modules contain complete definitions and do not train on import.

## One consistent main dataset

`course_data.py` fixes the word IDs:
you=0, like=1, AI=2, study=3, we=4. It splits on spaces.

The three documents are "you like AI", "we like you", and "you study AI".
With T=2 they produce:

~~~text
inputs  = [[0,1], [4,1], [0,3]]
targets = [[1,2], [1,0], [3,2]]
~~~

Changing Bigram to MiniGPT does not change these targets. The repeated context
"you" has two observed next words, so this dataset does not allow every prediction
to become simultaneously certain.

`w09_readable_v1.py` deliberately retains the Chinese sample used to explain
Unicode, byte encoding and special tokens. Its English lesson explains that data;
it is not untranslated instruction. It uses a separate ID space and does not
replace the five-word main tokenizer.

The English main tokenizer has its own ordered-vocabulary identity. Do not load
Chinese-edition or historical character-model checkpoints into it. Matching
vocabulary sizes do not make two mappings compatible.

Week 7/8 hand-calculation projections are explicitly supplied, not learned by
the preceding experiment. Random stage examples do not establish a performance ranking.

## Project A: mechanism tracing

`python week12_end_to_end.py` writes or overwrites `mini-gpt-training.pt`
in the current directory. Run in a fresh copy, or save an existing demonstration
checkpoint elsewhere first. Only load checkpoints you created or otherwise trust.
Learning three sentences is not evidence of generalization.

## Project B: independent documents

Eight original training documents and three validation documents are in
`data/documents`. The split precedes window construction. This reuses the same
MiniGPT class with an explicit new character-task configuration:
V=30, T=24, C=32, H=4, two blocks, untied weights, CPU float32, no dropout.

~~~sh
python week12_generalization.py --steps 200 --eval-every 20 --seed 7 --output runs/first
python week12_generalization.py --generate-only runs/first/inference.pt --prompt "a " --new-tokens 80
~~~

Only running the experiment creates `config.json`, `data_report.json`,
`loss.csv`, `loss.svg`, `samples.json`, `inference.pt` and
`experiment_record.md`. The output directory must not already exist.

Both plotted losses use eval/no_grad over all fixed windows and are weighted by
effective target count. Training-window sampling has an independent random
generator, so evaluating more often does not alter that stream. The data report
checks full validation-document containment and 48-character overlap after
whitespace normalization. This finite check does not exclude every near duplicate.

The character-experiment checkpoint is for inference, not exact training
resumption, and has a separate format from Project A. Few short documents and a
shared writing style cannot establish real-world language ability.

## Project C: change one factor

Write down a prediction first. Keep seed, data and other configuration fixed:

~~~sh
python week12_generalization.py --steps 200 --eval-every 20 --seed 7 --learning-rate 0.001 --output runs/lower-lr
~~~

Compare actual records, including outcomes that differ from your prediction.
Do not infer reliable model quality from one sampled sentence.

## Rebuilding this download

In the website repository, run `pnpm export:examples:en` with Node, the project's
dependencies and Python installed. Set `COURSE_PYTHON` to a Python executable if
it is not named `python`. Week 9–12 definitions come from the actual English
lesson content; other labs use reviewed, exact-source translations.

The archive excludes virtual environments, caches, training runs, checkpoints and
the repository's maintenance test tool. The Chinese examples are not overwritten.
See `docs/ENGLISH_VERSION_STATUS.md` in the repository for actual review evidence.
