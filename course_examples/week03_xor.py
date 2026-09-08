"""Week 3: given weights demonstrate expressiveness, not a successful training run."""
def xor_network(x1, x2, nonlinear=True):
    activation = (lambda z: max(0, z)) if nonlinear else (lambda z: z)
    h1 = activation(x1 + x2)
    h2 = activation(x1 + x2 - 1)
    return h1, h2, h1 - 2 * h2


if __name__ == "__main__":
    print("x1,x2,h1,h2,prediction,without_relu")
    for x1, x2 in ((0, 0), (0, 1), (1, 0), (1, 1)):
        print(x1, x2, *xor_network(x1, x2), xor_network(x1, x2, False)[-1])
    print("Without ReLU: (x1+x2)-2*(x1+x2-1) = 2-x1-x2")
