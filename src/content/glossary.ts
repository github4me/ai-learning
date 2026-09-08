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
    term: 'Token（计算单位）',
    aliases: ['词元', 'Token ID'],
    definition:
      'Tokenizer 把文字划分出的一个计算单位，可以是字符、词或子词。Token ID 是它在固定词表中的编号，编号较大不表示语义更多或更重要。',
    sectionId: 'o0223-1-token-id',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0223-1-token-id',
  },
  {
    term: 'Batch / B、T、C、V',
    aliases: ['批次', '批量', 'B T C V'],
    definition:
      'Batch 是一起处理的若干样本。B=样本行数，T=每行输入位置数，C=每位置的表示宽度，V=词表候选数。ID 的 [B,T]、表示的 [B,T,C] 和评分的 [B,T,V] 是不同阶段，不是增加了新的 token。',
    sectionId: 'o0229-4-batch-embedding-shape',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0229-4-batch-embedding-shape',
  },
  {
    term: '上下文表示 h',
    aliases: ['Contextual Representation', 'Hidden Representation'],
    definition:
      'h 是模型根据当前位置可见信息算出的一组浮点数，再交给输出层评分。完整 GPT 中它通常经过 Attention、FFN 等运算，不等于当前 token 的原始查表向量；shape 相同不保证数值或含义相同。',
    sectionId: 'o0232-6-language-model',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0232-6-language-model',
  },
  {
    term: 'Output Head（输出层）',
    aliases: ['LM Head', '输出头'],
    definition:
      '把每个位置的表示 h 转成 V 个候选分数的可训练层。通常是一个线性层：各候选权重分别与同一个 h 做点积，可再加偏置；Softmax 随后才把分数变成概率。',
    sectionId: 'o0237-9-model-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0237-9-model-probability',
  },
  {
    term: 'Target / one-hot yᵢ',
    aliases: ['标签', '真实目标', 'target_id'],
    definition:
      'target_id 是本题真实下一 token 的整数编号。yᵢ 是对应 one-hot 标签的第 i 项：正确类为 1，其他为 0。它不是模型概率 pᵢ；本课单题 logits 梯度为 pᵢ−yᵢ，平均多题时还要除以有效题目数。',
    sectionId: 'o0241-11-cross-entropy-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0241-11-cross-entropy-probability',
  },
  {
    term: 'representation（表示）',
    aliases: ['表示'],
    definition:
      '表示是模型用来计算的一组数。它由输入编码或网络运算产生；这些数的含义取决于怎样得到它们，不能只看 shape 猜语义。',
    sectionId: 'o0005-1-ai',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0005-1-ai',
  },
  {
    term: 'Scalar（标量）',
    aliases: ['标量'],
    definition:
      '标量是一个数。每项预测误差可以汇总成一个标量损失，作为本次优化目标；多元素输出也能求导，但要明确怎样组合其贡献。',
    sectionId: 'o0006-2-scalar',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0006-2-scalar',
  },
  {
    term: 'Vector',
    aliases: [],
    definition:
      '向量是一组有序数字。每个位置的含义要固定；例如 [面积,房龄] 不能不改权重就换成 [房龄,面积]。',
    sectionId: 'o0007-3-vector',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0007-3-vector',
  },
  {
    term: 'Shape',
    aliases: [],
    definition:
      'shape 列出各轴长度，例如 [4,3] 可以表示四个样本、每个三个特征。两条轴不等于“一个二维向量”；各轴的意义必须另行说明。',
    sectionId: 'o0009-4-shape',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0009-4-shape',
  },
  {
    term: 'Weight',
    aliases: [],
    definition:
      '权重是乘在输入上的可训练系数。在一个固定线性计算里，它控制该输入变化对输出的局部影响；不能直接当作真实世界的因果重要性。',
    sectionId: 'o0011-5-weight',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0011-5-weight',
  },
  {
    term: 'Dot Product（点积）',
    aliases: ['点积'],
    definition:
      '点积把对应位置相乘后求和。例如 [1,2]·[0.5,0.4]=1.3；它把一组特征按当前权重合成一个分数。',
    sectionId: 'o0013-6-dot-product',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0013-6-dot-product',
  },
  {
    term: 'Bias',
    aliases: [],
    definition:
      '偏置是加权和之后的可训练偏移。例如 y=wx+b 中，输入为零时仍可输出 b，不必强制经过原点。',
    sectionId: 'o0015-7-bias',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0015-7-bias',
  },
  {
    term: 'Parameter',
    aliases: ['parameters'],
    definition:
      '参数是模型通过训练改变并长期保存的数，例如权重、偏置和 Embedding 表；当前输入、目标和临时激活不是模型参数。',
    sectionId: 'o0021-parameter',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0021-parameter',
  },
  {
    term: 'Hyperparameter',
    aliases: [],
    definition:
      '超参数是训练者指定的设置，例如学习率、batch 大小、层数。它们影响训练或架构，但不是本课 optimizer 直接求梯度更新的对象。',
    sectionId: 'o0022-hyperparameter',
    unitId: 'o0002-week-1-ai',
    route: '/week/week-01#o0022-hyperparameter',
  },
  {
    term: 'Linear Regression（线性回归）',
    aliases: ['线性回归'],
    definition:
      '线性回归用仿射规则预测连续数值，例如 y_hat=wx+b。训练寻找适合数据的 w/b；玩具直线拟合成功不保证能预测任意新资料。',
    sectionId: 'o0040-1-linear-regression',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0040-1-linear-regression',
  },
  {
    term: 'Loss',
    aliases: ['Loss Function'],
    definition:
      '损失是按任务定义的错误评分。它把预测与真实目标作比较；数值本身不是梯度，也不必是错误率或百分比。',
    sectionId: 'o0043-4-error-loss',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0043-4-error-loss',
  },
  {
    term: 'MSE',
    aliases: ['Mean Squared Error', '均方误差'],
    definition:
      '均方误差先计算各项 (预测−目标)²，再按指定范围平均。只有一项时也可以叫 MSE；选择损失取决于任务，mean/sum 决定汇总方式。',
    sectionId: 'o0044-5-mse',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0044-5-mse',
  },
  {
    term: 'Gradient',
    aliases: [],
    definition:
      '梯度收集目标对各参数的偏导数，描述当前位置的局部变化。负梯度是局部下降方向，但步长过大仍可能使损失增加。',
    sectionId: 'o0047-8-gradient',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0047-8-gradient',
  },
  {
    term: 'Gradient Descent（梯度下降）',
    aliases: ['梯度下降'],
    definition:
      '梯度下降先在旧参数处计算梯度，再按 参数−学习率×梯度 更新。它是求解方法，不是损失函数，也不保证总能找到全局最优。',
    sectionId: 'o0048-9-gradient-descent',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0048-9-gradient-descent',
  },
  {
    term: 'Learning Rate',
    aliases: [],
    definition:
      '学习率控制更新的步幅。适合的数值依赖模型、数据尺度和优化器；过大可能越过低点或发散，过小可能学习缓慢。',
    sectionId: 'o0049-10-learning-rate',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0049-10-learning-rate',
  },
  {
    term: 'Chain Rule',
    aliases: [],
    definition:
      '链式法则沿依赖路径把局部变化倍率相乘；同一变量经过多条路径影响结果时，各路径贡献还要相加。',
    sectionId: 'o0055-12-chain-rule',
    unitId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    route: '/week/week-02#o0055-12-chain-rule',
  },
  {
    term: 'Neuron',
    aliases: ['Artificial Neuron', '人工神经元'],
    definition:
      '人工神经元先对输入做加权求和并加偏置，再按需要应用激活函数。它是数学计算单元，不是生物神经元的精确模拟。',
    sectionId: 'o0082-5-neuron',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0082-5-neuron',
  },
  {
    term: 'Activation Function（激活函数）',
    aliases: ['激活函数'],
    definition:
      '激活函数把加权和变成下一层的输入，例如 ReLU(z)。非线性激活让多层网络能表达单个仿射变换无法表达的关系；输出层选择取决于任务。',
    sectionId: 'o0089-activation-function',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0089-activation-function',
  },
  {
    term: 'ReLU',
    aliases: ['Rectified Linear Unit'],
    definition:
      'ReLU(z)=max(0,z)：负数变为零，正数保留。z<0 的这条路径梯度为零，不代表其他路径或整个模型的梯度都为零。',
    sectionId: 'o0093-relu',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0093-relu',
  },
  {
    term: 'Layer',
    aliases: [],
    definition:
      '一层通常用多组权重处理同一输入，得到多个输出。所有 batch 样本复用同一层参数，不是每个样本拥有自己的网络。',
    sectionId: 'o0100-18-layer',
    unitId: 'o0077-week-3-neural-network-neuron',
    route: '/week/week-03#o0100-18-layer',
  },
  {
    term: 'Backpropagation',
    aliases: [],
    definition:
      '反向传播根据计算图和链式法则计算参数梯度。它不负责更新参数；更新由 SGD、AdamW 等优化器另行完成。',
    sectionId: 'o0181-1-backpropagation-training',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0181-1-backpropagation-training',
  },
  {
    term: 'Computational Graph',
    aliases: ['dependency graph'],
    definition:
      '计算图记录运算之间的真实依赖。forward 保存必要中间值，backward 沿依赖传递并汇总梯度；反向求导不是把函数求逆。',
    sectionId: 'o0182-2-computational-graph',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0182-2-computational-graph',
  },
  {
    term: 'Tensor',
    aliases: [],
    definition:
      '张量是带 shape、dtype 和 device 的多轴数值容器。PyTorch 还能记录所需的自动求导信息；一个 shape [3] 的三维向量只有一条轴。',
    sectionId: 'o0203-1-tensor',
    unitId: 'o0201-week-5-tensor-pytorch',
    route: '/week/week-05#o0203-1-tensor',
  },
  {
    term: 'Autograd',
    aliases: [],
    definition:
      '自动求导记录需要求导的运算及中间值，再按链式法则计算梯度。本课从标量 loss 调用 backward，并把贡献累加到参数的 .grad。',
    sectionId: 'o0196-16-autograd',
    unitId: 'o0179-week-4-backpropagation',
    route: '/week/week-04#o0196-16-autograd',
  },
  {
    term: 'Embedding',
    aliases: [],
    definition:
      'Embedding 用整数 ID 从可训练表中取一行向量。ID 只是地址，表中的浮点数才是参数；这行初始表示还没有读取当前句子的左侧上下文。',
    sectionId: 'o0225-2-embedding',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0225-2-embedding',
  },
  {
    term: 'Language Model',
    aliases: [],
    definition:
      '本课的自回归语言模型根据可见前缀，对下一 token 的所有候选给出分数和概率。目标来自文字的下一位置，不应提前进入预测分支。',
    sectionId: 'o0232-6-language-model',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0232-6-language-model',
  },
  {
    term: 'Autoregressive',
    aliases: ['Autoregressive Language Model'],
    definition:
      '自回归生成先根据已有前缀预测，再选择一个 token 追加到末尾，随后用新的前缀重新预测。训练时各位置的输入前缀来自原始文字。',
    sectionId: 'o0234-7-autoregressive',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0234-7-autoregressive',
  },
  {
    term: 'Logits',
    aliases: ['Logit'],
    definition:
      'Logit 是候选的原始分数，不是概率。本课输出层按 h 与候选权重点积并加偏置计算；同一行分数可以为负，也不必加起来等于 1。',
    sectionId: 'o0237-9-model-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0237-9-model-probability',
  },
  {
    term: 'Softmax',
    aliases: [],
    definition:
      'Softmax 对同一行分数取指数再除以指数总和，把相对分数变成归一化分布。词表 Softmax 比较候选，Attention Softmax 比较可读取的位置。',
    sectionId: 'o0239-10-softmax-logits-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0239-10-softmax-logits-probability',
  },
  {
    term: 'Cross Entropy',
    aliases: ['Cross Entropy Loss'],
    definition:
      '本课整数目标、无加权或标签平滑时，单位置交叉熵是 −ln(p_correct)。模型给正确目标的概率越大，损失越小；多个有效位置通常取平均。',
    sectionId: 'o0241-11-cross-entropy-probability',
    unitId: 'o0221-week-6-embedding-language-model',
    route: '/week/week-06#o0241-11-cross-entropy-probability',
  },
  {
    term: 'Attention',
    aliases: [],
    definition:
      'Attention 用当前表示计算匹配分数，把允许读取位置的 Value 按权重相加。它生成上下文表示，不直接给出下一词，也不是查询外部数据库。',
    sectionId: 'o0256-attention',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0256-attention',
  },
  {
    term: 'Query / Key / Value（Q / K / V）',
    aliases: ['Query', 'Key', 'Value'],
    definition:
      'Query 用于提出匹配需求，Key 参与点积打分，Value 是加权取回的内容。它们由输入通过可训练投影产生；匹配分数不必等同于自然语言语义相似度。',
    sectionId: 'o0258-2-q-k-v',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0258-2-q-k-v',
  },
  {
    term: 'Causal Mask',
    aliases: [],
    definition:
      'Causal mask 禁止当前位置读取右侧输入。在 Softmax 前把未来分数设为负无穷，避免 next-token 训练偷看生成时还不存在的答案。',
    sectionId: 'o0270-10-gpt-causal-mask',
    unitId: 'o0254-week-7-attention-token',
    route: '/week/week-07#o0270-10-gpt-causal-mask',
  },
  {
    term: 'Transformer Block',
    aliases: ['Block'],
    definition:
      '本课 Pre-Norm block 先算 x+Attention(LN1(x))，再加 FFN(LN2(...))。输入输出同为 [B,T,C]，但里面的数已经被上下文和非线性运算改造。',
    sectionId: 'o0306-11-transformer-block',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0306-11-transformer-block',
  },
  {
    term: 'Feed-Forward Network（FFN）',
    aliases: ['FeedForward'],
    definition:
      '前馈网络在每个位置内组合与变换特征，所有位置共享参数。它补充 Attention 的跨位置读取；C→4C→C 是本课选择，不是数学定律。',
    sectionId: 'o0294-feed-forward-network',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0294-feed-forward-network',
  },
  {
    term: 'Residual Connection',
    aliases: ['identity path'],
    definition:
      '残差连接把原输入与分支结果相加：y=x+F(x)。旁路保留原始信息，并给梯度一条直接路径；F(x) 与 x 的 shape 必须兼容。',
    sectionId: 'o0299-7-residual-connection',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0299-7-residual-connection',
  },
  {
    term: 'Layer Normalization',
    aliases: ['LayerNorm'],
    definition:
      'LayerNorm 在每个位置自己的特征轴上减均值、除以含 epsilon 的标准差，再用可训练 gamma/beta 缩放平移。本课方差除以特征数，不用 n−1。',
    sectionId: 'o0302-9-layer-normalization',
    unitId: 'o0285-week-8-transformer-attention',
    route: '/week/week-08#o0302-9-layer-normalization',
  },
  {
    term: 'Tokenizer',
    aliases: ['token stream'],
    definition:
      'Tokenizer 固定文字怎样分成 token、怎样编号和怎样解码。编码不训练神经网络；换 ID 含义时必须同步处理模型参数和保存文件。',
    sectionId: 'o0320-tokenizer',
    unitId: 'o0318-week-9-tokenizer-gpt',
    route: '/week/week-09#o0320-tokenizer',
  },
  {
    term: 'Vocabulary Size',
    aliases: [],
    definition:
      '词表大小是候选 token 的数量。更大的词表可能缩短常见文本的编码，但增加输入表和输出层参数；实际取舍还取决于切词规则和语料。',
    sectionId: 'o0329-vocabulary',
    unitId: 'o0318-week-9-tokenizer-gpt',
    route: '/week/week-09#o0329-vocabulary',
  },
  {
    term: 'Checkpoint',
    aliases: [],
    definition:
      'Checkpoint 是保存的模型快照。推理至少需要兼容的代码/配置、词表和权重；继续训练还需相应 optimizer 状态，精确重演通常还涉及 RNG 与数据进度。',
    sectionId: 'o0397-12-checkpoint',
    unitId: 'o0378-week-11-training-inference-mini-gpt',
    route: '/week/week-11#o0397-12-checkpoint',
  },
] as const;
