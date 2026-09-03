/** Source-grounded, human-reviewed glossary derived only from the checked-in course corpus. */
export type RuntimeGlossaryEntry = Readonly<{
  term: string;
  aliases: readonly string[];
  definition: string;
  sectionId: string;
  unitId: string;
  route: string;
}>;

export const GLOSSARY_ENTRIES: readonly RuntimeGlossaryEntry[] = [
  {
    term: 'representation（表示）',
    aliases: ['表示'],
    definition:
      'The numerical form a model can process: real-world concepts must become comparable, combinable numbers, and what is represented determines what the model can use.',
    sectionId: 'o0005-1-ai',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0005-1-ai',
  },
  {
    term: 'Scalar（标量）',
    aliases: ['标量'],
    definition:
      'One standalone number representing one quantity, with no internal direction or positional structure; training commonly aggregates errors into a scalar loss.',
    sectionId: 'o0006-2-scalar',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0006-2-scalar',
  },
  {
    term: 'Vector',
    aliases: [],
    definition:
      'An ordered set of feature values for one object; each position has a fixed meaning, so changing the order changes the meaning even if the program still runs.',
    sectionId: 'o0007-3-vector',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0007-3-vector',
  },
  {
    term: 'Shape',
    aliases: [],
    definition:
      'The data-structure contract: for example, [4, 3] means four examples with three features each; many AI bugs are contract violations rather than formula errors.',
    sectionId: 'o0009-4-shape',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0009-4-shape',
  },
  {
    term: 'Weight',
    aliases: [],
    definition:
      'The direction and strength with which one input influences a result; training finds these values from data rather than a programmer assigning each one.',
    sectionId: 'o0011-5-weight',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0011-5-weight',
  },
  {
    term: 'Dot Product（点积）',
    aliases: ['点积'],
    definition:
      "Corresponding inputs and weights are multiplied and then summed, compressing multiple pieces of evidence and their importance into a neuron's overall response.",
    sectionId: 'o0013-6-dot-product',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0013-6-dot-product',
  },
  {
    term: 'Bias',
    aliases: [],
    definition:
      'A learnable offset added to the weighted score, allowing a model not to be forced to output zero when every input is zero.',
    sectionId: 'o0015-7-bias',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0015-7-bias',
  },
  {
    term: 'Parameter',
    aliases: ['parameters'],
    definition:
      'A value the model learns through training, such as weights and biases.',
    sectionId: 'o0021-parameter',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0021-parameter',
  },
  {
    term: 'Hyperparameter',
    aliases: [],
    definition:
      'A setting selected by the trainer—such as learning rate, batch size, or layer count—that defines the learning process or architecture rather than being updated directly in forward/backward.',
    sectionId: 'o0022-hyperparameter',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0022-hyperparameter',
  },
  {
    term: 'Linear Regression（线性回归）',
    aliases: ['线性回归'],
    definition:
      'A method for predicting continuous values by finding the best-fitting line from existing data and using it to predict new data.',
    sectionId: 'o0040-1-linear-regression',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0040-1-linear-regression',
  },
  {
    term: 'Loss',
    aliases: ['Loss Function'],
    definition:
      'A training measure used instead of simply adding errors, so positive and negative errors do not cancel; squared error also penalizes larger errors more strongly.',
    sectionId: 'o0043-4-error-loss',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0043-4-error-loss',
  },
  {
    term: 'MSE',
    aliases: ['Mean Squared Error', '均方误差'],
    definition:
      'The average squared error across multiple samples; it is mainly used for regression, while classification commonly uses losses such as Cross Entropy.',
    sectionId: 'o0044-5-mse',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0044-5-mse',
  },
  {
    term: 'Gradient',
    aliases: [],
    definition:
      'For a parameter, it tells how the loss changes when that parameter changes slightly; it points toward the fastest loss increase, so an update moves in the opposite direction.',
    sectionId: 'o0047-8-gradient',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0047-8-gradient',
  },
  {
    term: 'Gradient Descent（梯度下降）',
    aliases: ['梯度下降'],
    definition:
      'Repeatedly calculate the gradient and move downhill; in machine learning, the low point represents loss as small as possible.',
    sectionId: 'o0048-9-gradient-descent',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0048-9-gradient-descent',
  },
  {
    term: 'Learning Rate',
    aliases: [],
    definition:
      'A hyperparameter that controls the size of each parameter-update step: too large can overshoot, oscillate, or diverge; too small makes training slow.',
    sectionId: 'o0049-10-learning-rate',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0049-10-learning-rate',
  },
  {
    term: 'Chain Rule',
    aliases: [],
    definition:
      'To determine how a weight affects loss, trace backward through its dependency chain from the prediction to the loss—the core idea used later in backpropagation.',
    sectionId: 'o0055-12-chain-rule',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0055-12-chain-rule',
  },
  {
    term: 'Neuron',
    aliases: ['Artificial Neuron', '人工神经元'],
    definition:
      'The most basic neural-network computation unit: a weighted sum of inputs plus a bias.',
    sectionId: 'o0082-5-neuron',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0082-5-neuron',
  },
  {
    term: 'Activation Function（激活函数）',
    aliases: ['激活函数'],
    definition:
      'A function applied to the linear result: a complete neuron is a = f(wx + b), where f is the activation function and a is the activation/output.',
    sectionId: 'o0089-activation-function',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0089-activation-function',
  },
  {
    term: 'ReLU',
    aliases: ['Rectified Linear Unit'],
    definition: 'The activation ReLU(x) = max(0, x).',
    sectionId: 'o0093-relu',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0093-relu',
  },
  {
    term: 'Layer',
    aliases: [],
    definition:
      'Multiple neurons, each with its own weights and bias, process the same input and produce a vector of activations as the layer output.',
    sectionId: 'o0100-18-layer',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0100-18-layer',
  },
  {
    term: 'Backpropagation',
    aliases: [],
    definition:
      'The part of training that computes gradients; gradient descent or an optimizer separately uses those gradients to update parameters.',
    sectionId: 'o0181-1-backpropagation-training',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0181-1-backpropagation-training',
  },
  {
    term: 'Computational Graph',
    aliases: ['dependency graph'],
    definition:
      'A representation that splits a large formula into small operations and records their dependencies, including the forward context required to compute local derivatives in backward.',
    sectionId: 'o0182-2-computational-graph',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0182-2-computational-graph',
  },
  {
    term: 'Tensor',
    aliases: [],
    definition:
      'A multidimensional number container with shape, dtype, device, and autograd metadata; it unifies scalar, vector, and matrix in one interface.',
    sectionId: 'o0203-1-tensor',
    unitId: 'o0201-week-5-tensor-pytorch',
    route: '/week/week-05#o0203-1-tensor',
  },
  {
    term: 'Autograd',
    aliases: [],
    definition:
      "PyTorch's mechanism that records forward operations and needed intermediate values, traverses backward from a scalar loss, and accumulates gradients using local derivatives and the Chain Rule.",
    sectionId: 'o0196-16-autograd',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0196-16-autograd',
  },
  {
    term: 'Embedding',
    aliases: [],
    definition:
      'A learnable vector stored for each token, initialized as numbers and updated through training; it is a set of parameters rather than a hand-written dictionary of word meanings.',
    sectionId: 'o0225-2-embedding',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0225-2-embedding',
  },
  {
    term: 'Language Model',
    aliases: [],
    definition:
      'A model whose core task is to predict the next token from the preceding tokens.',
    sectionId: 'o0232-6-language-model',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0232-6-language-model',
  },
  {
    term: 'Autoregressive',
    aliases: ['Autoregressive Language Model'],
    definition:
      'Generate by predicting one token from existing content, appending that prediction, and repeating; each output becomes input for the next prediction.',
    sectionId: 'o0234-7-autoregressive',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0234-7-autoregressive',
  },
  {
    term: 'Logits',
    aliases: ['Logit'],
    definition:
      'Raw vocabulary scores that can be positive or negative and need not sum to one; a higher score means the model favors that token more.',
    sectionId: 'o0237-9-model-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0237-9-model-probability',
  },
  {
    term: 'Softmax',
    aliases: [],
    definition:
      'Converts logits into positive probabilities summing to one; it depends on the relative differences between logits rather than their absolute values.',
    sectionId: 'o0239-10-softmax-logits-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0239-10-softmax-logits-probability',
  },
  {
    term: 'Cross Entropy',
    aliases: ['Cross Entropy Loss'],
    definition:
      'For a single target, loss is -log(p_correct); higher probability on the correct answer gives lower loss, and lower probability gives higher loss.',
    sectionId: 'o0241-11-cross-entropy-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0241-11-cross-entropy-probability',
  },
  {
    term: 'Attention',
    aliases: [],
    definition:
      'A content-related direct path that lets the current token compare with every permitted token and dynamically decide where to read more information from the existing context.',
    sectionId: 'o0256-attention',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0256-attention',
  },
  {
    term: 'Query / Key / Value（Q / K / V）',
    aliases: ['Query', 'Key', 'Value'],
    definition:
      'Three learned projections used like retrieval: Query describes what is sought, Key describes how a record matches, and Value is the content returned after weighted matching.',
    sectionId: 'o0258-2-q-k-v',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0258-2-q-k-v',
  },
  {
    term: 'Causal Mask',
    aliases: [],
    definition:
      'A GPT constraint that lets each position see only itself and earlier positions, preventing a next-token prediction from seeing its future answer.',
    sectionId: 'o0270-10-gpt-causal-mask',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0270-10-gpt-causal-mask',
  },
  {
    term: 'Transformer Block',
    aliases: ['Block'],
    definition:
      'A [B,T,C] → Block → [B,T,C] unit that internally performs context communication and nonlinear transformation while retaining the same external shape.',
    sectionId: 'o0306-11-transformer-block',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0306-11-transformer-block',
  },
  {
    term: 'Feed-Forward Network（FFN）',
    aliases: ['FeedForward'],
    definition:
      "A per-token nonlinear transformation of the information the token has already aggregated; it complements Attention's communication across tokens.",
    sectionId: 'o0294-feed-forward-network',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0294-feed-forward-network',
  },
  {
    term: 'Residual Connection',
    aliases: ['identity path'],
    definition:
      'The addition y = x + F(x): a layer learns what to add to its input rather than reconstructing the full representation, while the identity path gives gradients a more direct route.',
    sectionId: 'o0299-7-residual-connection',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0299-7-residual-connection',
  },
  {
    term: 'Layer Normalization',
    aliases: ['LayerNorm'],
    definition:
      "For each token's features, normalize the internal numeric scale and then apply learnable scaling and shifting, stabilizing representation scale in deep networks.",
    sectionId: 'o0302-9-layer-normalization',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0302-9-layer-normalization',
  },
  {
    term: 'Tokenizer',
    aliases: ['token stream'],
    definition:
      "The stable protocol between open-ended Unicode text and the neural network's finite integer-ID input: it defines vocabulary fragments, numbering, splitting, and conversion back to text.",
    sectionId: 'o0320-tokenizer',
    unitId: 'o0318-week-9-tokenizer-gpt',
    route: '/week/week-09#o0320-tokenizer',
  },
  {
    term: 'Vocabulary Size',
    aliases: [],
    definition:
      'A larger vocabulary can represent common text with fewer tokens but needs more Embedding and LM Head parameters; it affects sequence length, context capacity, parameter count, and training/inference cost.',
    sectionId: 'o0329-vocabulary',
    unitId: 'o0318-week-9-tokenizer-gpt',
    route: '/week/week-09#o0329-vocabulary',
  },
  {
    term: 'Checkpoint',
    aliases: [],
    definition:
      'A recoverable snapshot of training state, not just weights; exact resume needs at least model, optimizer, step, config, and tokenizer state.',
    sectionId: 'o0397-12-checkpoint',
    unitId: 'o0378-week-11-training-inference-mini-gpt',
    route: '/week/week-11#o0397-12-checkpoint',
  },
] as const;
