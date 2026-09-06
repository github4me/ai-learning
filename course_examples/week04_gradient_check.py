"""Week 4: 用不依赖求导规则的中央差分核对四个手算梯度。"""
import math


def loss(parameters):
    w1, b1, w2, b2 = parameters
    hidden = max(0.0, w1 * 2.0 + b1)
    prediction = w2 * hidden + b2
    return (prediction - 5.0) ** 2


def central_difference(parameters, epsilon=1e-5):
    gradients = []
    for index in range(len(parameters)):
        plus, minus = list(parameters), list(parameters)
        plus[index] += epsilon
        minus[index] -= epsilon
        gradients.append((loss(plus) - loss(minus)) / (2 * epsilon))
    return gradients


def main():
    old = [1.0, 0.0, 1.0, 0.0]  # w1, b1, w2, b2；隐藏 pre-activation=2，避开 ReLU 折点。
    analytical = [-12.0, -6.0, -12.0, -6.0]
    numerical = central_difference(old)
    for actual, expected in zip(numerical, analytical):
        assert math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-6)
    new = [value - 0.01 * gradient for value, gradient in zip(old, analytical)]
    assert math.isclose(loss(old), 9.0)
    assert math.isclose(loss(new), 5.588496)
    print("hand_gradients=", analytical)
    print("finite_difference=", numerical)
    print("new_parameters=", new, "new_loss=", loss(new))


if __name__ == "__main__":
    main()

