"""Week 8: retain Week 7 data, then make each Pre-Norm branch visible."""
import torch
from week07_attention import fixed_example, attend


def main():
    torch.set_printoptions(precision=6, sci_mode=False)
    x, wq, wk, wv = fixed_example()
    head, _ = attend(x, wq, wk, wv)
    print("same Week 7 final rows:", head[:, -1])
    # One head returns 2 features; project back to C=4 before a residual add.
    wo = torch.tensor([[1., 0., 0., 0.], [0., 1., 0., 0.]], dtype=x.dtype)
    norm = lambda value: torch.nn.functional.layer_norm(value, (4,), eps=1e-5)
    normalized = norm(x)
    branch_head, _ = attend(normalized, wq, wk, wv)
    attention_update = branch_head @ wo
    after_attention = x + attention_update
    normalized_for_ffn = norm(after_attention)
    w1, w2 = torch.zeros(4, 16, dtype=x.dtype), torch.zeros(16, 4, dtype=x.dtype)
    w1[:, :4] = torch.eye(4, dtype=x.dtype)
    w2[:4] = 0.25 * torch.eye(4, dtype=x.dtype)
    ffn_update = torch.nn.functional.gelu(normalized_for_ffn @ w1) @ w2
    output = after_attention + ffn_update
    for name, value in (("raw residual x", x), ("LN1(x)", normalized),
                        ("attention update", attention_update), ("after attention", after_attention),
                        ("LN2(after attention)", normalized_for_ffn), ("ffn update", ffn_update),
                        ("block output", output)):
        print(name, tuple(value.shape), "final rows:", value[:, -1])
    z = torch.tensor([1., 2., 0., 0.], dtype=x.dtype)
    before = torch.nn.functional.gelu(z @ w1) @ w2
    w1[1, 0] = 1.0
    after = torch.nn.functional.gelu(z @ w1) @ w2
    print("FFN control experiment: change only W1[1,0]", before, after)
    row = torch.tensor([1., 2., 3., 4.], dtype=x.dtype)
    print("LayerNorm scale experiment", norm(row), norm(100 * row + 1000))
    print("This is a one-head bridge. The chapter's full two-head table uses its stated separate projections.")


if __name__ == "__main__":
    main()
