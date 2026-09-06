"""Weeks 2/5: 相同数据、初始值、平均损失与步长，三种写法做同一步更新。"""
import math
import torch


def main():
    xs, ys = [1.0, 2.0, 3.0, 4.0], [3.0, 5.0, 7.0, 9.0]
    errors = [0.0 - y for y in ys]
    loss_python = sum(e * e for e in errors) / 4
    dw = sum(2 * e * x for e, x in zip(errors, xs)) / 4
    db = sum(2 * e for e in errors) / 4
    hand = (-0.01 * dw, -0.01 * db)
    assert (loss_python, dw, db) == (41.0, -35.0, -12.0)

    x = torch.tensor(xs, dtype=torch.float64).reshape(4, 1)
    y = torch.tensor(ys, dtype=torch.float64).reshape(4, 1)
    w = torch.tensor(0.0, dtype=torch.float64, requires_grad=True)
    b = torch.tensor(0.0, dtype=torch.float64, requires_grad=True)
    loss = ((x * w + b - y) ** 2).mean()
    loss.backward()
    assert w.grad.item() == dw and b.grad.item() == db
    with torch.no_grad():
        w -= 0.01 * w.grad
        b -= 0.01 * b.grad

    model = torch.nn.Linear(1, 1, dtype=torch.float64)
    with torch.no_grad():
        model.weight.zero_()
        model.bias.zero_()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
    optimizer.zero_grad(set_to_none=True)
    prediction = model(x)
    assert prediction.shape == y.shape
    loss_module = torch.nn.functional.mse_loss(prediction, y)
    loss_module.backward()
    optimizer.step()
    for values in [(w.item(), b.item()), (model.weight.item(), model.bias.item())]:
        assert all(math.isclose(a, expected) for a, expected in zip(values, hand))
    with torch.no_grad():
        after = torch.nn.functional.mse_loss(model(x), y).item()
    assert math.isclose(after, 28.45315)
    print("all_three_first_updates=", hand, "loss_before=41", "loss_after=", after)
    print("wrong_broadcast_shape=", tuple((prediction - y.flatten()).shape))
    print("correct_error_shape=", tuple((prediction - y).shape))


if __name__ == "__main__":
    main()

