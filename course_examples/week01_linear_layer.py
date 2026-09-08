"""Week 1: one set of parameters, two samples and two outputs. Standard Python."""
X = [[1, 2], [3, 4]]
W = [[0.5, -0.3], [0.4, 0.8]]  # mathematical [in,out]
b = [0.1, -0.2]


def predict(row):
    if len(row) != len(W):
        raise ValueError("Feature count and weight rows must match")
    return [sum(row[i] * W[i][j] for i in range(len(row))) + b[j]
            for j in range(len(b))]


def main():
    print("one sample, both outputs:", predict(X[0]))
    print("batch:", [predict(row) for row in X])
    print("swapped feature order:", predict([2, 1]))
    print("zero input makes bias visible:", predict([0, 0]))


if __name__ == "__main__":
    main()
