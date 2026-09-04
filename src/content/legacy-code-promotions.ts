import type { ContentBlock, Course, CourseUnit, SectionNode } from './schema';

type CodePromotion = {
  sectionId: string;
  blockIds: readonly string[];
  code: string;
};

const python = String.raw;

const CODE_PROMOTIONS: readonly CodePromotion[] = [
  {
    sectionId: 'o0006-2-scalar',
    blockIds: ['body-00061', 'body-00062', 'body-00063'],
    code: python`price = 800000
temperature = 22.5
loss = 0.18`,
  },
  {
    sectionId: 'o0007-3-vector',
    blockIds: ['body-00076'],
    code: python`x = [100, 3, 8]`,
  },
  {
    sectionId: 'o0013-6-dot-product',
    blockIds: [
      'body-00141',
      'body-00142',
      'body-00143',
      'body-00144',
      'body-00145',
      'body-00146',
    ],
    code: python`x = [0.8, 0.6, 0.2]
w = [0.7, 0.5, -0.4]
score = 0.0

for input_value, weight in zip(x, w):
    score += input_value * weight

print(score)  # 0.78`,
  },
  {
    sectionId: 'o0015-7-bias',
    blockIds: ['body-00160', 'body-00161'],
    code: python`bias = 0.1
z = score + bias`,
  },
  {
    sectionId: 'o0017-8-function',
    blockIds: ['body-00168', 'body-00169'],
    code: python`def f(x):
    return 2 * x + 1`,
  },
  {
    sectionId: 'o0017-8-function',
    blockIds: ['body-00171', 'body-00172'],
    code: python`def model(x, w, b):
    return w * x + b`,
  },
  {
    sectionId: 'o0026-12',
    blockIds: ['body-00227', 'body-00228', 'body-00229'],
    code: python`total = 0
for i in range(3):
    total += w[i] * x[i]`,
  },
  {
    sectionId: 'o0034-14-ai',
    blockIds: ['body-00253', 'body-00254', 'body-00255', 'body-00256'],
    code: python`# Shape trace
# x: [batch, input_features]
# W: [input_features, neurons]
# b: [neurons]
# z: [batch, neurons]`,
  },
  {
    sectionId: 'o0034-14-ai',
    blockIds: ['body-00258'],
    code: python`z = x @ W + b`,
  },
  {
    sectionId: 'o0035-15-week-1-python',
    blockIds: [
      'body-00262',
      'body-00263',
      'body-00264',
      'body-00265',
      'body-00266',
      'body-00267',
      'body-00268',
      'body-00269',
      'body-00270',
      'body-00271',
      'body-00272',
      'body-00273',
      'body-00274',
    ],
    code: python`inputs = [0.8, 0.6, 0.2]
weights = [
    [0.7, 0.5, -0.4],
    [0.2, -0.1, 0.8],
]
biases = [0.1, -0.2]
outputs = []

for neuron_weights, bias in zip(weights, biases):
    z = bias
    for x, w in zip(inputs, neuron_weights):
        z += x * w
    outputs.append(z)

print(outputs)`,
  },
  {
    sectionId: 'o0037-17',
    blockIds: ['body-00297'],
    code: python`z = 0.5 * 2 + (-0.2) * 3 + 0.1`,
  },
  {
    sectionId: 'o0060-17-python',
    blockIds: [
      'body-00485',
      'body-00486',
      'body-00487',
      'body-00488',
      'body-00489',
      'body-00490',
      'body-00491',
      'body-00492',
      'body-00493',
      'body-00494',
      'body-00495',
      'body-00496',
      'body-00497',
      'body-00498',
      'body-00499',
      'body-00500',
      'body-00501',
      'body-00502',
      'body-00503',
      'body-00504',
      'body-00505',
      'body-00506',
      'body-00507',
      'body-00508',
      'body-00509',
      'body-00510',
      'body-00511',
      'body-00512',
      'body-00513',
    ],
    code: python`x_data = [1, 2, 3, 4]
y_data = [3, 5, 7, 9]
w = 0.0
b = 0.0
learning_rate = 0.01

for epoch in range(1000):
    dw = 0.0
    db = 0.0
    loss = 0.0
    n = len(x_data)

    for x, y in zip(x_data, y_data):
        # Forward pass
        prediction = w * x + b
        # Error
        error = prediction - y
        # Squared error
        loss += error**2
        # Gradients
        dw += 2 * error * x
        db += 2 * error

    # MSE / mean gradients
    loss /= n
    dw /= n
    db /= n

    # Gradient descent
    w -= learning_rate * dw
    b -= learning_rate * db

print('w:', w)
print('b:', b)`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00519'],
    code: python`prediction = w * x + b`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00522'],
    code: python`error = prediction - y`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00525'],
    code: python`loss += error**2`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00529'],
    code: python`dw += 2 * error * x`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00532'],
    code: python`db += 2 * error`,
  },
  {
    sectionId: 'o0061-18',
    blockIds: ['body-00535', 'body-00536'],
    code: python`w -= learning_rate * dw
b -= learning_rate * db`,
  },
  {
    sectionId: 'o0063-20-epoch-batch',
    blockIds: ['body-00556'],
    code: python`for epoch in range(1000):
    # Use the training data once per epoch.
    ...`,
  },
  {
    sectionId: 'o0068-25-mental-model',
    blockIds: [
      'body-00676',
      'body-00677',
      'body-00678',
      'body-00679',
      'body-00680',
    ],
    code: python`while training:
    prediction = model(input, parameters)
    loss = calculate_loss(prediction, actual)
    gradients = calculate_gradients(loss, parameters)
    parameters -= learning_rate * gradients`,
  },
  {
    sectionId: 'o0093-relu',
    blockIds: ['body-00917', 'body-00918'],
    code: python`def relu(x):
    return max(0, x)`,
  },
  {
    sectionId: 'o0101-19-layer-neurons',
    blockIds: ['body-01033', 'body-01034'],
    code: python`if has_whiskers and has_ears:
    return "cat"`,
  },
  {
    sectionId: 'o0119-32-backprop-computational-graph',
    blockIds: ['body-01258', 'body-01259'],
    code: python`z = x * w
y = z + 1`,
  },
  {
    sectionId: 'o0127-36-matrix',
    blockIds: ['body-01320', 'body-01321', 'body-01322', 'body-01323'],
    code: python`for neuron in neurons:
    result = 0
    for input_value, weight in zip(inputs, neuron.weights):
        result += input_value * weight`,
  },
  {
    sectionId: 'o0128-37-python-neuron',
    blockIds: [
      'body-01328',
      'body-01329',
      'body-01330',
      'body-01331',
      'body-01332',
      'body-01333',
      'body-01334',
      'body-01335',
      'body-01336',
      'body-01337',
      'body-01338',
      'body-01339',
      'body-01340',
    ],
    code: python`def relu(x):
    return max(0, x)


def neuron(inputs, weights, bias):
    total = 0
    for x, w in zip(inputs, weights):
        total += x * w
    total += bias
    return relu(total)


inputs = [1, 2]
weights = [0.5, 0.4]
bias = 0.1
output = neuron(inputs, weights, bias)
print(output)`,
  },
  {
    sectionId: 'o0129-38-layer',
    blockIds: [
      'body-01345',
      'body-01346',
      'body-01347',
      'body-01348',
      'body-01349',
      'body-01350',
      'body-01351',
      'body-01352',
      'body-01353',
      'body-01354',
      'body-01355',
      'body-01356',
      'body-01357',
      'body-01358',
      'body-01359',
      'body-01360',
      'body-01361',
      'body-01362',
    ],
    code: python`def relu(x):
    return max(0, x)


def neuron(inputs, weights, bias):
    total = sum(x * w for x, w in zip(inputs, weights))
    return relu(total + bias)


def layer(inputs, weights, biases):
    outputs = []
    for neuron_weights, bias in zip(weights, biases):
        output = neuron(inputs, neuron_weights, bias)
        outputs.append(output)
    return outputs`,
  },
  {
    sectionId: 'o0129-38-layer',
    blockIds: [
      'body-01364',
      'body-01365',
      'body-01366',
      'body-01367',
      'body-01368',
      'body-01369',
      'body-01370',
      'body-01371',
      'body-01372',
      'body-01373',
      'body-01374',
      'body-01375',
      'body-01376',
      'body-01377',
      'body-01378',
    ],
    code: python`inputs = [1, 2]
weights = [
    [0.5, 0.4],
    [-0.3, 0.8],
]
biases = [0.1, -0.2]

hidden = layer(inputs, weights, biases)
print(hidden)`,
  },
  {
    sectionId: 'o0130-39-output-layer',
    blockIds: [
      'body-01382',
      'body-01383',
      'body-01384',
      'body-01385',
      'body-01386',
      'body-01387',
      'body-01388',
      'body-01389',
      'body-01390',
      'body-01391',
      'body-01392',
      'body-01393',
    ],
    code: python`output_weights = [[0.7, 0.2]]
output_biases = [0.1]

prediction = layer(hidden, output_weights, output_biases)
print(prediction)`,
  },
  {
    sectionId: 'o0158-50-neuron-if',
    blockIds: ['body-01594', 'body-01595'],
    code: python`if image_has_ears:
    cat_score += 1`,
  },
  {
    sectionId: 'o0159-51-traditional-programming-vs-machine-learning',
    blockIds: ['body-01608', 'body-01609'],
    code: python`if age >= 18:
    allow()`,
  },
  {
    sectionId: 'o0168-57-software-engineer-week-3',
    blockIds: [
      'body-01745',
      'body-01746',
      'body-01747',
      'body-01748',
      'body-01749',
      'body-01750',
      'body-01751',
    ],
    code: python`class Neuron:
    def __init__(self):
        self.weights = ...
        self.bias = ...

    def forward(self, inputs):
        z = dot(inputs, self.weights) + self.bias
        return activation(z)`,
  },
  {
    sectionId: 'o0168-57-software-engineer-week-3',
    blockIds: [
      'body-01753',
      'body-01754',
      'body-01755',
      'body-01756',
      'body-01757',
      'body-01758',
    ],
    code: python`class Layer:
    neurons = [
        Neuron(),
        Neuron(),
        Neuron(),
    ]`,
  },
  {
    sectionId: 'o0168-57-software-engineer-week-3',
    blockIds: [
      'body-01760',
      'body-01761',
      'body-01762',
      'body-01763',
      'body-01764',
      'body-01765',
    ],
    code: python`class NeuralNetwork:
    layers = [
        Layer(),
        Layer(),
        Layer(),
    ]`,
  },
  {
    sectionId: 'o0168-57-software-engineer-week-3',
    blockIds: ['body-01767', 'body-01768', 'body-01769', 'body-01770'],
    code: python`x = input
for layer in layers:
    x = layer.forward(x)
prediction = x`,
  },
  {
    sectionId: 'o0168-57-software-engineer-week-3',
    blockIds: [
      'body-01772',
      'body-01773',
      'body-01774',
      'body-01775',
      'body-01776',
      'body-01777',
      'body-01778',
      'body-01779',
    ],
    code: python`for epoch in range(...):
    prediction = model.forward(input)
    loss = loss_function(prediction, target)
    gradients = backward(loss)
    update_parameters(gradients)`,
  },
  {
    sectionId: 'o0193-13',
    blockIds: [
      'body-02058',
      'body-02059',
      'body-02060',
      'body-02061',
      'body-02062',
      'body-02063',
      'body-02064',
      'body-02065',
      'body-02066',
      'body-02067',
      'body-02068',
      'body-02069',
      'body-02070',
      'body-02071',
      'body-02072',
      'body-02073',
      'body-02074',
      'body-02075',
      'body-02076',
      'body-02077',
      'body-02078',
      'body-02079',
      'body-02080',
      'body-02081',
      'body-02082',
      'body-02083',
    ],
    code: python`x = 2.0
y = 5.0
w1, b1 = 1.0, 0.0
w2, b2 = 1.0, 0.0
learning_rate = 0.01

# Forward
z = w1 * x + b1
h = max(0.0, z)
prediction = w2 * h + b2
loss = (prediction - y) ** 2

# Backward: Loss → prediction
d_prediction = 2 * (prediction - y)

# Output layer
dw2 = d_prediction * h
db2 = d_prediction
d_h = d_prediction * w2

# ReLU
d_z = d_h * (1.0 if z > 0 else 0.0)

# Hidden layer
dw1 = d_z * x
db1 = d_z

# Update
w1 -= learning_rate * dw1
b1 -= learning_rate * db1
w2 -= learning_rate * dw2
b2 -= learning_rate * db2`,
  },
  {
    sectionId: 'o0203-1-tensor',
    blockIds: [
      'body-02174',
      'body-02175',
      'body-02176',
      'body-02177',
      'body-02178',
      'body-02179',
      'body-02180',
    ],
    code: python`import torch

scalar = torch.tensor(3.0)
vector = torch.tensor([1.0, 2.0, 3.0])
matrix = torch.tensor([
    [1.0, 2.0, 3.0],
    [4.0, 5.0, 6.0],
])`,
  },
  {
    sectionId: 'o0204-2-dimension-shape',
    blockIds: [
      'body-02195',
      'body-02196',
      'body-02197',
      'body-02198',
      'body-02199',
      'body-02200',
      'body-02201',
    ],
    code: python`x = torch.tensor([
    [0.8, 0.6, 0.2],
    [0.5, 0.4, 0.9],
    [0.9, 0.7, 0.1],
    [0.6, 0.8, 0.4],
])
print(x.shape)  # torch.Size([4, 3])`,
  },
  {
    sectionId: 'o0204-2-dimension-shape',
    blockIds: ['body-02214', 'body-02215'],
    code: python`# x: [batch, sequence, embedding]
x = token_embedding(token_ids)`,
  },
  {
    sectionId: 'o0205-3-dtype-device',
    blockIds: ['body-02218', 'body-02219'],
    code: python`x = torch.tensor([1.0, 2.0], dtype=torch.float32)
token_ids = torch.tensor([3, 8, 2], dtype=torch.long)`,
  },
  {
    sectionId: 'o0205-3-dtype-device',
    blockIds: ['body-02224', 'body-02225'],
    code: python`device = "cuda" if torch.cuda.is_available() else "cpu"
x = x.to(device)`,
  },
  {
    sectionId: 'o0206-4-tensor-layer',
    blockIds: [
      'body-02239',
      'body-02240',
      'body-02241',
      'body-02242',
      'body-02243',
      'body-02244',
      'body-02245',
      'body-02246',
      'body-02247',
      'body-02248',
      'body-02249',
      'body-02250',
      'body-02251',
      'body-02252',
    ],
    code: python`X = torch.tensor([
    [0.8, 0.6, 0.2],
    [0.5, 0.4, 0.9],
    [0.9, 0.7, 0.1],
    [0.6, 0.8, 0.4],
])
W = torch.tensor([
    [0.7, 0.2],
    [0.5, -0.1],
    [-0.4, 0.8],
])
b = torch.tensor([0.1, -0.2])

Z = X @ W + b
print(Z.shape)  # torch.Size([4, 2])`,
  },
  {
    sectionId: 'o0208-6-tensor-week-2',
    blockIds: ['body-02277', 'body-02278'],
    code: python`x = torch.tensor([[1.0], [2.0], [3.0], [4.0]])
y = torch.tensor([[3.0], [5.0], [7.0], [9.0]])`,
  },
  {
    sectionId: 'o0208-6-tensor-week-2',
    blockIds: ['body-02281', 'body-02282'],
    code: python`w = torch.tensor([[0.0]], requires_grad=True)
b = torch.tensor([0.0], requires_grad=True)`,
  },
  {
    sectionId: 'o0208-6-tensor-week-2',
    blockIds: ['body-02284', 'body-02285'],
    code: python`prediction = x @ w + b
loss = ((prediction - y) ** 2).mean()`,
  },
  {
    sectionId: 'o0209-7-requires-grad-true',
    blockIds: ['body-02287'],
    code: python`w = torch.tensor([[0.0]], requires_grad=True)`,
  },
  {
    sectionId: 'o0210-8-backward',
    blockIds: ['body-02311'],
    code: python`loss.backward()`,
  },
  {
    sectionId: 'o0210-8-backward',
    blockIds: ['body-02314', 'body-02315'],
    code: python`print(w.grad)
print(b.grad)`,
  },
  {
    sectionId: 'o0211-9-gradient',
    blockIds: ['body-02330', 'body-02331'],
    code: python`w.grad.zero_()
b.grad.zero_()`,
  },
  {
    sectionId: 'o0211-9-gradient',
    blockIds: ['body-02333'],
    code: python`optimizer.zero_grad()`,
  },
  {
    sectionId: 'o0212-10-parameter',
    blockIds: ['body-02340', 'body-02341', 'body-02342'],
    code: python`with torch.no_grad():
    w -= learning_rate * w.grad
    b -= learning_rate * b.grad`,
  },
  {
    sectionId: 'o0213-11-tensor-training-loop',
    blockIds: [
      'body-02347',
      'body-02348',
      'body-02349',
      'body-02350',
      'body-02351',
      'body-02352',
      'body-02353',
      'body-02354',
      'body-02355',
      'body-02356',
      'body-02357',
      'body-02358',
      'body-02359',
      'body-02360',
      'body-02361',
      'body-02362',
      'body-02363',
      'body-02364',
      'body-02365',
      'body-02366',
      'body-02367',
    ],
    code: python`import torch

x = torch.tensor([[1.0], [2.0], [3.0], [4.0]])
y = torch.tensor([[3.0], [5.0], [7.0], [9.0]])
w = torch.tensor([[0.0]], requires_grad=True)
b = torch.tensor([0.0], requires_grad=True)
learning_rate = 0.01

for step in range(1000):
    # Forward
    prediction = x @ w + b
    loss = ((prediction - y) ** 2).mean()

    # Backward
    loss.backward()

    # Update
    with torch.no_grad():
        w -= learning_rate * w.grad
        b -= learning_rate * b.grad

    # Reset gradients
    w.grad.zero_()
    b.grad.zero_()

print(w.item())  # approximately 2
print(b.item())  # approximately 1`,
  },
  {
    sectionId: 'o0214-12-nn-module-parameters-forward',
    blockIds: [
      'body-02370',
      'body-02371',
      'body-02372',
      'body-02373',
      'body-02374',
      'body-02375',
      'body-02376',
    ],
    code: python`import torch.nn as nn


class LinearModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.linear = nn.Linear(1, 1)

    def forward(self, x):
        return self.linear(x)`,
  },
  {
    sectionId: 'o0215-13-loss-function-optimizer',
    blockIds: ['body-02390', 'body-02391', 'body-02392'],
    code: python`model = LinearModel()
loss_function = nn.MSELoss()
optimizer = torch.optim.SGD(model.parameters(), lr=0.01)`,
  },
  {
    sectionId: 'o0216-14-pytorch-training-loop',
    blockIds: [
      'body-02404',
      'body-02405',
      'body-02406',
      'body-02407',
      'body-02408',
      'body-02409',
    ],
    code: python`for step in range(1000):
    optimizer.zero_grad()
    prediction = model(x)
    loss = loss_function(prediction, y)
    loss.backward()
    optimizer.step()`,
  },
  {
    sectionId: 'o0217-15-shape-debugging',
    blockIds: ['body-02426', 'body-02427', 'body-02428', 'body-02429'],
    code: python`print("x:", x.shape)
print("weight:", model.linear.weight.shape)
print("prediction:", prediction.shape)
print("target:", y.shape)`,
  },
  {
    sectionId: 'o0218-16-train-eval',
    blockIds: ['body-02437', 'body-02438'],
    code: python`model.train()
model.eval()`,
  },
  {
    sectionId: 'o0218-16-train-eval',
    blockIds: ['body-02441', 'body-02442', 'body-02443'],
    code: python`model.eval()
with torch.no_grad():
    prediction = model(x)`,
  },
];

function promoteSectionBlocks(
  section: SectionNode,
  promotions: readonly CodePromotion[],
): SectionNode {
  if (promotions.length === 0) return section;

  const promotionByFirstBlock = new Map(
    promotions.map((promotion) => [promotion.blockIds[0], promotion]),
  );
  const consumedBlockIds = new Set<string>();
  const blocks: ContentBlock[] = [];

  for (let index = 0; index < section.blocks.length; index += 1) {
    const block = section.blocks[index];
    const promotion = promotionByFirstBlock.get(block.id);
    if (!promotion) {
      blocks.push(block);
      continue;
    }

    const selected = section.blocks.slice(
      index,
      index + promotion.blockIds.length,
    );
    const selectedIds = selected.map((candidate) => candidate.id);
    if (
      selectedIds.length !== promotion.blockIds.length ||
      selectedIds.some((id, offset) => id !== promotion.blockIds[offset]) ||
      selected.some((candidate) => candidate.type !== 'paragraph')
    ) {
      throw new Error(
        `Code promotion no longer matches consecutive paragraphs in ${section.id}: ${promotion.blockIds.join(', ')}`,
      );
    }

    for (const id of selectedIds) {
      if (consumedBlockIds.has(id))
        throw new Error(`Code promotion consumes ${id} more than once`);
      consumedBlockIds.add(id);
    }

    blocks.push({
      type: 'code',
      id: block.id,
      language: 'python',
      code: promotion.code,
      source: block.source,
    });
    index += promotion.blockIds.length - 1;
  }

  const expectedBlockIds = promotions.flatMap(
    (promotion) => promotion.blockIds,
  );
  const missingBlockIds = expectedBlockIds.filter(
    (id) => !consumedBlockIds.has(id),
  );
  if (missingBlockIds.length > 0)
    throw new Error(
      `Code promotion target(s) missing from ${section.id}: ${missingBlockIds.join(', ')}`,
    );

  return { ...section, blocks };
}

function visitSection(
  section: SectionNode,
  promotionsBySection: ReadonlyMap<string, readonly CodePromotion[]>,
): SectionNode {
  const promoted = promoteSectionBlocks(
    section,
    promotionsBySection.get(section.id) ?? [],
  );
  return {
    ...promoted,
    children: promoted.children.map((child) =>
      visitSection(child, promotionsBySection),
    ),
  };
}

export function applyLegacyCodePromotions(course: Readonly<Course>): Course {
  const promotionsBySection = new Map<string, CodePromotion[]>();
  for (const promotion of CODE_PROMOTIONS) {
    const current = promotionsBySection.get(promotion.sectionId) ?? [];
    current.push(promotion);
    promotionsBySection.set(promotion.sectionId, current);
  }

  const overview = visitSection(course.overview, promotionsBySection);
  const units = course.units.map((unit) =>
    visitSection(unit, promotionsBySection),
  ) as CourseUnit[];

  const knownSectionIds = new Set<string>();
  const collect = (section: SectionNode): void => {
    knownSectionIds.add(section.id);
    section.children.forEach(collect);
  };
  collect(overview);
  units.forEach(collect);
  const missingSections = [...promotionsBySection.keys()].filter(
    (sectionId) => !knownSectionIds.has(sectionId),
  );
  if (missingSections.length > 0)
    throw new Error(
      `Code promotion section(s) missing: ${missingSections.join(', ')}`,
    );

  return { ...course, overview, units };
}

export const LEGACY_CODE_PROMOTION_COUNT = CODE_PROMOTIONS.length;
