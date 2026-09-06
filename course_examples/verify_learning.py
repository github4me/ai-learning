"""核对课程的数值和行为；不评估语言质量。"""
import copy
import json
import math
from pathlib import Path
import tempfile
import torch
from mini_gpt_walkthrough import GPTConfig, MiniGPT, save_mini_gpt_training_checkpoint
from week11_training_and_generation import (
    CANONICAL_ORDERED_TOKENS, CANONICAL_TOKENIZER_POLICY, CANONICAL_TOKENIZER_VERSION,
    evaluate_mini_gpt_loss, generate_mini_gpt_sampled, load_mini_gpt_training_resume,
    sample_mini_gpt_next_id, train_mini_gpt_epoch, train_mini_gpt_step,
)
from week12_end_to_end import make_fixed_batch
from week04_gradient_check import main as check_derivative
from week05_three_ways import main as check_regression
from week06_probability import main as check_probability
import w09_readable_v1 as readable


def must_raise(kind, action):
    try:
        action()
    except kind:
        return
    raise AssertionError(f"expected {kind.__name__}")


def main():
    torch.set_num_threads(1)
    check_derivative()
    check_regression()
    check_probability()
    torch.manual_seed(7)
    device = torch.device('cpu')
    model = MiniGPT(GPTConfig())
    inputs, targets = make_fixed_batch(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-2, weight_decay=1e-2)
    _, initial = model(inputs, targets)
    updates = 0
    for _ in range(800):
        _, _, updates = train_mini_gpt_step(model, optimizer, inputs, targets, device,
                                           completed_updates=updates)
    model.eval()
    with torch.no_grad():
        logits, final = model(inputs, targets)
        perturbed, _ = model(torch.tensor([[0, 1], [0, 4]]))
        separate = torch.cat([model(row[None])[0] for row in inputs])
    assert final.item() < initial.item() - 0.5
    assert final.item() >= math.log(2) / 3 - 1e-5
    torch.testing.assert_close(logits[0, 0], logits[2, 0])
    torch.testing.assert_close(perturbed[0, 0], perturbed[1, 0])
    torch.testing.assert_close(logits, separate)
    varied = MiniGPT(GPTConfig(block_size=3))
    with torch.no_grad():
        actual, _ = varied(torch.tensor([[0, 1, 2]]))
    assert actual.shape == (1, 3, 5)
    must_raise(ValueError, lambda: model(torch.tensor([[0, 1, 2]])))
    must_raise(TypeError, lambda: model(torch.tensor([[0., 1.]])))
    must_raise(ValueError, lambda: model(torch.empty((1, 0), dtype=torch.long)))
    must_raise(ValueError, lambda: model(torch.tensor([[0, 5]])))
    model.train()
    before = copy.deepcopy(model.state_dict())
    whole = evaluate_mini_gpt_loss(model, [(inputs, targets)], device)
    split = evaluate_mini_gpt_loss(model, [(inputs[:1], targets[:1]), (inputs[1:], targets[1:])], device)
    assert math.isclose(whole, split, rel_tol=1e-6, abs_tol=1e-6)
    assert model.training
    for key, old in before.items():
        torch.testing.assert_close(model.state_dict()[key], old)
    model.eval()
    old_grads = [None if p.grad is None else p.grad.clone() for p in model.parameters()]
    must_raise(ValueError, lambda: train_mini_gpt_epoch(model, optimizer,
        [(inputs, targets)] * 3, device, accumulation_steps=2, completed_updates=updates))
    assert not model.training
    for old, parameter in zip(old_grads, model.parameters()):
        if old is None:
            assert parameter.grad is None
        else:
            torch.testing.assert_close(old, parameter.grad)
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / 'roundtrip.pt'
        save_mini_gpt_training_checkpoint(str(path), model=model, optimizer=optimizer,
            completed_updates=updates, ordered_tokens=CANONICAL_ORDERED_TOKENS,
            tokenizer_policy=CANONICAL_TOKENIZER_POLICY, tokenizer_version=CANONICAL_TOKENIZER_VERSION)
        restored, restored_opt, restored_count = load_mini_gpt_training_resume(str(path), device=device)
        assert restored_count == updates
        train_mini_gpt_step(model, optimizer, inputs, targets, device, completed_updates=updates)
        train_mini_gpt_step(restored, restored_opt, inputs, targets, device, completed_updates=restored_count)
        for key, value in model.state_dict().items():
            torch.testing.assert_close(value, restored.state_dict()[key], rtol=0, atol=0)
        corrupted = torch.load(path, weights_only=False)
        corrupted['tokenizer']['ordered_tokens'][0:2] = ['喜欢', '我']
        torch.save(corrupted, path)
        must_raise(ValueError, lambda: load_mini_gpt_training_resume(str(path), device=device))
    before = copy.deepcopy(model.state_dict())
    history = torch.tensor([[0, 1, 2]])
    generated = generate_mini_gpt_sampled(model, history, 4, temperature=0.8, top_k=3)
    assert generated.shape == (1, 7) and generated.dtype == torch.long
    torch.testing.assert_close(generated[:, :3], history)
    for key, value in before.items():
        torch.testing.assert_close(model.state_dict()[key], value)
    z = torch.tensor([[0., 2., 1., -1., -0.5]])
    assert sample_mini_gpt_next_id(z, top_k=1).item() == 1
    must_raise(ValueError, lambda: sample_mini_gpt_next_id(z, temperature=0))
    must_raise(ValueError, lambda: sample_mini_gpt_next_id(z, top_k=0))
    text = '我喜欢AI，AI也喜欢猫。'
    ids = readable.encode_document(text)
    assert ids == [0, 4, 5, 6, 7, 6, 8, 5, 9, 10, 1]
    assert readable.W09_READABLE_V1.decode(ids, skip_special_tokens=True) == text
    assert len(text) == 13 and len(text.encode('utf-8')) == 31
    report = dict(status='PASS', torch=torch.__version__, device='cpu', parameters=520,
                  updates=updates, before_loss=initial.item(), after_loss=final.item(),
                  theoretical_data_lower_bound=math.log(2)/3)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

