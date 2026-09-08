"""Week 11: plain Python arithmetic for two supplied gradients, not training logs."""
import math


def main():
    theta, m, v = 1.0, 0.0, 0.0
    lr, decay, beta1, beta2, eps = 0.01, 0.1, 0.9, 0.999, 1e-8
    for step, gradient in enumerate((2.0, 4.0), start=1):
        m = beta1 * m + (1 - beta1) * gradient
        v = beta2 * v + (1 - beta2) * gradient * gradient
        corrected_m, corrected_v = m / (1 - beta1 ** step), v / (1 - beta2 ** step)
        shrink = lr * decay * theta
        adaptive = lr * corrected_m / (math.sqrt(corrected_v) + eps)
        theta = theta - shrink - adaptive
        print(dict(step=step, supplied_gradient=gradient, m=m, v=v,
                   corrected_m=corrected_m, corrected_v=corrected_v,
                   decay_change=shrink, adaptive_change=adaptive, new_parameter=theta))
    print("zero_grad clears gradients, not the optimizer's m/v history.")


if __name__ == "__main__":
    main()
