"""Weeks 6/7/8: 先用数字复现概率、标签冲突和规范化，不需要背微积分。"""
import math
import torch
import torch.nn.functional as F


def main():
    logits = torch.tensor([[0., 2., 1., -1., 0.]], dtype=torch.float64, requires_grad=True)
    target = torch.tensor([1], dtype=torch.long)
    probabilities = torch.softmax(logits, dim=-1)
    loss = F.cross_entropy(logits, target)
    loss.backward()
    expected_grad = probabilities.detach() - F.one_hot(target, 5)
    torch.testing.assert_close(logits.grad, expected_grad)
    torch.testing.assert_close(probabilities, torch.softmax(logits.detach() + 100., dim=-1))
    soft_target_loss = F.cross_entropy(logits.detach(), F.one_hot(target, 5).double())
    torch.testing.assert_close(soft_target_loss, loss.detach())
    print("token_order=[我,喜欢,AI,学习,猫]")
    print("probabilities=", probabilities.detach().tolist()[0])
    print("single_target_loss=", loss.item())
    print("logits_gradient=", logits.grad.tolist()[0])
    print("uniform_reference=", math.log(5))
    print("bigram_data_lower_bound=", 4 * math.log(2) / 6)
    print("contextual_data_lower_bound=", 2 * math.log(2) / 6)
    row = torch.tensor([1., 2., 3., 4.], dtype=torch.float64)
    mean = row.mean()
    variance = ((row - mean) ** 2).mean()  # 除以 C=4，不是 C-1。
    eps = 1e-5
    normalized = (row - mean) / torch.sqrt(variance + eps)
    torch.testing.assert_close(normalized, F.layer_norm(row, (4,), eps=eps))
    print("layernorm_mean=", mean.item(), "variance=", variance.item())
    print("normalized_with_eps=", normalized.tolist())
    # 一个 XOR 网络：验证表达能力，权重是手工设置的，并没有训练。
    outputs = []
    for x1, x2 in [(0, 0), (0, 1), (1, 0), (1, 1)]:
        h1, h2 = max(0, x1 + x2), max(0, x1 + x2 - 1)
        outputs.append(h1 - 2 * h2)
    assert outputs == [0, 1, 1, 0]
    print("xor=", outputs)


if __name__ == "__main__":
    main()

