"""Week 3: 隐藏层 ReLU，回归输出保持线性。无需第三方依赖。"""
import math

def relu(x):
    return max(0, x)


def neuron(inputs, weights, bias, activation=relu):
    if len(inputs) != len(weights):
        raise ValueError("每项输入必须有一个对应权重")
    total = sum(x * w for x, w in zip(inputs, weights)) + bias
    return total if activation is None else activation(total)


def layer(inputs, weights, biases, activation=relu):
    if len(weights) != len(biases):
        raise ValueError("每个输出神经元必须有一个偏置")
    return [neuron(inputs, row, bias, activation)
            for row, bias in zip(weights, biases)]

if __name__ == "__main__":
    hidden = layer([1, 2], [[0.5, 0.4], [-0.3, 0.8]], [0.1, -0.2])
    prediction = layer(hidden, [[0.7, 0.2]], [0.1], activation=None)
    negative = layer(hidden, [[-1.0, 0.0]], [0.0], activation=None)
    assert math.isclose(prediction[0], 1.3)
    assert math.isclose(negative[0], -1.4)
    print("hidden=", hidden, "prediction=", prediction, "negative=", negative)

