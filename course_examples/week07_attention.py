"""Week 7 fixed numbers, then one query-parameter update. Imports have no effects."""
import math
import torch


def fixed_example():
    x = torch.tensor([[[1., 0., 0., 0.], [0., 1., 0., 0.]],
                      [[0., 0., 1., 0.], [0., 1., 0., 0.]]], dtype=torch.float64)
    wq = torch.tensor([[.5, .5], [1., 1.], [-.5, .5], [0., 0.]], dtype=x.dtype)
    wk = torch.tensor([[.8, 0.], [.2, .2], [0., .1], [0., 0.]], dtype=x.dtype) * math.sqrt(2)
    wv = torch.tensor([[1., 0.], [0., 1.], [-1., 0.], [0., 0.]], dtype=x.dtype)
    return x, wq, wk, wv


def attend(x, wq, wk, wv):
    query, key, value = x @ wq, x @ wk, x @ wv
    scores = query @ key.transpose(-2, -1) / math.sqrt(query.shape[-1])
    allowed = torch.ones(x.shape[1], x.shape[1], dtype=torch.bool, device=x.device).tril()
    masked = scores.masked_fill(~allowed, float("-inf"))
    weights = masked.softmax(dim=-1)
    return weights @ value, (query, key, value, scores, masked, weights)


def main():
    torch.set_printoptions(precision=6, sci_mode=False)
    x, wq, wk, wv = fixed_example()
    wq.requires_grad_()
    output, values = attend(x, wq, wk, wv)
    for name, value in zip(("Q", "K", "Value", "scores", "masked scores", "weights before dropout"), values):
        print(name, value.detach())
    print("head outputs", output.detach())
    # A deliberately small, fixed [2,5] output layer; not the full GPT head.
    scoring = torch.tensor([[0., 1., 2., -1., 0.], [0., 0., 0., 1., 0.]], dtype=x.dtype)
    targets = torch.tensor([2, 0], dtype=torch.long)  # AI after 我喜欢; 我 after 猫喜欢
    logits = output[:, -1] @ scoring
    loss = torch.nn.functional.cross_entropy(logits, targets)
    loss.backward()
    print("vocabulary probabilities", logits.detach().softmax(dim=-1))
    print("mean loss", loss.item(), "dL/dWq[1,0]", wq.grad[1, 0].item())
    with torch.no_grad():
        # Change only one element, to isolate the effect discussed in the lesson.
        wq[1, 0] -= 0.01 * wq.grad[1, 0]
        changed, _ = attend(x, wq, wk, wv)
        new_logits = changed[:, -1] @ scoring
        print("new query parameter", wq[1, 0].item())
        print("new probabilities", new_logits.softmax(dim=-1))
        print("new loss", torch.nn.functional.cross_entropy(new_logits, targets).item())
    print("One scalar update illustrates the dependency; this is not a trained language model.")


if __name__ == "__main__":
    main()
