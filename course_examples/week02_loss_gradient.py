"""Week 2: actual loss perturbations and learning-rate comparison; no dependencies."""
import math

X, Y = [1, 2, 3, 4], [3, 5, 7, 9]


def statistics(w, b):
    errors = [w * x + b - y for x, y in zip(X, Y)]
    n = len(X)
    return (sum(error * error for error in errors) / n,
            sum(2 * error * x for error, x in zip(errors, X)) / n,
            sum(2 * error for error in errors) / n)


def main():
    single_loss = lambda w: (2 * w - 5) ** 2
    print("L(1), L(1.001):", single_loss(1), single_loss(1.001))
    print("forward difference, b fixed:", (single_loss(1.001) - single_loss(1)) / 0.001)
    print("one full-batch step: old loss,dw,db =", statistics(0, 0))
    print("new w,b,loss =", 0.35, 0.12, statistics(0.35, 0.12)[0])
    for lr in (0.0001, 0.01, 0.2):
        w, b = 0.0, 0.0
        diverged = False
        print("learning_rate,completed_updates,loss_at_current_parameters,w,b")
        for step in range(1001):
            loss, dw, db = statistics(w, b)
            if not all(math.isfinite(value) for value in (loss, dw, db, w, b)):
                print(lr, step, "NON_FINITE; stopped, no points hidden")
                diverged = True
                break
            if step in (0, 1, 2, 10, 100, 500, 1000):
                print(lr, step, loss, w, b)
            if step < 1000:
                # Both gradients belong to the same old parameters.
                w, b = w - lr * dw, b - lr * db
        if not diverged:
            print("prediction at unseen x=5:", 5 * w + b)
    print("Exact linear toy data is not a guarantee of performance on noisy real data.")


if __name__ == "__main__":
    main()
