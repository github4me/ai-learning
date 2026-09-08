# week12_end_to_end.py
# This file is a caller. It reuses, rather than redefines, Week 10/11 APIs.
from __future__ import annotations

from pathlib import Path

import torch
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, configure_console

from mini_gpt_walkthrough import (
    GPTConfig,
    MiniGPT,
    save_mini_gpt_training_checkpoint,
)
from week11_training_and_generation import (
    CANONICAL_ORDERED_TOKENS,
    CANONICAL_TOKENIZER_POLICY,
    CANONICAL_TOKENIZER_VERSION,
    generate_mini_gpt_sampled,
    load_mini_gpt_training_resume,
    train_mini_gpt_step,
    validate_mini_gpt_adamw_completed_updates,
)


RAW_TEXTS = DEMO_DOCUMENTS
EXPECTED_RAW_IDS = (
    (0, 1, 2),  # 我 喜欢 AI
    (4, 1, 0),  # 猫 喜欢 我
    (0, 3, 2),  # 我 学习 AI
)
FROZEN_STOI = {
    token: token_id
    for token_id, token in enumerate(CANONICAL_ORDERED_TOKENS)
}
assert CANONICAL_ORDERED_TOKENS == FIVE_WORD_TOKENIZER.tokens
assert CANONICAL_TOKENIZER_POLICY == (
    "whitespace-delimited;no-specials;no-pad;no-unk"
)


def encode_mini_gpt_v1(text: str) -> list[int]:
    ids = FIVE_WORD_TOKENIZER.encode(text)
    if not ids:
        raise ValueError("mini-gpt-v1 text must contain a token")
    return ids


def make_fixed_batch(device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    encoded_rows = [encode_mini_gpt_v1(text) for text in RAW_TEXTS]
    assert tuple(tuple(row) for row in encoded_rows) == EXPECTED_RAW_IDS
    raw = torch.tensor(encoded_rows, dtype=torch.long, device=device)  # [3,3]
    inputs = raw[:, :-1]   # [3,2]
    targets = raw[:, 1:]   # [3,2]
    return inputs, targets


def main() -> None:
    configure_console()
    # 极小 CPU 教学模型用单线程，减少线程调度开销。
    torch.set_num_threads(1)
    seed = 7
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = MiniGPT(GPTConfig()).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-2,
    )
    inputs, targets = make_fixed_batch(device)
    assert inputs.shape == targets.shape == (3, 2)

    # Observe the labelled [我,喜欢] -> AI row before any update.
    model.eval()
    with torch.no_grad():
        before_logits, _ = model(inputs)
        before_probs = torch.softmax(before_logits[0, 1, :], dim=-1)  # [5]

    initial_parameters = [p.detach().clone() for p in model.parameters()]
    with torch.no_grad():
        _, initial_loss = model(inputs, targets)
    completed_updates = 0
    for _ in range(100):
        loss, grad_norm, completed_updates = train_mini_gpt_step(
            model,
            optimizer,
            inputs,
            targets,
            device,
            completed_updates=completed_updates,
        )
        assert torch.isfinite(loss) and torch.isfinite(grad_norm)
    assert completed_updates == 100
    assert any(not torch.equal(old, new)
               for old, new in zip(initial_parameters, model.parameters()))
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    model.eval()
    with torch.no_grad():
        reference_logits, reference_loss = model(inputs, targets)
    assert reference_logits.shape == (3, 2, 5)
    assert reference_loss is not None and reference_loss.ndim == 0
    after_probs = torch.softmax(reference_logits[0, 1, :], dim=-1)  # [5]
    print("parameters=", sum(p.numel() for p in model.parameters()))
    print("completed_updates=", completed_updates)
    print("same_batch_loss_before=", initial_loss.item())
    print("same_batch_loss_after=", reference_loss.item())
    print("observed context=[我,喜欢], target=AI")
    print("vocabulary_order=", CANONICAL_ORDERED_TOKENS)
    print("before_probs=", before_probs.detach().cpu().tolist())
    print("after_probs=", after_probs.detach().cpu().tolist())

    path = Path("mini-gpt-training.pt")
    save_mini_gpt_training_checkpoint(
        str(path),
        model=model,
        optimizer=optimizer,
        completed_updates=completed_updates,
        ordered_tokens=CANONICAL_ORDERED_TOKENS,
        tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    restored, restored_optimizer, restored_updates = (
        load_mini_gpt_training_resume(str(path), device=device)
    )
    assert restored_updates == completed_updates
    validate_mini_gpt_adamw_completed_updates(
        restored,
        restored_optimizer,
        restored_updates,
    )

    restored.eval()
    with torch.no_grad():
        restored_logits, _ = restored(inputs)
    torch.testing.assert_close(restored_logits, reference_logits)
    print("checkpoint_round_trip=PASS")

    prompt = torch.tensor(
        [[FROZEN_STOI["我"], FROZEN_STOI["喜欢"]]],
        dtype=torch.long,
        device=device,
    )
    generated_history = generate_mini_gpt_sampled(
        restored,
        prompt,
        max_new_tokens=3,
        temperature=0.8,
        top_k=3,
    )
    assert generated_history.shape == (1, 5)
    print("generated_ids=", generated_history[0].tolist())
    print("generated_text=", " ".join(
        CANONICAL_ORDERED_TOKENS[i] for i in generated_history[0].tolist()))
    print("以上是固定三句数据的机制演示，不是 held-out 泛化评测。")


if __name__ == "__main__":
    main()
