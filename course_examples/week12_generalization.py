"""Week 12 project B: independent documents, actual logs, a chart and inference reload.

Run from course_examples: python week12_generalization.py --steps 200 --output runs/first
No outputs exist until this program is run. Existing output directories are never overwritten.
"""
import argparse
import csv
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import platform
import random
from xml.sax.saxutils import escape

import torch
from course_data import DOCUMENT_TOKENIZER, TokenCodec, make_windows, configure_console
from mini_gpt_walkthrough import GPTConfig, MiniGPT

FORMAT = "course-document-experiment-v1"
DATA_ROOT = Path(__file__).resolve().parent / "data" / "documents"


def read_documents(split):
    paths = sorted((DATA_ROOT / split).glob("*.txt"))
    if not paths:
        raise ValueError(f"No documents found for {split}")
    return [(path.name, path.read_text(encoding="utf-8").replace("\r\n", "\n")) for path in paths]


def describe_data(train, validation, block_size):
    records = []
    for split, docs in (("train", train), ("validation", validation)):
        for name, text in docs:
            ids = DOCUMENT_TOKENIZER.encode(text)
            windows, _ = make_windows([text], DOCUMENT_TOKENIZER, block_size, stride=block_size)
            records.append(dict(split=split, document=name, characters=len(ids),
                                normalized_text_sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                                windows=len(windows), effective_targets=len(windows) * block_size))
    # Exact text containment and whitespace-normalized long-fragment overlap are distinct checks.
    contained = [(vn, tn) for vn, vt in validation for tn, tt in train
                 if " ".join(vt.split()) in " ".join(tt.split())]
    width = 48
    fragments = lambda text: {text[i:i + width] for i in range(len(text) - width + 1)}
    train_fragments = set().union(*(fragments(" ".join(text.split())) for _, text in train))
    overlap = {name: len(fragments(" ".join(text.split())) & train_fragments) for name, text in validation}
    if contained:
        raise ValueError(f"Validation documents contained in training documents: {contained}")
    return dict(documents=records, full_validation_containment=contained,
                overlap_characters=width, whitespace_normalized_overlap_counts=overlap,
                limitation="Finite overlap audit, not a proof against all near duplicates or bias.")


def evaluate(model, inputs, targets):
    previous_mode = model.training
    model.eval()
    loss_sum, count = 0.0, 0
    try:
        with torch.no_grad():
            for start in range(0, len(inputs), 64):
                x, y = inputs[start:start + 64], targets[start:start + 64]
                _, loss = model(x, y)
                if loss is None or not torch.isfinite(loss):
                    raise ValueError("Evaluation returned a non-finite loss")
                loss_sum += loss.item() * y.numel()
                count += y.numel()
    finally:
        model.train(previous_mode)
    if not count:
        raise ValueError("Evaluation has no valid targets")
    return loss_sum / count, count


def sample(model, codec, prompt, count, temperature=0.8, top_k=None):
    if not math.isfinite(temperature) or temperature <= 0 or type(count) is not int or count < 0:
        raise ValueError("temperature must be finite/positive and new token count non-negative")
    if top_k is not None and (type(top_k) is not int or not 1 <= top_k <= len(codec.tokens)):
        raise ValueError("top_k must be inside 1..vocab_size")
    ids = codec.encode(prompt)
    if not ids:
        raise ValueError("Prompt must encode to at least one token")
    history = torch.tensor([ids], dtype=torch.long)
    previous_mode = model.training
    model.eval()
    try:
        with torch.no_grad():
            for _ in range(count):
                logits, _ = model(history[:, -model.config.block_size:])
                last = logits[:, -1] / temperature
                if top_k is not None:
                    values, indices = last.topk(top_k, dim=-1)
                    last = torch.full_like(last, float("-inf")).scatter(1, indices, values)
                next_id = torch.multinomial(last.softmax(dim=-1), 1)
                history = torch.cat((history, next_id), dim=1)
    finally:
        model.train(previous_mode)
    return codec.decode(history[0].tolist())


def load_inference(path):
    # Only load your own trusted checkpoints. No optimizer/RNG resume is promised.
    saved = torch.load(path, map_location="cpu", weights_only=True)
    if saved.get("format") != FORMAT or saved.get("tie_weights") is not False:
        raise ValueError("Not an untied document-experiment checkpoint")
    config = GPTConfig(**saved["config"])
    info = saved["tokenizer"]
    codec = TokenCodec(tuple(info["tokens"]), info["mode"])
    if len(codec.tokens) != config.vocab_size:
        raise ValueError("Tokenizer and model vocabulary sizes differ")
    model = MiniGPT(config).eval()
    model.load_state_dict(saved["model_state"], strict=True)
    return model, codec


def chart(rows, destination):
    """A numeric SVG generated only from the actual evaluation records."""
    width, height, left, top, plot_width, plot_height = 760, 390, 65, 45, 660, 285
    values = [row[key] for row in rows for key in ("train_eval_loss", "validation_loss")]
    low, high = min(values), max(values)
    margin = max(0.05, (high - low) * 0.1)
    low, high = max(0, low - margin), high + margin
    last_step = max(row["completed_updates"] for row in rows) or 1
    x = lambda step: left + step / last_step * plot_width
    y = lambda loss: top + (high - loss) / (high - low) * plot_height
    pieces = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
              '<rect width="100%" height="100%" fill="white"/>',
              '<g font-family="sans-serif" font-size="13" fill="#172c39">',
              '<text x="65" y="23">Actual evaluation loss: fixed windows, CPU, no dropout</text>']
    for tick in range(5):
        value = low + (high - low) * tick / 4
        pieces += [f'<line x1="{left}" y1="{y(value):.2f}" x2="{left + plot_width}" y2="{y(value):.2f}" stroke="#ddd"/>',
                   f'<text x="10" y="{y(value) + 4:.2f}">{value:.3f}</text>']
    for key, color, label, label_x in (("train_eval_loss", "#087e8b", "training documents", 85),
                                      ("validation_loss", "#b54336", "validation documents", 280)):
        points = " ".join(f'{x(row["completed_updates"]):.2f},{y(row[key]):.2f}' for row in rows)
        pieces += [f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="2"/>',
                   f'<text x="{label_x}" y="380" fill="{color}">{escape(label)}</text>']
    pieces += [f'<text x="65" y="350">0</text><text x="680" y="350">{last_step}</text>',
               '<text x="290" y="350">completed parameter updates</text>', '</g></svg>']
    destination.write_text("\n".join(pieces), encoding="utf-8")


def main():
    configure_console()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--steps", type=int, default=200)
    parser.add_argument("--eval-every", type=int, default=20)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--learning-rate", type=float, default=0.003)
    parser.add_argument("--heads", type=int, default=4)
    parser.add_argument("--layers", type=int, default=2)
    parser.add_argument("--output", type=Path, default=Path("runs/first"))
    parser.add_argument("--generate-only", type=Path)
    parser.add_argument("--prompt", default="a ")
    parser.add_argument("--new-tokens", type=int, default=80)
    args = parser.parse_args()
    torch.set_num_threads(1)
    torch.manual_seed(args.seed)
    if args.generate_only:
        model, codec = load_inference(args.generate_only)
        print(sample(model, codec, args.prompt, args.new_tokens))
        return
    if args.steps < 1 or args.eval_every < 1 or not math.isfinite(args.learning_rate) or args.learning_rate <= 0:
        raise ValueError("steps, eval interval and learning rate must be positive")
    config = GPTConfig(vocab_size=len(DOCUMENT_TOKENIZER.tokens), block_size=24,
                       n_embd=32, n_head=args.heads, n_layer=args.layers)
    config.validate()
    train_docs, val_docs = read_documents("train"), read_documents("validation")
    data_report = describe_data(train_docs, val_docs, config.block_size)
    train_x, train_y = make_windows([text for _, text in train_docs], DOCUMENT_TOKENIZER, 24, stride=24)
    val_x, val_y = make_windows([text for _, text in val_docs], DOCUMENT_TOKENIZER, 24, stride=24)
    train_x, train_y, val_x, val_y = map(torch.tensor, (train_x, train_y, val_x, val_y))
    # Fail rather than overwrite a previous experiment or checkpoint.
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / "data_report.json").write_text(json.dumps(data_report, ensure_ascii=False, indent=2), encoding="utf-8")
    model = MiniGPT(config)  # same class as Week 10, explicitly a new configuration
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=0.01)
    sampling_rng = random.Random(args.seed)  # evaluation never consumes this stream
    rows = []

    def record(step):
        train_loss, train_count = evaluate(model, train_x, train_y)
        validation_loss, val_count = evaluate(model, val_x, val_y)
        row = dict(completed_updates=step, train_eval_loss=train_loss, validation_loss=validation_loss,
                   train_effective_targets=train_count, validation_effective_targets=val_count)
        rows.append(row)
        # Preserve completed observations if a later update fails.
        with (args.output / "loss.csv").open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=list(row))
            writer.writeheader()
            writer.writerows(rows)
        print(row, flush=True)

    settings = dict(format=FORMAT, config=asdict(config), seed=args.seed, steps=args.steps,
                    eval_every=args.eval_every, learning_rate=args.learning_rate, batch_size=4,
                    weight_decay=0.01, clip_norm=1.0, stride=24, device="cpu", dtype="float32",
                    python=platform.python_version(), torch=torch.__version__,
                    tokenizer=asdict(DOCUMENT_TOKENIZER), tie_weights=False,
                    measurement="All fixed train/validation windows in eval/no_grad; no dropout; mean CE per effective target")
    (args.output / "config.json").write_text(json.dumps(settings, ensure_ascii=False, indent=2), encoding="utf-8")
    record(0)
    model.train()
    for step in range(1, args.steps + 1):
        selected = [sampling_rng.randrange(len(train_x)) for _ in range(4)]
        optimizer.zero_grad(set_to_none=True)
        _, loss = model(train_x[selected], train_y[selected])
        if loss is None or not torch.isfinite(loss):
            raise ValueError(f"Non-finite training loss before update {step}; stopped")
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0, error_if_nonfinite=True)
        optimizer.step()
        if step % args.eval_every == 0 or step == args.steps:
            record(step)
    chart(rows, args.output / "loss.svg")
    checkpoint = args.output / "inference.pt"
    torch.save(dict(format=FORMAT, config=asdict(config), tokenizer=asdict(DOCUMENT_TOKENIZER),
                    tie_weights=False, model_state=model.state_dict()), checkpoint)
    restored, codec = load_inference(checkpoint)
    model.eval()
    with torch.no_grad():
        reference, _ = model(val_x[:1])
        reloaded, _ = restored(val_x[:1])
    max_difference = (reference - reloaded).abs().max().item()
    if not torch.allclose(reference, reloaded, atol=1e-6, rtol=1e-5):
        raise ValueError(f"Inference reload differs by {max_difference}")
    prompts = ("a ", "the ", "learning ")
    samples = [{"prompt": prompt, "generated": sample(restored, codec, prompt, 80)} for prompt in prompts]
    (args.output / "samples.json").write_text(json.dumps(samples, indent=2), encoding="utf-8")
    note = (f"# 实验记录\n\n实际完成 {args.steps} 次更新；CPU，seed={args.seed}。\n\n"
            f"训练集 eval loss：{rows[0]['train_eval_loss']:.6f} → {rows[-1]['train_eval_loss']:.6f}。\n\n"
            f"验证集 loss：{rows[0]['validation_loss']:.6f} → {rows[-1]['validation_loss']:.6f}。\n\n"
            f"保存/加载后同一输入 logits 最大差：{max_difference:.9g}。仅验证推理恢复，不是精确续训。\n\n"
            "图来自 loss.csv，不是模拟曲线。文档少且同一文风，结果不代表真实语言能力。\n\n"
            "## 请学习者补写\n\n- 运行前预测：\n- 观察与预期的差别：\n- 三条生成样例有哪些局限：\n- 下一次只改变什么：\n")
    (args.output / "experiment_record.md").write_text(note, encoding="utf-8")
    print("Saved actual observations to", args.output.resolve())


if __name__ == "__main__":
    main()
