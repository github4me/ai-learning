import type {
  CuratedBodyBlock,
  CuratedWeekRevision,
  TeachingCheck,
  TeachingSectionRevision,
} from './types';

const paragraph = (text: string): CuratedBodyBlock => ({
  type: 'paragraph',
  text,
});

const list = (items: string[], ordered = false): CuratedBodyBlock => ({
  type: 'list',
  ordered,
  items,
});

const formula = (latex: string, accessibleText: string): CuratedBodyBlock => ({
  type: 'formula',
  latex,
  accessibleText,
});

const code = (language: string, value: string): CuratedBodyBlock => ({
  type: 'code',
  language,
  code: value,
});

const table = (
  headers: string[],
  rows: string[][],
  caption?: string,
): CuratedBodyBlock => ({
  type: 'table',
  headers,
  rows,
  ...(caption ? { caption } : {}),
});

const chain = (steps: string[]): CuratedBodyBlock => ({
  type: 'conceptChain',
  steps,
});

const callout = (
  title: string,
  blocks: CuratedBodyBlock[],
  tone: 'concept' | 'principle' | 'example' = 'example',
): CuratedBodyBlock => ({ type: 'callout', tone, title, blocks });

function check(prompt: string, answer: CuratedBodyBlock[]): TeachingCheck {
  return { prompt, answer };
}

function section(
  sectionId: string,
  title: string,
  problem: string,
  purpose: string[],
  blocks: [CuratedBodyBlock, ...CuratedBodyBlock[]],
  pitfalls: string[],
  knowledgeCheck: TeachingCheck,
): TeachingSectionRevision {
  return {
    sectionId,
    title,
    problem,
    purpose,
    blocks,
    pitfalls,
    check: knowledgeCheck,
    collapseChildren: true,
  };
}

const vocabularyRows = [
  ['0', '我'],
  ['1', '喜欢'],
  ['2', 'AI'],
  ['3', '学习'],
  ['4', '猫'],
];

const embeddingRows = [
  ['0 / 我', '0.20', '-0.10', '0.70', '0.30'],
  ['1 / 喜欢', '0.60', '0.30', '-0.20', '0.10'],
  ['2 / AI', '-0.40', '0.80', '0.50', '-0.30'],
  ['3 / 学习', '0.10', '0.20', '0.90', '0.40'],
  ['4 / 猫', '-0.70', '0.40', '0.30', '0.60'],
];

export const week06Revision: CuratedWeekRevision = {
  weekSlug: 'week-06',
  title: 'Week 6 - 从 Token 到最小语言模型：用一个例子理解预测',
  keyQuestion:
    '模型怎样把“我 喜欢 AI”变成数字、根据上下文为每个候选打分，再通过训练提高正确 Token 的概率？',
  objectives: [
    '区分 Token、Tokenizer、Vocabulary、Token ID、Embedding、Context Representation、Logit 与 Probability。',
    '解释 Output Head 怎样通过 Dot Product 和 Bias 产生原始 Logits，并手算 Softmax 与 Cross Entropy。',
    '沿同一批数据追踪 [3,3] → [3,2] → [3,2,4] → [3,2,5] → [6,5] → Scalar Loss。',
    '用 Bigram 跑通训练与生成，再说明它为什么需要 Attention 才能读取更早的上下文。',
  ],
  estimatedReadingMinutes: 100,
  sections: [
    section(
      'o0222-week-6',
      'Week 6 核心目标：把文字变成六道预测题',
      '语言模型无法直接对字符串做矩阵运算，也不能只给出一个模糊的续写；它需要在每个位置为全部候选 token 打分。',
      [
        '固定一组很小、可手算的文字、词表和维度，让每次 shape 变化都可追踪。',
        '先建立共同的训练与生成接口；后续替换 Bigram 为 Attention 时，接口仍然保留。',
      ],
      [
        paragraph(
          '本周始终使用同一个 tokenizer 规则：按空格切分。固定词表、语料和维度不随章节改变。训练时模型同时学习六个“当前 token → 真实下一 token”问题；生成时则一次只追加一个 token。',
        ),
        callout(
          '本周阅读方法',
          [
            paragraph(
              '不要先背公式。每遇到一个概念，依次问：没有它会遇到什么问题、它接收什么输入并产生什么输出、它在整条训练链的哪个位置。Softmax 数值稳定性与 Perplexity 属于进阶补充；第一次阅读可以先掌握主线。',
            ),
          ],
          'principle',
        ),
        table(['ID', 'Token'], vocabularyRows, '固定 Vocabulary（V=5）'),
        code(
          'text',
          `Corpus:
我 喜欢 AI
猫 喜欢 我
我 学习 AI

raw IDs = [[0,1,2], [4,1,0], [0,3,2]]
inputs  = [[0,1],   [4,1],   [0,3]]
targets = [[1,2],   [1,0],   [3,2]]`,
        ),
        table(
          ['符号', '固定值', '含义'],
          [
            ['B', '3', 'batch 中的三条 sequence'],
            ['N', '3', 'shift 前每条 source sequence 的 token 数'],
            ['T', '2', '右移后每条 sequence 的 next-token 训练位置'],
            ['C', '4', '每个 token embedding 的连续 features'],
            ['V', '5', 'Vocabulary candidates / 行数'],
          ],
        ),
        chain([
          'raw IDs [3,3]',
          'shifted inputs [3,2]',
          'embeddings [3,2,4]',
          'logits [3,2,5]',
          'flattened logits [6,5]',
          'flattened targets [6]',
          'scalar mean cross-entropy loss',
        ]),
      ],
      [
        '本周的 ID 是教学用地址，不是有大小关系的语义数值。',
        '训练同时监督全部 B×T 个位置；只有生成的当前轮只使用最后位置。',
      ],
      check('本周固定的六道预测题是什么？', [
        paragraph(
          '我→喜欢、喜欢→AI、猫→喜欢、喜欢→我、我→学习、学习→AI。它们来自同一三条语料各自右移一位后的两个位置。',
        ),
      ]),
    ),
    section(
      'o0223-1-token-id',
      '1. Token、Tokenizer、Vocabulary 与 Token ID',
      '模型不能直接对原始字符串做矩阵运算；同一句话必须先按一致规则拆分并编号。',
      [
        '区分处理单位、切分规则、允许清单和整数地址。',
        '能对固定 corpus 说明编码与解码，而不把 ID 当成语义大小。',
      ],
      [
        paragraph(
          'Token 是 Tokenizer 交给模型处理的基本单位，不一定是完整单词，也可能是字符、subword 或 byte。本周为了能手算，Tokenizer 按空格切分。Vocabulary 是它允许使用的有限 token 清单；Token ID 是某个 token 在这份清单中的整数地址。',
        ),
        paragraph(
          '同一段文字在不同 Tokenizer 下可能产生不同数量的 Token。例如 learning 可能是一个 Token，也可能拆成 learn 与 ing。模型一次读取和生成的是 Token；切分方式会影响 sequence length、context 能容纳多少文字，以及训练和推理需要多少计算。真实 GPT 常用 subword 或 byte-level 方法，Week 9 再详细展开。',
        ),
        table(
          ['原文', 'Tokens', 'IDs'],
          [
            ['我 喜欢 AI', '[我, 喜欢, AI]', '[0,1,2]'],
            ['猫 喜欢 我', '[猫, 喜欢, 我]', '[4,1,0]'],
            ['我 学习 AI', '[我, 学习, AI]', '[0,3,2]'],
          ],
          '同一 Tokenizer 下的完整编码',
        ),
        callout(
          '把四个词分开记',
          [
            list([
              'Token：实际交给模型的一个处理单位，例如“猫”。',
              'Tokenizer：切分、编码和解码的规则与程序。',
              'Vocabulary：可被编码的 token 清单。',
              'Token ID：token 在 Vocabulary 中的位置，例如 猫 的地址是 4。',
            ]),
          ],
          'concept',
        ),
      ],
      [
        'Token 不等于“单词”；单位由 Tokenizer 规则决定。',
        '猫=4、AI=2 不表示猫比 AI 大两倍。',
        'ID 负责寻址，不负责表达含义。',
      ],
      check('“猫 喜欢 我”为何编码为 [4,1,0]？ID 4 表达什么？', [
        paragraph(
          '因为 Vocabulary 中 猫 位于索引 4；4 只是地址，不是语义大小。',
        ),
      ]),
    ),
    section(
      'o0225-2-embedding',
      '2. 为什么 Token ID 还要变成 Embedding',
      'ID 解决了寻址，却没有有意义的距离、方向或连续特征；把整数当普通数会制造虚假的顺序关系。',
      [
        '理解 Embedding 是可学习的连续表示，并知道它位于输入和后续网络之间。',
        '把“地址”与“学习后会改变的 row”清楚分开。',
      ],
      [
        paragraph(
          'Embedding 把离散 ID 查成一个可学习的连续向量。这里的输入表是 nn.Embedding(V,C) = nn.Embedding(5,4)：五个 Vocabulary rows，每行四个 learned features。下面是明确标注的教学初始值，不是人工写好的词义。',
        ),
        paragraph(
          '如果直接把 ID 当普通数字，模型会被迫接受“猫=4 比 AI=2 大两倍”之类不存在的关系。ID 只回答去哪里查；Embedding 才提供后续神经网络可以组合、比较并通过 Gradient 微调的浮点特征。',
        ),
        table(
          ['ID / Token', 'c₀', 'c₁', 'c₂', 'c₃'],
          embeddingRows,
          'didactic initial value：E 的形状 [V,C]=[5,4]',
        ),
        formula(
          String.raw`E[\mathrm{token\_id}]\in\mathbb{R}^{4}`,
          'token_id 查出 E[token_id]，得到长度 C=4 的向量。',
        ),
        paragraph(
          '例如 我 选择 E[0]=[0.20,-0.10,0.70,0.30]；猫 选择 E[4]=[-0.70,0.40,0.30,0.60]。训练会经由 Loss、Backpropagation 和 Optimizer 修改这些坐标。',
        ),
        callout('地址与内容', [
          paragraph(
            'Token ID 像书架上的编号，Embedding 像从该位置取出的可修改资料卡。更换编号顺序不会改变词义；训练修改的是资料卡上的连续数值，而不是让 ID 3.2 之类的小数出现。',
          ),
        ]),
      ],
      [
        'Embedding 不是人工撰写的词义字典。',
        '单个坐标没有预先规定的“情感”或“动物”等名称。',
        '输入 ID=4 得到的是一个四维向量，不是标量 4。',
      ],
      check('输入 ID 4 后得到标量还是向量？', [
        paragraph('得到长度 C=4 的 E[4]，即 [-0.70,0.40,0.30,0.60]。'),
      ]),
    ),
    section(
      'o0228-3-embedding-matrix',
      '3. One-hot 等价与 [V,C] Embedding Matrix',
      'lookup 看似像魔法；同时初学者容易把 ID 当连续数或把矩阵两个轴写反。',
      [
        '用 one-hot 的矩阵乘法说明 direct lookup 的前向等价性。',
        '固定 [V,C]=[5,4] 中 rows 是 token、columns 是 feature。',
      ],
      [
        formula(
          String.raw`E\in\mathbb{R}^{V\times C}=\mathbb{R}^{5\times4}`,
          'E 的 row 轴大小 V=5，每行一个 token；column 轴大小 C=4，每列一个 learned feature。',
        ),
        table(
          ['ID / Token', 'c₀', 'c₁', 'c₂', 'c₃'],
          embeddingRows,
          '与第 2 节相同的 didactic initial value',
        ),
        code(
          'text',
          `one_hot(4) = [0,0,0,0,1]

one_hot(4) @ E
= E[4]
= [-0.70,0.40,0.30,0.60]

nn.Embedding(5,4).weight.shape == [5,4]`,
        ),
        paragraph(
          'One-hot 是选择机制：它只把第 4 row 选出来。实际实现不会创建长度 V 的巨大 one-hot vector，而是直接读取 E[id]；两者前向结果相同。',
        ),
      ],
      [
        'One-hot 不是最终的 learned representation。',
        '[V,C] 不能写反：rows 是 tokens，columns 是 features。',
        'V=5 不表示每个 embedding 有五维；本例每一 row 是 C=4 维。',
      ],
      check('AI 的 one-hot 与 lookup 结果是什么？', [
        paragraph('[0,0,1,0,0] @ E = E[2] = [-0.40,0.80,0.50,-0.30]。'),
      ]),
    ),
    section(
      'o0229-4-batch-embedding-shape',
      '4. 先看一个 Batch：B、T、C、V 分别在做什么',
      '单个 Token 的 lookup 已明确，但 `[B,T,C]` 很容易像一串没有现实对象的字母；必须先看清模型一次同时处理哪些题目。',
      [
        '从一条句子的两个预测题开始，再把三条互不混合的句子装进一个 Batch。',
        '区分 B、T、C、V 的职责，以及为什么 Embedding 只把 `[B,T]` 变成 `[B,T,C]`。',
      ],
      [
        paragraph(
          '先不要把 `[B,T,C]` 当作一条需要背诵的公式。它只是一个三层表格：先选第几条训练样本，再选这条样本中的第几个预测位置，最后取出该位置的一组连续数字。我们先从只有一条样本的情况开始。',
        ),
        code(
          'text',
          `一条语料：我 喜欢 AI

输入 IDs  = [0, 1]    shape [T] = [2]
目标 IDs  = [1, 2]    shape [T] = [2]

第 0 个位置：看到 我，预测 喜欢
第 1 个位置：看到 喜欢，预测 AI`,
        ),
        paragraph(
          '这里 T=2，表示这条样本当前提供两个 next-token 预测位置。原句有 N=3 个 Token；右移一位后才得到 T=N−1=2 个训练问题。T 不是固定常数，而是当前每条序列参加训练的位置数。',
        ),
        table(
          ['把一条样本放到 Batch 前', '它回答的问题'],
          [
            ['inputs[0] = 我', '喜欢'],
            ['inputs[1] = 喜欢', 'AI'],
          ],
          '先只有一条样本时，shape 只需读成 [T]。',
        ),
        paragraph(
          'Batch 的意思是：把多条独立样本放在同一个张量中，让 GPU/CPU 可以并行计算，再把所有预测的 Loss 取平均。它不是把三句话接成一长句话，也不表示第 0 条会把信息传给第 1 条；在本课的 Transformer 中，不同 batch 样本之间不会互相 Attention。',
        ),
        callout('为什么不永远一条一条训练？', [
          paragraph(
            '一条一条计算在数学上可以成立，但硬件每次只做很少工作，速度较慢，而且一次更新只听到一条样本的意见。Batch 把多条样本的计算排成规则矩阵，一次完成；六道题各自产生一个 Loss，再取平均形成这一步的训练目标。这样通常能更有效地利用硬件，也让一次 Gradient 不完全由单个样本决定。',
          ),
          list([
            'B 只控制这一步同时装入多少条样本；它不是 Tokenizer 学到的知识，也不是某句话的长度。',
            '增大 B 通常会占用更多内存，并让平均 Gradient 更稳定，但不表示模型自动更聪明。',
            '推理时 B 可以是 1，表示只处理一个请求；也可以大于 1，表示并行处理多个请求。',
          ]),
        ]),
        code(
          'text',
          `B = 3：这一次同时处理三条独立语料

inputs [B,T] = [[0,1],   [4,1],   [0,3]]    # shape [3,2]
targets[B,T] = [[1,2],   [1,0],   [3,2]]    # shape [3,2]

b=0：我 → 喜欢；喜欢 → AI
b=1：猫 → 喜欢；喜欢 → 我
b=2：我 → 学习；学习 → AI`,
        ),
        table(
          ['符号', '本例数值', '它在现实中数什么', '此时的读法'],
          [
            ['B', '3', 'Batch 中有几条独立样本', '先选哪一条句子'],
            ['T', '2', '每条样本有几个预测位置', '再选这条句子的哪个位置'],
            ['B×T', '6', '本次训练一共有几道 next-token 题', '三个样本各两题'],
          ],
          '所以 `[B,T]=[3,2]` 应读成“三条样本 × 每条两个预测位置”，不是“六个 Token 串成一句话”。',
        ),
        paragraph(
          '现在才把 Embedding 接上。`inputs[b,t]` 仍然只是一个整数地址；Embedding 为每一个地址查出长度为 C 的浮点向量。B 和 T 都保留，因为我们仍要知道“哪条样本、哪个位置”；只是在最后新增一个 C 轴，记录这个位置的内部表示。',
        ),
        callout('为什么一个位置需要 C 个数，而不是一个数？', [
          paragraph(
            '单个 Token ID 只是地址，不能表达模型之后可能需要的多种差异。把一个位置表示成 C 个可学习数，相当于给后续网络一组可组合的内部信号：线性层可以重新加权它们，Attention 可以根据它们计算匹配，训练也可以分别调整不同方向。C 越大，模型可用的表示空间通常越宽，但参数量与计算量也会增加；C 大并不保证训练正确或内容可靠。',
          ),
        ]),
        code(
          'text',
          `Embedding table E 的 shape 是 [V,C] = [5,4]

inputs[0,1] = 1                  # 第 0 条样本、第 1 个位置是 “喜欢”
x[0,1,:] = E[1]                 # 取出它的全部 C=4 个数
         = [0.60, 0.30,-0.20,0.10]

[B,T] --Embedding--> [B,T,C]
[3,2]  ------------> [3,2,4]`,
        ),
        paragraph(
          '`x[b,t,:]` 中的冒号表示“这个位置的所有 C 个特征”。例如 `x[1,0,:]` 是第 1 条样本里的“猫”所对应的四个数。C 可以理解为模型给每个位置留出的表示宽度；这里故意设为 4 便于手算，真实模型通常会大得多。单个坐标本身没有预先命名的词义，训练会调整它们。',
        ),
        code(
          'text',
          `x.shape       = [3,2,4]   # 三个 axis，rank=3
x[1].shape    = [2,4]     # 取第 1 条样本，还剩两个位置、每处四个数
x[1,0].shape  = [4]       # 再取第 0 个位置，得到“猫”的完整表示
x[1,0,2]      = 0.30      # 再取第 2 个 feature，最终得到一个标量

b：选择哪条样本
t：选择样本中的哪个位置
c：选择该位置内部表示的哪个坐标`,
        ),
        paragraph(
          'axis 可以理解为“沿哪个问题继续索引”，axis size 则是这个问题有多少个选择。`[3,2,4]` 的 rank 是 3，因为需要回答 b、t、c 三层问题；它有 3×2×4=24 个标量。rank=3 不表示只有三个数。',
        ),
        table(
          ['符号', '本例', '它的职责', '出现在哪个 shape 中'],
          [
            ['B', '3', '一次并行处理几条独立样本', '[B,T]、[B,T,C]、[B,T,V]'],
            ['T', '2', '每条样本当前有几个预测位置', '[B,T]、[B,T,C]、[B,T,V]'],
            ['C', '4', '每个位置的内部连续表示有多宽', 'Embedding [V,C] 与表示 [B,T,C]'],
            [
              'V',
              '5',
              '词表中有几个候选 Token；它不是输入 x 的额外特征',
              'Embedding [V,C] 的 row 数；之后的 Logits [B,T,V]',
            ],
          ],
        ),
        callout('为什么 V 既出现在 Embedding，又出现在输出？', [
          paragraph(
            '输入时，Vocabulary 中有 V=5 个 Token，所以 Embedding Matrix 必须有五行，模型根据一个 ID 只取其中一行。输出时，模型还不知道正确答案是哪一个，因此必须对五个候选全部打分；Output Head 把一个 C 维内部表示映射成 V 个 Logits，Softmax 才能在这五个候选之间形成概率分布。输入是“选一行”，输出是“给所有候选打分”，两处都使用 V，但工作不同。',
          ),
        ]),
        table(
          ['如果改变', '直观变化', '主要影响'],
          [
            ['B：3 → 1', '每一步只装入一条样本', '模型结构不变；并行量、内存和一次 Gradient 使用的样本数改变'],
            ['T：2 → 4', '每条样本保留四个有顺序的位置', '能处理更长的当前窗口；Attention 的位置间计算也会增加'],
            ['C：4 → 8', '每个位置从四个内部数扩为八个', '表示宽度、相关权重矩阵、参数量和计算量改变'],
            ['V：5 → 10', '词表有十个 Token 候选', 'Embedding row 数和每个位置的输出 Logit 数都变为十个'],
          ],
          'B 是本次装入多少样本；T、C 与 V 则分别约束位置长度、模型表示宽度和词表接口。',
        ),
        callout('最重要的区分：B、T、C、V 不是一个 `[B,T,C,V]` 张量', [
          paragraph(
            'Embedding/Transformer 的中间表示是 `[B,T,C]`：每个位置有 C 个内部特征。稍后的 Output Head 会把每个 C 维表示转换为 V 个候选 Token 的原始分数，得到 `[B,T,V]`。也就是说，C 用于“模型内部怎样表示这个位置”，V 用于“现在为哪些 Token 候选打分”。',
          ),
        ]),
        code(
          'text',
          `Token IDs                 [B,T] = [3,2]  每格是一个整数地址
Embedding / context state  [B,T,C] = [3,2,4]  每格是一组 4 个内部特征
Output logits              [B,T,V] = [3,2,5]  每格是对 5 个 Token 的分数`,
        ),
      ],
      [
        'B=3 表示三条彼此独立的样本，不表示一条句子有三个位置。',
        'Embedding 不改变 B 或 T，只把每个整数 ID 展开为 C 个连续特征。',
        '`[B,T,C]` 的 C 不是候选词数量；候选词数量 V 会在 Logits 的 `[B,T,V]` 中出现。',
      ],
      check('本例中 `x[1,0,:]` 是什么？为什么一次训练有六道题，而不是一条六个 Token 的句子？', [
        paragraph('它是第 1 条独立样本中“猫”的 Embedding row：[-0.70,0.40,0.30,0.60]。B=3 条样本、每条 T=2 个预测位置，所以共有 B×T=6 道题；Batch 只是并行装载独立样本，并没有把它们拼成同一条句子。整个 x 的标量数为 3×2×4=24。'),
      ]),
    ),
    section(
      'o0230-5-embedding',
      '5. 先看完整路线：六个位置怎样走到一个 Loss',
      '上一节解释了 Batch 与 `[B,T,C]`，但还没有回答“每个位置怎样变成一道有分数的题”。这一节先追踪一道题，再把同样过程扩展到六道题和一个平均 Loss。',
      [
        '能指出一道 next-token 题的输入位置、五个候选分数、正确 Target 和单题 Loss。',
        '理解 `[3,2,5] → [6,5]` 只是重新排列六道题，没有把不同句子的上下文混合。',
        '理解六个单题 Loss 为什么要汇总为一个 Scalar Mean Loss。',
      ],
      [
        paragraph(
          '上一节已经得到 inputs `[3,2]` 和 Embeddings `[3,2,4]`。其中每个 `[b,t]` 都是一道独立的 next-token 题：b 选择哪条样本，t 选择这条样本的哪个位置。模型必须在 Vocabulary 的五个候选中，为这道题的正确 Target 给出更高概率。',
        ),
        callout('先只追踪一道题：`[b=0,t=0]`', [
          paragraph(
            '第 0 条样本是“我 喜欢 AI”。在第 0 个位置，输入是“我”，正确答案是“喜欢”。前面已经把“我”查成四个数；模型接着整理当前可见信息，并为五个候选分别打分。',
          ),
          table(
            ['阶段', '这道题里的具体对象', '它现在表示什么'],
            [
              ['Input ID', '`inputs[0,0]=0`', '当前读到 Token“我”'],
              [
                'Embedding',
                '`x[0,0,:]=[0.20,-0.10,0.70,0.30]`',
                '“我”在模型内部的四个输入特征',
              ],
              [
                'Context Representation',
                '`h[0,0,:]`，仍有 C=4 个数',
                '结合当前位置允许看到的内容后，整理出的内部证据',
              ],
              [
                'Logits',
                '`z[0,0,:]=[0,2,1,-1,0]`',
                '按 `[我,喜欢,AI,学习,猫]` 顺序给五个候选的原始分',
              ],
              [
                'Target',
                '`targets[0,0]=1`',
                '正确答案 ID=1，也就是“喜欢”',
              ],
              [
                'Probability',
                '“喜欢”约为 0.5923',
                'Softmax 后，模型给正确答案约 59.23% 的概率',
              ],
              [
                'Single-position Loss',
                '`−ln(0.5923)≈0.5237`',
                '只衡量这一道题；正确答案概率越高，它越小',
              ],
            ],
            '下面会把这一题完整算一遍；第 9–11 节再分别深入解释 Logit、Softmax 和 Cross Entropy。',
          ),
          paragraph(
            '现在把这条路线真正算一遍。先看最容易混淆的 Context Representation。Embedding `x[0,0,:]` 是输入 Token“我”的初始表示；Context Representation `h[0,0,:]` 则是模型为了回答“下一个 Token 是什么”而整理好的工作向量。它们的 Shape 都是 `[C]=[4]`，但职责不同：x 是刚查表得到的起点，h 是上下文模型处理后的结果。',
          ),
          callout('本节怎样计算 Context Representation？', [
            paragraph(
              '为了先把评分和概率算清楚，本节对第一个位置使用最简单的 identity context rule：上下文模型暂时不改变向量，所以 `h=x`。第一个位置只能看到“我”，因此这里直接得到 h=[0.20,−0.10,0.70,0.30]。这不是说所有语言模型都只复制 Embedding；它只是一个可手算的最小上下文模型。',
            ),
            code(
              'text',
              `x[0,0,:] = [0.20,-0.10,0.70,0.30]   # “我”的 Input Embedding

identity context rule:
h[0,0,:] = x[0,0,:]
         = [0.20,-0.10,0.70,0.30]   # 当前题目的 Context Representation`,
            ),
            paragraph(
              '如果当前位置是“我 喜欢”中的第二个位置，真正的 Transformer 会让 h 同时吸收“我”和“喜欢”的信息。Week 7 会用 Attention 计算“各读多少”，Week 8 再用 FFN、Residual 和 LayerNorm 继续加工。无论内部过程多复杂，最后都要为当前位置交出一个长度 C 的 h，供 Output Head 打分。',
            ),
          ]),
          callout('Output Head 是什么？', [
            callout('这里的 h 到底指什么？', [
              paragraph(
                '大写 H 表示整个 Batch 所有位置的 Context Representations，Shape 是 [B,T,C]=[3,2,4]。小写 h 表示从 H 中取出的某一个位置：h=H[b,t,:]，Shape 是 [C]=[4]。所以 h 不是 Token ID、不是 Probability，也不是一组固定不变的模型参数；它是模型针对当前样本、当前位置临时计算出的内部状态。',
              ),
              code(
                'text',
                `H.shape = [3,2,4]             # 六个位置各有一个长度 4 的上下文向量

h = H[0,0,:]                   # 只取第 0 条样本、第 0 个位置
  = [0.20,-0.10,0.70,0.30]    # 当前题“我 → 喜欢”的 h

H[0,1,:]                       # “我 喜欢 → AI”会有另一个 h
H[1,1,:]                       # “猫 喜欢 → 我”也会有另一个 h`,
              ),
              paragraph(
                'h 的来源始终是当前输入，而不是 Output Head 自己生成：Token ID 先通过 Embedding 变成 x；Context Model 再处理当前位置允许看到的 x，产生 h。完整 Transformer 中，Context Model 包含 Attention、Residual、LayerNorm 和 FFN。Attention 负责从同一条样本的可见位置读取信息，后续层再加工，最终留下一个长度仍为 C 的向量。',
              ),
              chain([
                '当前位置及其可见的 Token IDs',
                'Embedding 得到输入向量 x',
                'Context Model 读取并整理允许看到的上下文',
                '得到该位置的 h=H[b,t,:]',
                'Output Head 使用 h 给全部候选打分',
              ]),
              paragraph(
                '本节为了专注评分计算，在 [0,0] 使用 identity context rule，所以 h 恰好等于“我”的 Input Embedding。这只是本例的简化。到了第二个位置，模型面对“我 喜欢”；真实 Transformer 产生的 h 通常已经包含两个可见 Token 的信息，不再等于“喜欢”的原始 Embedding。',
              ),
            ]),
            paragraph(
              'Transformer 前面的层负责把当前可见内容整理成 Context Representation h；Output Head 是接在这些内部表示最后面的“输出评分层”。这里的 Head 可以理解成“为某个最终任务接上的输出接口”。语言模型的任务是预测下一个 Token，所以它的 Output Head 必须把长度 C 的 h 转换成长度 V 的候选分数。',
            ),
            chain([
              '模型内部表示 h：[C]=[4]',
              'Output Head 读取同一组四项证据',
              '分别套用 V=5 套候选评分规则',
              '输出五个 Logits：[V]=[5]',
            ]),
            paragraph(
              '可以把它想成五位评分员：对于当前这一道 [b,t] 预测题，五位评分员看到的是同一个 h=H[b,t,:]，因为要比较的上下文必须保持一致；不同的是每位评分员各自的 Weight 和 Bias。“喜欢”评分员可能重视 h 的第 2、3 项，“AI”评分员可能采用另一组权重。五位评分员各给一个原始分，合起来才是五个 Logits。换到下一道题时，模型会改用那个位置自己的 h，再让同一组五位评分员重新打分。',
            ),
            table(
              ['Output Head 内部参数', '本例 Shape', '意义'],
              [
                [
                  'Output Weight Matrix W_out',
                  '[V,C]=[5,4]',
                  '五行对应五个候选；每行四个数说明该候选怎样读取 h 的四项证据',
                ],
                [
                  'Output Bias b_out',
                  '[V]=[5]',
                  '每个候选各有一个基础评分偏移',
                ],
                [
                  '输入 h',
                  '[C]=[4]',
                  '当前位置整理好的上下文证据',
                ],
                [
                  '输出 z',
                  '[V]=[5]',
                  '五个候选的原始 Logits',
                ],
              ],
            ),
            formula(
              String.raw`z=W_{\mathrm{out}}h+b_{\mathrm{out}}`,
              '[5,4] 的 Output Weight Matrix 乘 [4] 的 h，再加 [5] Bias，得到 [5] Logits。',
            ),
            callout('Output Head 不负责什么？', [
              list([
                '它不直接选择最终 Token；它只产生 Logits，Softmax 和 sampling/argmax 才处理后续选择。',
                '它不把文字直接变成向量；输入侧的 Embedding 负责用 Token ID 查出初始表示。',
                '它不是人工编写的语言规则；W_out 和 b_out 是训练时通过 Gradient 学到的 Parameters。',
              ]),
            ]),
            paragraph(
              'Embedding Matrix 和 Output Weight Matrix 在本例中都是 [V,C]=[5,4]，但方向相反：Embedding 用一个 ID 从 V 行中选一行，得到 C 个输入特征；Output Head 接收 C 个上下文特征，同时计算 V 个候选分数。某些大模型会让二者共享参数，称为 weight tying；本课程的主例先保持它们独立，避免混淆两条职责。',
            ),
            formula(
              String.raw`H:[B,T,C]\xrightarrow{\text{Output Head}}Z:[B,T,V]`,
              '同一套 Output Head 会重复应用于 Batch 中每一个 [b,t] 位置；它不会让不同位置互相读取。',
            ),
          ]),
          paragraph(
            '接着计算 Logit。Logit 是候选 Token 的原始评分，不是概率。对于当前 [0,0] 这一道题，先固定它的 h=[0.20,−0.10,0.70,0.30]；Vocabulary 中每个候选再用自己的一组四个 Output Weights 和一个 Bias，与这个 h 做点积。这里“同一个 h”只限定在当前这一道题内，意思是五个候选在同一份上下文证据上公平比较。',
          ),
          formula(
            String.raw`z_i=w_i\cdot h+b_i=\sum_{c=0}^{3}w_{i,c}h_c+b_i`,
            '候选 i 的四个 weights 分别乘 h 的四个 features，全部相加后再加该候选的 bias。',
          ),
          table(
            ['候选 i', 'wᵢ', 'bᵢ', '完整计算', 'Logit zᵢ'],
            [
              ['我', '[1,0,0,0]', '−0.2', '1×0.20−0.20', '0'],
              [
                '喜欢',
                '[0,1,2,2]',
                '0.1',
                '0×0.20+1×(−0.10)+2×0.70+2×0.30+0.10',
                '2',
              ],
              ['AI', '[0,0,1,1]', '0', '1×0.70+1×0.30', '1'],
              ['学习', '[0,3,−1,0]', '0', '3×(−0.10)−1×0.70', '−1'],
              ['猫', '[1,2,0,0]', '0', '1×0.20+2×(−0.10)', '0'],
            ],
            '五套评分规则使用同一个 h，最终按固定 Vocabulary 顺序得到 [0,2,1,−1,0]。',
          ),
          paragraph(
            '为什么不能把 Logit=2 直接读成 200%？因为 Logit 可以是任意实数，也可以为负，而且五个 Logits 不会自动相加为 1。它们只表示候选之间的相对支持程度。Softmax 才负责把这五个分数一起转换成合法 Probability。',
          ),
          formula(
            String.raw`p_i=\frac{e^{z_i}}{\sum_j e^{z_j}}`,
            '每个候选先计算自己的指数权重，再除以五个候选指数权重的总和。',
          ),
          table(
            ['候选', 'Logit zᵢ', '指数权重 eᶻⁱ', '除以共同总和 12.475', 'Probability'],
            [
              ['我', '0', 'e⁰=1.000', '1.000÷12.475', '0.0802'],
              ['喜欢', '2', 'e²≈7.389', '7.389÷12.475', '0.5923'],
              ['AI', '1', 'e¹≈2.718', '2.718÷12.475', '0.2179'],
              ['学习', '−1', 'e⁻¹≈0.368', '0.368÷12.475', '0.0295'],
              ['猫', '0', 'e⁰=1.000', '1.000÷12.475', '0.0802'],
            ],
            '共同分母：1.000+7.389+2.718+0.368+1.000=12.475。概率因四舍五入相加约为 1。',
          ),
          paragraph(
            '这一题的 Target ID 是 1，也就是“喜欢”，所以计算 Loss 时只读取正确候选的概率 0.5923。Cross Entropy 使用 `−ln(p_correct)`：概率越接近 1，Loss 越接近 0；正确答案概率越小，惩罚越大。',
          ),
          code(
            'text',
            `正确 Target = 喜欢 / ID 1
p_correct   = 0.5923

single-position loss
= -ln(0.5923)
≈ 0.5237`,
          ),
          callout('这一道题的完整因果链', [
            chain([
              '输入“我”的 ID 0',
              '查到 Embedding [0.20,−0.10,0.70,0.30]',
              '最小 context rule 得到 h=[0.20,−0.10,0.70,0.30]',
              '五套评分参数得到 Logits [0,2,1,−1,0]',
              'Softmax 得到 Probabilities [0.0802,0.5923,0.2179,0.0295,0.0802]',
              '读取正确候选“喜欢”的 0.5923',
              '得到这一位置的 Loss≈0.5237',
            ]),
          ]),
        ]),
        paragraph(
          '另外五个 `[b,t]` 位置也执行完全相同的过程，只是输入、可见上下文和 Target 不同。因此“六个位置”不是六个 Feature，也不是一句六词长句，而是同一次 Batch 中的六道分类题。',
        ),
        table(
          ['题号', '原坐标 [b,t]', '当前输入', '正确 Target ID / Token'],
          [
            ['0', '[0,0]', '我', '1 / 喜欢'],
            ['1', '[0,1]', '喜欢', '2 / AI'],
            ['2', '[1,0]', '猫', '1 / 喜欢'],
            ['3', '[1,1]', '喜欢', '0 / 我'],
            ['4', '[2,0]', '我', '3 / 学习'],
            ['5', '[2,1]', '学习', '2 / AI'],
          ],
          '`B×T=3×2=6`；每一行都有五个候选分数，但只有一个本课硬标签 Target。',
        ),
        callout('Flatten 只是把题目排成六行', [
          paragraph(
            '`[3,2,5]` 可以想成“三组，每组两道题，每道题五个分数”。Cross Entropy 更方便接收“六道题，每道五个分数”，所以把前两个轴排成一列，得到 `[6,5]`。Targets 同样从 `[3,2]` 排成 `[6]`。数值和题目对应关系都没有改变，更没有让不同句子互相读取。',
          ),
          code(
            'text',
            `Logits [3,2,5]                 Logits [6,5]

[0,0,:] 第 0 题的五个分数  ───────→ row 0
[0,1,:] 第 1 题的五个分数  ───────→ row 1
[1,0,:] 第 2 题的五个分数  ───────→ row 2
[1,1,:] 第 3 题的五个分数  ───────→ row 3
[2,0,:] 第 4 题的五个分数  ───────→ row 4
[2,1,:] 第 5 题的五个分数  ───────→ row 5

Targets [3,2] = [[1,2],[1,0],[3,2]]
Targets [6]   = [1,2,1,0,3,2]`,
          ),
        ]),
        callout('为什么最后只留下一个 Loss？', [
          paragraph(
            'Cross Entropy 先为六道题分别计算 Loss，再取平均。假设六个单题 Loss 依次是 0.52、0.80、0.65、1.10、0.90、0.60，那么总和是 4.57，Mean Loss 就是 4.57÷6≈0.762。这里的数字只用于演示“怎样汇总”，不是本模型六个位置的实际输出。',
          ),
          formula(
            String.raw`L_{\text{batch}}=\frac{L_0+L_1+L_2+L_3+L_4+L_5}{6}`,
            '一个 Scalar Mean Loss 同时代表这一步六道题的平均表现；每道题仍保留自己的计算路径。',
          ),
          paragraph(
            '训练需要一个明确的共同目标，Backward 才能计算“哪些参数的变化会让这个平均值下降”。取平均也让 Loss 的尺度不会仅仅因为 Batch 放入更多题目就成倍增大。它不会把六道题的答案平均成一个 Token。',
          ),
        ]),
        paragraph(
          '现在再看完整路线，应该把它读成：先准备六道题，为每道题产生五个候选分数，各自对照正确 Target 得到一个 Loss，最后才把六个 Loss 平均成训练目标。后续章节会逐项推导中间数值。',
        ),
        chain([
          '文字按 Tokenizer 编码为 raw IDs [3,3]',
          '右移得到 inputs [3,2] 与 targets [3,2]',
          'inputs lookup 得到 Embeddings [3,2,4]',
          'Context Model 整理每个位置的上下文特征 [3,2,4]',
          'Output Head 为五个候选打分，得到 Logits [3,2,5]',
          '把六道题排成 Logits [6,5] 与 Targets [6]',
          'Cross Entropy 得到一个 Scalar Mean Loss',
          'Backward 计算 Gradients，Optimizer 更新 Parameters',
        ]),
        table(
          ['阶段', 'Shape', '此时回答的问题'],
          [
            ['Token IDs', '[3,2]', '每个输入位置是哪一个 Token？'],
            ['Embeddings', '[3,2,4]', '每个 Token 用哪些连续特征表示？'],
            [
              'Context Representation',
              '[3,2,4]',
              '结合当前可见上下文后，每个位置包含哪些内部证据？',
            ],
            ['Logits', '[3,2,5]', '每个位置怎样给五个候选打原始分？'],
            [
              'Flattened Questions',
              '[6,5] 与 [6]',
              '六道题各有哪些分数和正确 ID？',
            ],
            ['Mean Loss', 'scalar', '整个 batch 的预测平均有多差？'],
          ],
        ),
        code(
          'text',
          `这一节只先记住：

ID 是地址
Embedding 是输入特征
Context Representation 是整理后的上下文证据
Logit 是每个候选的原始分数
Softmax 把相对分数变成概率
Cross Entropy 把正确答案的概率变成 Loss`,
        ),
        callout('先不要提前背公式', [
          paragraph(
            '此时只需知道 Loss 最终会提供学习信号。等第 9 至 14 节解释 Logit、Softmax、Cross Entropy 和 Backward 后，再回看 Parameter Update，就能知道 Gradient 从哪里来，而不是只记一条更新公式。',
          ),
        ]),
      ],
      [
        '一个 `[b,t]` 对应一道 next-token 题；B×T=6，所以本次共有六道题。',
        '每道题有 V=5 个 Logits 和一个正确 Target，不是五个 Targets。',
        'Flatten 只改变排列方式，不改变题目、上下文或数值。',
        '不要把 [3,2,4] 中的 C=4 与 [3,2,5] 中的 V=5 混为一谈。',
        'Logit 还不是 Probability；Softmax 之后才得到总和为 1 的分布。',
        'Mean Loss 是六个单题 Loss 的平均训练目标，不是模型生成的新 Token。',
      ],
      check('`[3,2,5]` 为什么可以变成 `[6,5]`？最终 Scalar Loss 又来自哪里？', [
        paragraph(
          '因为前三个维度表示 3 条样本、每条 2 道题、每题 5 个候选分数。把前两个轴依次排开，就得到 6 行、每行 5 个分数；Targets 也按相同顺序排成 6 个正确 ID。Cross Entropy 先得到六个单题 Loss，再取平均形成一个 Scalar Loss。',
        ),
      ]),
    ),
    section(
      'o0232-6-language-model',
      '6. Language Model：这五个 Probability 到底在回答什么？',
      '上一节已经算出 p=Softmax(z)。这一节只解释它在语言上的含义：模型不是给整句话一个分数，而是在每个位置回答一个“下一个 Token 会是什么”的条件概率问题。',
      [
        '区分 P、pᵢ、Logit z 与 Context Representation h：它们分别表示什么，而不是只会背公式。',
        '把一个 Batch 中的六个位置读成六道具体的 next-token 概率题。',
        '区分 Transformer 使用完整左侧上下文的预测，与 Bigram 只看当前 Token 的简化预测。',
      ],
      [
        paragraph(
          '上一节追踪了 [0,0] 的一题：可见文字是“我”，正确下一 Token 是“喜欢”。该位置先有一个上下文表示 h，再经过 Output Head 得到 Logits z=[0,2,1,−1,0]，最后经过 Softmax 得到 p=[0.0802,0.5923,0.2179,0.0295,0.0802]。这一节不重复计算点积或指数；现在要回答的是：这五个数字在语言上各自是什么意思？',
        ),
        callout('先把 P 与 pᵢ 分开读', [
          table(
            ['符号', '读法', '在本例中表示什么'],
            [
              ['P(…)', '“某事件的概率”这一种写法', '模型对“下一个 Token 是什么”的条件概率规则。'],
              ['p', '一个完整的概率分布向量', '五个候选按 Vocabulary 顺序的概率：[0.0802,0.5923,0.2179,0.0295,0.0802]。'],
              ['pᵢ', 'p 的第 i 个数', '候选 i 单独成为下一个 Token 的概率。'],
              ['z', 'Logits 向量', 'Softmax 之前的五个原始分数；它们不是概率。'],
              ['h', '当前位置的 Context Representation', '模型从允许看到的文字整理出的内部证据；它不是 Token ID，也不是概率。'],
            ],
          ),
          formula(
            String.raw`p=\operatorname{Softmax}(z),\qquad p_i=P(\text{next token}=i\mid\text{visible context})`,
            'p 是 Softmax 计算出的整组概率；pᵢ 是其中一个候选的概率。右边的 P(…) 是同一件事的语言模型写法。',
          ),
          paragraph(
            '例如 Vocabulary 的 ID 1 是“喜欢”，本例就可以写成 p_喜欢=P(下一个 Token=喜欢｜已经看到“我”)=0.5923。它不是“喜欢这个词有 59.23% 的普遍概率”，而是在这一份可见上下文下，五个候选之间的相对可能性。',
          ),
        ]),
        formula(
          String.raw`P(x_{t+1}\mid x_{\le t})`,
          '给定从开头到当前位置 t 的所有允许可见 Token，预测紧接着的下一 Token。',
        ),
        table(
          ['公式部分', '这里的意思', '用“我 喜欢 AI”举例'],
          [
            ['x', '一串 Token（实现时通常是一串 Token IDs）', '“我”“喜欢”“AI”依次是 x₀、x₁、x₂。'],
            ['t', '当前正在给哪一个位置出题', '若 t=1，模型已经看到了位置 0 和 1。'],
            ['x≤t', '从开始到 t 的可见前缀', 'x≤1 就是“我 喜欢”。'],
            ['｜', '“在已知……的条件下”', '不是除法；读成“已知我喜欢之后”。'],
            ['P', '模型输出的概率规则', 'P(AI｜我喜欢) 是模型给“AI”作为下一 Token 的概率。'],
          ],
          '这里默认 causal language model：当前位置只能使用左侧（含当前位置）信息，不能偷看右侧的 Target。',
        ),
        paragraph(
          '所以 P(xₜ₊₁｜x≤ₜ) 读成：“已经看过前缀 x≤ₜ 后，下一个 Token xₜ₊₁ 的概率是多少？”模型实际一次不会只返回一个数字；它会返回对整个 Vocabulary 的分布 p。我们只从这个分布中取出正确 Target 对应的 pᵢ，交给 Cross Entropy 打分。',
        ),
        callout('同一个 Batch 的六道概率题', [
          paragraph(
            '本例 Batch 有 3 条样本、每条取 2 个预测位置，所以 B×T=3×2=6。每个 [b,t] 都有自己的可见上下文、自己的 p 向量和自己的正确 Target。为了把“取正确概率再算 Loss”看清楚，下表为六题固定了一组教学用 Logits；第 0 行与第 5 节完全相同，其余行是用于练习流程的示意数值，并非宣称来自一个已训练模型。',
          ),
          table(
            ['位置 [b,t]', '可见上下文', '正确 Target', '这一题询问的概率', '本行具体计算'],
            [
              [
                '[0,0]',
                '我',
                '喜欢 / ID 1',
                'P(喜欢｜我)',
                'z=[0,2,1,−1,0] → p₁=0.5923 → −ln(0.5923)=0.5237',
              ],
              [
                '[0,1]',
                '我 喜欢',
                'AI / ID 2',
                'P(AI｜我 喜欢)',
                'z=[0,1,2,−1,0] → p₂=0.5923 → −ln(0.5923)=0.5237',
              ],
              [
                '[1,0]',
                '猫',
                '喜欢 / ID 1',
                'P(喜欢｜猫)',
                'z=[0,1.5,0.5,−0.5,0] → p₁=0.5130 → −ln(0.5130)=0.6676',
              ],
              [
                '[1,1]',
                '猫 喜欢',
                '我 / ID 0',
                'P(我｜猫 喜欢)',
                'z=[2,0.5,0,−1,0] → p₀=0.6478 → −ln(0.6478)=0.4341',
              ],
              [
                '[2,0]',
                '我',
                '学习 / ID 3',
                'P(学习｜我)',
                'z=[0,0,0,1,0] → p₃=0.4046 → −ln(0.4046)=0.9048',
              ],
              [
                '[2,1]',
                '我 学习',
                'AI / ID 2',
                'P(AI｜我 学习)',
                'z=[0,0,2,0,−1] → p₂=0.6869 → −ln(0.6869)=0.3756',
              ],
            ],
            '每行先对五个 Logits 做 Softmax，得到五个概率；Cross Entropy 只按 Target ID 取 pᵢ，再计算 −ln(pᵢ)。例如 [2,0] 的正确 ID 是 3，所以即使其它候选也有概率，Loss 只读取 p₃=0.4046。',
          ),
        ]),
        callout('h 通常不是“当前 Token 的原始 Embedding”', [
          paragraph(
            '原始 Embedding xₜ 只是当前 Token ID 查表得到的起点。例如“喜欢”的 ID 查到一个 [C] 向量，这个向量还没有读取左侧文字。Context Model 再把当前可见前缀处理成 hₜ：在 Transformer 中，Attention 让位置 t 读取允许看到的前缀，Residual、LayerNorm 和 FFN 继续改造表示，最终得到 hₜ。于是更准确的关系是 hₜ=f(x≤ₜ)，而不是 hₜ=xₜ。',
          ),
          paragraph(
            '第 5 节为了把一题算完，特意在第一个位置使用最小规则 h=x；那是教学简化，不是完整 Transformer 的通用结论。这个区别很重要：两个位置都出现“喜欢”时，原始 Embedding 一样，但“我 喜欢”和“猫 喜欢”给出的 h 可以不同，后面的 Logits 与概率也就可以不同。',
          ),
        ]),
        callout('Transformer 与 Bigram 分别记住多少上下文？', [
          table(
            ['模型', '先得到什么', '它实际表达的条件概率'],
            [
              ['Transformer Language Model', 'hₜ=f(x≤ₜ)，由完整可见前缀产生 Context Representation', 'P(next｜完整可见前缀)'],
              ['本课 Bigram', '直接用当前 Token ID 查一行 next-token Logits，不显式构造丰富的 h', 'P(next｜当前 Token)'],
            ],
          ),
          paragraph(
            '因此 Bigram 遇到两个“喜欢”时，会查到同一行分数，无法根据前面是“我”还是“猫”改变预测；它是故意缩小的入门模型。Transformer 的价值正是让 h 携带更长的、与当前位置有关的上下文。',
          ),
        ]),
        paragraph(
          '现在可以把主链严格地读成：先由 Context Model 得到 h；再由 Output Head 计算 z=W_out h+b_out；最后由 p=Softmax(z) 得到每个候选的条件概率。h 是“根据上下文整理出的证据”，z 是“尚未归一化的候选分数”，p 才是“可用于回答下一 Token 概率”的分布。',
        ),
      ],
      [
        'P(…｜…) 描述“在已知可见上下文时”的条件概率；｜不是除法。',
        'p=Softmax(z) 是完整分布，pᵢ 是其中一个候选的概率；Logit z 本身不是概率。',
        '完整 Transformer 中 hₜ=f(x≤ₜ)，通常不是当前 Token 的原始 Embedding xₜ。',
        '每个 [b,t] 是一题独立的 next-token 分类题；高 Probability 只表示更符合模型学到的模式，不保证内容真实。',
      ],
      check('P(AI｜我 喜欢) 在问什么？它与 p、z、h 分别怎样相连？', [
        paragraph(
          '它问：“已经看到‘我 喜欢’时，下一 Token 是 AI 的概率是多少？”模型先把可见前缀处理为 h，再由 Output Head 算出全部 Logits z=W_out h+b_out，随后 p=Softmax(z)。p 中 ID 为 AI 的那一项就是 P(AI｜我 喜欢)。其中 h 是上下文表示，z 是原始分数，p 才是概率。',
        ),
      ]),
    ),
    section(
      'o0234-7-autoregressive',
      '7. Autoregressive：选一个 Token，把它追加后再预测',
      '模型一次只能回答“下一个 Token 是什么”。要生成一句更长的话，必须把本轮选出的 Token 放回输入末尾，再让模型面对这个更新后的上下文。',
      [
        '准确说明 append（追加）的是哪个数、追加到哪里，以及为什么不追加就无法连续生成。',
        '用“我 → 喜欢 → AI”走完两轮真实的“输入 → 概率 → 选择 → 追加”过程。',
        '区分 argmax 和 sampling：它们都使用同一组概率，但选 Token 的规则不同。',
        '理解训练为何可以并行给所有位置打分，而生成必须一轮接一轮。',
      ],
      [
        paragraph(
          '先把生成理解成一个很小的循环：模型看当前的 prompt，给 Vocabulary 中每个候选一个概率；生成器从中选出一个 Token；再把这个 Token 放到 prompt 的末尾。因为下一轮 prompt 变了，模型也必须重新计算下一轮的 h、Logits 和概率。这个“自己的输出成为下一轮输入”的过程叫 autoregressive（自回归）。',
        ),
        callout('先定义 prompt、next_id 与 append', [
          table(
            ['词', '它是什么', '本例'],
            [
              ['prompt / history', '已经给模型看的 Token IDs；也就是目前的文字历史', '“我”的 history 是 [0]。'],
              ['next_id', '本轮从概率分布中选出的一个整数 Token ID', '若选“喜欢”，next_id 是 [1]。'],
              ['append（追加）', '把 next_id 放在 history 的末尾，形成下一轮的新输入', '[0] 追加 [1] 后变成 [0,1]，也就是“我 喜欢”。'],
            ],
          ),
          code(
            'text',
            `Vocabulary: 我=0, 喜欢=1, AI=2, 学习=3, 猫=4

before: history = [[0]]       # shape [B,T]=[1,1]，文字：我
chosen: next_id = [[1]]       # 本轮选择“喜欢”
after:  history = [[0,1]]     # shape [1,2]，文字：我 喜欢`,
          ),
          paragraph(
            '追加的是一个选出的整数 ID，不是把 Probability、Logits、h 或模型 Weights 接到输入后面。模型下一轮会根据新的 IDs 自己重新 lookup Embedding 并计算新的 h。追加也不是训练：它不会改变任何 Parameter。',
          ),
        ]),
        callout('完整走两轮：我 → 喜欢 → AI', [
          paragraph(
            '下面沿用 Vocabulary 顺序 [我, 喜欢, AI, 学习, 猫]。这些是固定教学分数，用来展示生成控制流；不要把它们当成某个已训练模型的真实输出。',
          ),
          table(
            ['轮次', '本轮输入 history', '模型最后位置的 Probability', '选择与 append 后的新 history'],
            [
              [
                '第 1 轮',
                '[0] / 我',
                '[0.0802, 0.5923, 0.2179, 0.0295, 0.0802]',
                'argmax 选 ID 1“喜欢”；[0] → [0,1] / 我 喜欢',
              ],
              [
                '第 2 轮',
                '[0,1] / 我 喜欢',
                '[0.0802, 0.2179, 0.5923, 0.0295, 0.0802]',
                'argmax 选 ID 2“AI”；[0,1] → [0,1,2] / 我 喜欢 AI',
              ],
            ],
            '第二行是重新运行模型后的新分布，不是把第一行的五个概率向右移动或重复使用。',
          ),
          paragraph(
            '为什么必须 append？如果选出“喜欢”后仍把旧的 [0] / “我”交给模型，下一轮模型仍只知道“我”，会再次给出同一类分布；它既不知道刚刚生成了“喜欢”，也不能让后续词依赖“我 喜欢”。追加让新 Token 成为下一步可见上下文的一部分。',
          ),
          chain([
            'history IDs [B,T] 作为本轮输入',
            '模型为每个已有位置输出 Logits [B,T,V]',
            '只取最后位置 logits[:,−1,:]，shape [B,V]：它回答“紧接 history 的下一个 Token”',
            'Softmax 得到最后位置的 probabilities [B,V]',
            '按一种选择规则得到 next_id [B,1]',
            '把 next_id append 到 history，shape 变为 [B,T+1]',
            '用更长的 history 开始下一轮',
          ]),
        ]),
        callout('argmax 和 sampling：都基于 p，但选择规则不同', [
          table(
            ['方法', '规则', '面对第 1 轮概率时的结果'],
            [
              ['argmax', '总是选 Probability 最大的 Token；不随机', '最大值是 0.5923，所以选“喜欢”。'],
              ['sampling', '把 p 当作抽签权重随机抽一个 Token；高概率更常抽到，但不保证', '“喜欢”在大量重复抽样中约占 59.23%；“AI”约占 21.79%，一次也可能被抽到。'],
            ],
          ),
          paragraph(
            '模型负责给候选打分并产生 p；argmax 或 sampling 负责从 p 选出一个实际 next_id。argmax 适合看最确定的选择，但容易反复选相同模式；sampling 可以产生不同续写，因为低一些的候选仍有机会被选中。后面会再讨论 Temperature 和 top-k 如何调整 sampling。',
          ),
        ]),
        callout('两步路径的概率为什么要相乘？', [
          paragraph(
            '为专门看懂连乘，暂时使用更好算的独立数字：已知 prompt 是“我”，假设第一次 P(喜欢｜我)=0.5；选出“喜欢”并 append 后，第二次模型重新计算，得到 P(AI｜我 喜欢)=0.6。要得到完整续写“喜欢 AI”，两个事件都必须发生，因此把两个“在各自上下文下发生”的概率相乘。',
          ),
          formula(
            String.raw`P(\text{续写恰好为「喜欢 AI」}\mid\text{我})=P(\text{喜欢}\mid\text{我})\times P(\text{AI}\mid\text{我 喜欢})=0.5\times0.6=0.3`,
            '0.3 是模型给这一条完整两步路径的概率；它不是第二步单独选 AI 的概率。',
          ),
          paragraph(
            '换一条路径，第二步必须重新换条件：例如 P(学习｜我)=0.25 且 P(AI｜我 学习)=0.8 时，“学习 AI”的路径概率是 0.25×0.8=0.20。不能复用 0.6，因为 0.6 只回答“上下文是我 喜欢时”的问题。若使用 sampling，路径概率表示反复生成时走到这条路径的理论机会；若使用 argmax，每轮直接选最大项，但模型仍可用同一乘法规则给任何完整路径打分。',
          ),
        ]),
        paragraph(
          '现在才看训练与生成的区别。训练文本已经给出真实后续 Token，所以可以一次准备好许多 Input/Target 位置并行打分；生成时并没有真实的下一 Token，必须先选出第 1 个 next_id、append，才能知道第 2 轮要输入什么。',
        ),
        table(
          ['对比项', '训练（teacher forcing）', '生成（autoregressive）'],
          [
            [
              '下一 Token 从哪里来',
              '原始训练文本已经给出正确 Target',
              '由 argmax 或 sampling 从本轮 p 中选出 next_id',
            ],
            [
              '下一轮输入',
              '所有右移 inputs 一开始就可构造好',
              '必须先 append 本轮 chosen next_id 才产生',
            ],
            [
              '一次处理的位置',
              '并行处理全部 B×T 个已知位置',
              '当前轮只从最后位置选择一个 Token',
            ],
            [
              'Parameters 会改变吗',
              'Loss → backward → optimizer.step 会更新它们',
              '不会；这里只是在固定模型下选择并追加 IDs',
            ],
          ],
        ),
      ],
      [
        'append 是把选出的 next_id 加到 history 末尾，不是追加概率、Embedding、h、Logits 或更新模型参数。',
        '每次 append 后上下文改变，因此下一轮要重新算 h、Logits 与 Probability Distribution。',
        'argmax 选最大概率项；sampling 按整组概率随机选择。两者都不等于训练。',
        '生成不能一次 forward 产生任意长文本：下一输入依赖本轮刚选出的 next_id。',
      ],
      check('从“我”生成出“喜欢”后，下一轮模型的输入是什么？为什么不能仍用“我”？', [
        paragraph(
          '下一轮 history 是 [0,1]，也就是“我 喜欢”。因为“喜欢”已经是模型刚生成的历史，后续预测必须能利用它；若仍输入 [0] / “我”，模型不会知道刚才生成了什么，只会重复回答“我”之后可能是什么。',
        ),
      ]),
    ),
    section(
      'o0235-8-input-target',
      '8. Input 与 Target：用同一段文字自动出题，答案右移一位',
      '“我 喜欢 AI”不需要人工标注：它本身就包含两道 next-token 题。关键是让每个位置看到当前与左侧 Token，却把右边紧接的 Token 当作答案。',
      [
        '从一条三个 Token 的原始序列，亲手构造两道 Input → Target 预测题。',
        '解释为什么 N 个原始 Token 在一个窗口中只能提供 T=N−1 个 next-token Targets。',
        '区分 right shift 决定“答案是什么”，causal mask 限制“模型能看什么”。',
        '把 `[B,N]`、`[B,T]`、`[B,T,V]` 与每一题具体对应起来。',
      ],
      [
        paragraph(
          'Language Model 的训练任务不是“把输入原样复读”，而是“看到到目前为止的文字，猜紧接着的下一 Token”。因此一段原始文字既提供题目，也提供标准答案：每个 Token 左边的位置负责预测它。这个做法叫 self-supervised，因为答案来自文本本身，而不是人工逐句标注。',
        ),
        callout('先只看一条序列：我 喜欢 AI', [
          table(
            ['原始位置', 'raw Token', 'ID', '它能成为哪一道题的答案？'],
            [
              ['0', '我', '0', '在这个窗口中没有左侧位置预测它；它是第一道题的输入起点。'],
              ['1', '喜欢', '1', '上一位置“我”要预测的 Target。'],
              ['2', 'AI', '2', '上一位置“我 喜欢”要预测的 Target。'],
            ],
          ),
          code(
            'text',
            `raw IDs R = [0, 1, 2]             # 我  喜欢  AI

inputs  X = R[:-1] = [0, 1]       # 我  喜欢
targets Y = R[1:]  = [1, 2]       # 喜欢  AI

第 0 题：看到“我”       → Target 是“喜欢” / ID 1
第 1 题：看到“我 喜欢”  → Target 是“AI”   / ID 2`,
          ),
          paragraph(
            '这就是“错开一位”：`inputs` 去掉最后一个 Token，`targets` 去掉第一个 Token。两个数组长度相同，索引也对齐，但同一索引保存的不是同一个 Token。`inputs[0]=我` 对应 `targets[0]=喜欢`；`inputs[1]=喜欢` 对应 `targets[1]=AI`。',
          ),
        ]),
        formula(
          String.raw`X=R[:,0:N-1],\qquad Y=R[:,1:N],\qquad T=N-1`,
          'R 是原始 IDs `[B,N]`；沿 sequence 轴切出 X 与 Y 后，两者都是 `[B,T]`。最后一个原始 Token 在这个窗口右侧没有答案，因此不作为 Input 位置。',
        ),
        callout('为什么最后一个 AI 不再出一道题？', [
          paragraph(
            '要让“AI”出题，模型需要一个紧接在它右侧的正确 Token。例如原始文字还包含“AI 学习”，才可额外构造“我 喜欢 AI → 学习”。在当前窗口 `[我, 喜欢, AI]` 中，AI 后面没有提供答案，所以只能产生两题，而不是三题。训练会从长文本中不断截取窗口，AI 在下一个重叠窗口里可以成为 Input。',
          ),
        ]),
        code(
          'text',
          `raw IDs [B,N] = [[0,1,2], [4,1,0], [0,3,2]]  # [3,3]
inputs  [B,T] = [[0,1],   [4,1],   [0,3]]    # [3,2]
targets [B,T] = [[1,2],   [1,0],   [3,2]]    # [3,2]

T = N - 1 = 2`,
        ),
        paragraph(
          '现在才把三条独立原始序列放进 Batch：第 0 条是“我 喜欢 AI”，第 1 条是“猫 喜欢 我”，第 2 条是“我 学习 AI”。B=3 只表示一次并行处理三条样本；它们不会彼此拼接，也不会互相提供上下文。每条有 T=2 个预测位置，所以本次一共是 3×2=6 道题。',
        ),
        table(
          [
            '题目位置 [b,t]',
            '该条原始文字',
            '一般 causal LM 此处可见的上下文',
            '正确 Target',
            'Cross Entropy 会读取哪一项？',
          ],
          [
            ['[0,0]', '我 喜欢 AI', '我', '喜欢 / ID 1', 'p[0,0,1]'],
            ['[0,1]', '我 喜欢 AI', '我 喜欢', 'AI / ID 2', 'p[0,1,2]'],
            ['[1,0]', '猫 喜欢 我', '猫', '喜欢 / ID 1', 'p[1,0,1]'],
            ['[1,1]', '猫 喜欢 我', '猫 喜欢', '我 / ID 0', 'p[1,1,0]'],
            ['[2,0]', '我 学习 AI', '我', '学习 / ID 3', 'p[2,0,3]'],
            ['[2,1]', '我 学习 AI', '我 学习', 'AI / ID 2', 'p[2,1,2]'],
          ],
          '模型输出 p 的 shape 是 `[B,T,V]=[3,2,5]`：每一题都有五个候选概率，Target ID 指出该从最后一轴取哪一个。',
        ),
        callout('为什么 Target 不能和 Input 相同？', [
          paragraph(
            '若把 `[我, 喜欢]` 同时当 Input 和 Target，第 0 题会变成“看到我，预测我”，第 1 题会变成“看到喜欢，预测喜欢”。模型在当前位置本来就收到当前 Token，自然可以学会复制，而没有学到 next-token prediction。right shift 强迫每一题去预测右边尚未作为该位置答案出现的 Token。',
          ),
        ]),
        callout('right shift 与 causal mask：两道不同的安全门', [
          table(
            ['机制', '它决定什么', '没有它会怎样？'],
            [
              ['right shift', '哪一个 Token 是当前位置的正确 Target', '会把“复读当前 Input”错当成训练目标。'],
              ['causal mask', 'Transformer 在算位置 t 的 hₜ 时，可以读取输入序列中的哪些位置', '它可能偷看右侧 Input，而右侧 Input 恰好含有该位置的 Target。'],
            ],
          ),
          paragraph(
            '看第 0 条序列的第 0 题：Input 整行其实是 `[我, 喜欢]`，而此位置的 Target 是“喜欢”。如果没有 causal mask，Attention 在位置 0 可以看见右侧位置 1 的“喜欢”，等于提前看到了答案；这叫 future leakage。mask 规定位置 0 只能看“我”，位置 1 才能看“我 喜欢”。right shift 负责出题，mask 负责防止偷看答案，两者缺一不可。',
          ),
          paragraph(
            'Bigram 模型只用当前位置 ID 查一行分数，没有跨位置 Attention，因此它本身不会读取右侧；但它仍需要 right shift 来知道每行分数应该对哪一个下一 Token 计算 Loss。',
          ),
        ]),
        chain([
          '长文本切出 raw IDs R [B,N]',
          '右移形成 inputs X [B,T] 与 targets Y [B,T]，其中 T=N−1',
          'Transformer 用 causal mask 计算每个位置仅依赖左侧的 h [B,T,C]',
          'Output Head 得到每题五个 Logits / Probabilities [B,T,V]',
          'Target ID 指向每题正确概率 p[b,t,target_id]',
          'Cross Entropy 对全部 B×T 道题计算并平均 Loss',
        ]),
      ],
      [
        'right shift 是切分原始 Token IDs 来定义监督关系，不是移动 Embedding，也不是改变 Token ID。',
        'N 个原始 Token 在当前窗口只产生 N−1 道 next-token 题；最后一个 Token 缺少右侧 Target。',
        'Target 与 Input 都是 `[B,T]`，但同一 [b,t] 的内容相差一位：Target 是 Input 右边的下一个 Token。',
        'right shift 定义答案；causal mask 防止 Transformer 偷看右侧输入。Bigram 虽无需 mask，仍需 shift。',
      ],
      check('原始序列“我 喜欢 AI”为什么只产生两题？第 0 题的 Target 与可见上下文各是什么？', [
        paragraph(
          '它有 N=3 个原始 Token，但最后的 AI 在这个窗口右边没有给出下一 Token，因此 T=N−1=2。第 0 题的 Input/可见上下文是“我”，Target 是它右边紧接的“喜欢” / ID 1；Cross Entropy 读取 p[0,0,1]。',
        ),
      ]),
    ),
    section(
      'o0237-9-model-probability',
      '9. Logits：完整手算五个候选的原始分数',
      '直接给出 [0,2,1,-1,0] 会让 Logit 像人工填写的答案；必须从 Context Representation、Output Weights 与 Biases 逐项算出它。',
      [
        '手算 z_i = w_i · h + b_i，并把五次候选评分合并成一次 Matrix Multiplication。',
        '理解参数从训练中获得，以及 Logit 的相对差距为什么会决定后续 Softmax Probability。',
      ],
      [
        paragraph(
          '现在预测上下文“我”之后的 Token。假设经过 Input Embedding 和 Context Model 后，当前位置得到 h=[0.20,-0.10,0.70,0.30]。为了保持手算简单，本教学步骤暂时让 h 与“我”的输入 Embedding 相同；真实 Transformer 中的 h 通常已经融合上下文并被多层网络改变。',
        ),
        table(
          ['Context feature', 'h value', '怎样理解'],
          [
            ['h₀', '0.20', '第 0 个 learned context feature'],
            ['h₁', '-0.10', '第 1 个 learned context feature'],
            ['h₂', '0.70', '第 2 个 learned context feature'],
            ['h₃', '0.30', '第 3 个 learned context feature'],
          ],
          '这些 feature 没有预先指定的人类语义名称',
        ),
        paragraph(
          '输出层为 Vocabulary 中的每个候选保存一行 Output Weights 和一个 Bias。每一行都像一条可学习的评分规则：把同一个 h 的四项证据按该候选自己的方式加权，然后求和。',
        ),
        formula(
          String.raw`z_i=w_i\cdot h+b_i=h_0w_{i,0}+h_1w_{i,1}+h_2w_{i,2}+h_3w_{i,3}+b_i`,
          '候选 i 的四项 context features 与它自己的四项 weights 对应相乘、求和，再加 bias。',
        ),
        table(
          ['候选', 'Output Weight wᵢ', 'Bias bᵢ', '代入计算', 'Logit'],
          [
            ['我', '[1,0,0,0]', '-0.2', '1(0.2)−0.2', '0'],
            ['喜欢', '[0,1,2,2]', '0.1', '−0.1+2(0.7)+2(0.3)+0.1', '2'],
            ['AI', '[0,0,1,1]', '0', '0.7+0.3', '1'],
            ['学习', '[0,3,−1,0]', '0', '3(−0.1)−0.7', '−1'],
            ['猫', '[1,2,0,0]', '0', '0.2+2(−0.1)', '0'],
          ],
          '教学用 Output Head 参数；真实参数由训练得到',
        ),
        paragraph(
          '例如“喜欢”的评分完整展开为 0×0.20 + 1×(−0.10) + 2×0.70 + 2×0.30 + 0.10 = 2。这里没有任何一步在直接查“正确答案”；只是当前 h 与“喜欢”的 learned scoring weights 组合后得到较高总分。',
        ),
        formula(
          String.raw`z=[z_{\text{我}},z_{\text{喜欢}},z_{\text{AI}},z_{\text{学习}},z_{\text{猫}}]=[0,2,1,-1,0]`,
          '按固定 Vocabulary 顺序组合五次评分，得到长度 V=5 的 Logit Vector。',
        ),
        code(
          'python',
          `import torch

# 当前上下文的四个内部特征
h = torch.tensor([
    0.20,
    -0.10,
    0.70,
    0.30,
])  # [C] = [4]

# 每一行是一个候选 Token 的 scoring weights
W_out = torch.tensor([
    [1.0, 0.0,  0.0, 0.0],  # 我
    [0.0, 1.0,  2.0, 2.0],  # 喜欢
    [0.0, 0.0,  1.0, 1.0],  # AI
    [0.0, 3.0, -1.0, 0.0],  # 学习
    [1.0, 2.0,  0.0, 0.0],  # 猫
])  # [V,C] = [5,4]

bias = torch.tensor([
    -0.2,
     0.1,
     0.0,
     0.0,
     0.0,
])  # [V] = [5]

logits = W_out @ h + bias
print(logits)
# tensor([0., 2., 1., -1., 0.])`,
        ),
        paragraph(
          '手算时分别完成五个 Dot Products；矩阵 W_out 把五行评分规则排在一起，所以 W_out @ h + bias 可以一次产生五个候选分数。Bias [5] 为每个候选提供一个与当前 h 无关的可学习基础偏移。',
        ),
        formula(
          String.raw`W_{\mathrm{out}}\in\mathbb{R}^{V\times C},\quad h\in\mathbb{R}^{C},\quad z=W_{\mathrm{out}}h+b\in\mathbb{R}^{V}`,
          '[5,4] matrix 乘 [4] context vector，再加 [5] bias，产生 [5] logits。',
        ),
        formula(
          String.raw`H:[B,T,C]\quad\to\quad H W_{\mathrm{out}}^{\mathsf T}+b:[B,T,V]`,
          '对整个 batch 的每一个时间位置应用同一 Output Head：[3,2,4] 变成 [3,2,5]。',
        ),
        code(
          'python',
          `# H: [B,T,C] = [3,2,4]
# W_out.T: [C,V] = [4,5]
logits = H @ W_out.T + bias
# logits: [B,T,V] = [3,2,5]`,
        ),
        callout('分数来自训练，不是人工语言规则', [
          paragraph(
            '上表参数只用于精确复现本周固定数字。真实模型初始化时 W_out、bias 和产生 H 的参数通常接近随机；Cross Entropy 产生 Gradient，Optimizer 再调整这些参数。训练久了，模型才逐渐学会什么样的上下文证据应让某个候选获得更高相对分数。',
          ),
        ]),
        paragraph(
          'Logit 对 Softmax 重要，是因为 Softmax 使用候选之间的差距。若两个 Logits 相差 1，它们在 Softmax 后的概率比是 e¹≈2.718；如果只把“喜欢”的 Logit 提高，它相对其他候选的概率会增加。若给全部 Logits 同时加 100，差距不变，Probability 也不变。',
        ),
        formula(
          String.raw`\frac{p_i}{p_j}=e^{z_i-z_j}`,
          '两个候选的 Softmax probability ratio 只由它们的 Logit difference 决定。',
        ),
      ],
      [
        'h 不一定等于原始 Token Embedding；完整模型通常先用上下文网络改变它。',
        'W_out 是 Output Head 的评分参数，不要默认它就是输入 Embedding Matrix E；部分模型会 weight tying，但本例不依赖该设计。',
        'Logit 参数不是人为标注的语言含义，而是训练得到的数值。',
        'Logit 不是 Probability；负 Logit 合法，也不表示负概率。',
        '[B,T,V] 的最后一维 V 才是候选类别。',
        'Softmax 看相对差距；所有 Logits 同时加同一常数不会改变分布。',
      ],
      check('本例“喜欢”的 Logit=2 是怎样产生的？它是不是 200%？', [
        paragraph(
          '将 h=[0.20,-0.10,0.70,0.30] 与 w_喜欢=[0,1,2,2] 点积，再加 b_喜欢=0.1，得到 2。它只是原始相对分数；Softmax 后对应 Probability 才约为 0.592。',
        ),
      ]),
    ),
    section(
      'o0239-10-softmax-logits-probability',
      '10. Softmax：把 Logits 变成 Probability',
      'logits 能比较高低，但不能直接说明某 token 的概率，也不保证候选数加总为 1。',
      [
        '理解 Softmax 的两步：指数化保证为正，除以总和完成归一化。',
        '说明为什么不能直接除以 Logit 总和，以及 Logit difference 怎样决定 probability ratio。',
        '完整手算固定示例，并对应到 PyTorch 的 dim=-1。',
      ],
      [
        paragraph(
          '上一节已经从 h、W_out 和 bias 真正算出 logits=[0,2,1,-1,0]。这些数可以比较高低，却不是 Probability：2 不代表 200%，−1 也不代表负概率。Sampling 和 Cross Entropy 需要一组全部非负、总和等于 1 的合法分布。',
        ),
        formula(
          String.raw`p_i=\frac{e^{z_i}}{\sum_{j=0}^{V-1}e^{z_j}}`,
          '先把每个 logit 变正，再除以所有五个 exponentials 的总和。',
        ),
        callout('为什么不能直接除以 Logit 总和', [
          paragraph(
            'Logits 可以包含负数，而且总和可能为 0。本例的总和正好是 2，若直接相除，“学习”会得到 −0.5，显然不是合法概率。指数函数让每个候选先变成正权重，并保留原来的高低顺序。',
          ),
        ]),
        paragraph(
          '第一步是指数化。e⁰=1、e²≈7.389、e¹≈2.718、e⁻¹≈0.368。负 Logit 经过指数后仍是正数，因此对应候选仍有机会，只是相对权重较小。',
        ),
        table(
          ['candidate order', 'logit', 'exponential', 'probability'],
          [
            ['我', '0', '1.000', '0.080'],
            ['喜欢', '2', '7.389', '0.592'],
            ['AI', '1', '2.718', '0.218'],
            ['学习', '-1', '0.368', '0.029'],
            ['猫', '0', '1.000', '0.080'],
          ],
          '固定顺序 [我, 喜欢, AI, 学习, 猫]；logits [0,2,1,-1,0]',
        ),
        paragraph(
          '第二步是归一化。五个指数权重之和为 12.475；每个候选除以同一个总和后，得到 [0.080,0.592,0.218,0.029,0.080]，全部相加约等于 1。',
        ),
        code(
          'text',
          `exponentials = [1.000,7.389,2.718,0.368,1.000]
sum = 12.475
probabilities = [0.080,0.592,0.218,0.029,0.080]
0.080 + 0.592 + 0.218 + 0.029 + 0.080 ≈ 1`,
        ),
        list(
          [
            '指数化：所有结果都大于 0，所以负 Logit 也能成为合法正权重。',
            '保持顺序：若 zᵢ > zⱼ，则 eᶻⁱ > eᶻʲ，原本更高的候选仍然更高。',
            '转成相对比：pᵢ/pⱼ = e^(zᵢ−zⱼ)，Logit 差距直接控制候选之间的概率比。',
            '归一化：除以全部候选权重的总和，使结果相加为 1。',
          ],
          true,
        ),
        formula(
          String.raw`z_i-z_j=1\quad\Rightarrow\quad\frac{p_i}{p_j}=e^1\approx2.718`,
          '两个 Logits 相差 1 时，较高候选的相对 probability 约是另一个的 2.718 倍。',
        ),
        code(
          'python',
          `import torch
import torch.nn.functional as F

logits = torch.tensor([0.0, 2.0, 1.0, -1.0, 0.0])
probabilities = F.softmax(logits, dim=-1)

print(probabilities)
# tensor([0.0802, 0.5923, 0.2179, 0.0295, 0.0802])

print(probabilities.sum())
# tensor(1.)`,
        ),
        paragraph(
          '若 logits 的 Shape 是 [B,T,V]=[3,2,5]，dim=-1 表示对每一个 [b,t] 位置自己的五个 Vocabulary candidates 做 Softmax。它不会把不同句子或不同时间位置混在同一个分母中。',
        ),
        callout('数值稳定性（高级）', [
          paragraph(
            'softmax(z)=softmax(z−max(z))。本例可先从 [0,2,1,-1,0] 减去最大值 2，得到 [-2,0,-1,-3,-2]；概率不变，但能避免过大的 exponentials。训练实现交给 PyTorch 的稳定算法。',
          ),
        ]),
      ],
      [
        'Softmax 产生分布，不负责决定最终 token。',
        '某 token 的概率取决于全部 logits，不只取决于自己的分数。',
        '不要直接用 Logit 除以 Logit 总和；负数和零总和会产生无效结果。',
        '训练时不要先手动 Softmax 再交给 F.cross_entropy；展示或 sampling 时才显式计算。',
        '对 [B,T,V] 应沿 vocabulary 维 dim=-1 做 Softmax。',
      ],
      check('Softmax 为什么先使用指数函数，再除以全部指数之和？', [
        paragraph(
          '指数函数把任意 Logit 转成正权重、保持候选顺序，并把差距转为相对比；除以总和再让所有候选组成总和为 1 的合法概率分布。',
        ),
      ]),
    ),
    section(
      'o0241-11-cross-entropy-probability',
      '11. Cross Entropy：从正确答案概率到 Loss，再到 Gradient',
      '概率表告诉我们模型目前相信什么；Cross Entropy 把“正确答案得到多少概率”压成一个 Loss，并给每个 Logit 一个明确的升降方向。',
      [
        '从“正确答案概率越高，Loss 应越低”推导单题 L=−ln(p_correct)。',
        '解释负号和对数各自解决什么问题，再连接完整 One-hot Cross Entropy。',
        '从 L=−ln(p_y) 推到每个 Logit 的 Gradient gᵢ=pᵢ−yᵢ，并逐项解释正负号。',
        '追踪 Gradient 如何从 Logits 回传到 Output Head 的 Weight、Bias 与 Context Representation h。',
      ],
      [
        paragraph(
          'Softmax 已得到五个候选概率。假设这道题的真实下一 Token 是“喜欢”，训练首先读取模型分给正确答案的概率 p_correct=0.592。我们希望：正确答案概率越接近 1，Loss 越接近 0；概率越接近 0，惩罚越大。',
        ),
        formula(
          String.raw`L=-\ln(p_y)`,
          '单个位置的 Cross Entropy：y 是正确 token ID，p_y 是该位置给正确 token 的概率。',
        ),
        table(
          ['p(correct)', '−ln(p)', '训练直觉'],
          [
            ['0.99', '0.010', '几乎确信正确，惩罚接近 0'],
            ['0.90', '0.105', '正确且有把握'],
            ['0.60', '0.511', '倾向正确，但仍有明显不确定性'],
            ['0.50', '0.693', '只有一半概率给正确答案'],
            ['0.10', '2.303', '正确答案概率很低'],
            ['0.01', '4.605', '非常自信地偏离正确答案，惩罚很大'],
          ],
          '正确答案 Probability 与 single-position Cross Entropy',
        ),
        callout('为什么有负号，为什么使用 Log', [
          paragraph(
            '当 0<p≤1 时 ln(p)≤0，所以前面的负号把它变成非负 Loss。Log 还会明显惩罚“非常自信地预测错误”：p 从 0.10 降到 0.01 时，−ln(p) 从 2.303 增到 4.605。若只用 1−p，二者只有 0.90 与 0.99，差距很小。',
          ),
          paragraph(
            '一段序列的条件概率需要连乘；Log 会把概率乘法变成 Loss 加法。这样多个 Token 的 Negative Log Likelihood 可以稳定地求和或求平均。',
          ),
        ]),
        table(
          ['上下文', 'target', 'p(correct)', 'loss'],
          [
            ['我', '喜欢（ID 1）', '0.592', '-ln(0.592) ≈ 0.524'],
            ['我（若 target 改为）', 'AI', '0.218', '约 1.524'],
            ['我（若 target 改为）', '猫', '0.080', '约 2.524'],
          ],
        ),
        paragraph(
          'Cross Entropy 不只检查 argmax 是否正确：若正确答案同样是喜欢，概率从 0.51 升到 0.90，loss 仍会下降。对多个位置，平均 loss 是每个正确 target 负对数概率的平均。',
        ),
        code(
          'text',
          `Vocabulary order        = [我,    喜欢,  AI,    学习,  猫]
predicted probabilities = [0.080, 0.592, 0.218, 0.029, 0.080]
one_hot(target=喜欢)     = [0,     1,     0,     0,     0]

L = -Σ yᵢ ln(pᵢ)
  = -(0 ln 0.080 + 1 ln 0.592 + 0 ln 0.218
      + 0 ln 0.029 + 0 ln 0.080)
  = -ln(0.592)
  ≈ 0.524`,
        ),
        formula(
          String.raw`L=-\sum_{i=0}^{V-1}y_i\ln(p_i)=-\ln(p_{\mathrm{correct}})`,
          'One-hot label 只有正确 Token 的位置为 1，所以完整求和会简化为正确答案的 Negative Log Probability。',
        ),
        callout('yᵢ 到底是什么？它不是 Probability', [
          paragraph(
            '为避免符号混淆，本课把训练数据给出的整数标签写成 `target_id`。本题正确 Token 是“喜欢”，所以 `target_id=1`。公式中的 yᵢ 则不是整数 1 本身，也不是模型预测出来的概率；它是 one-hot target vector 在候选 i 位置的值：只有正确 ID 的位置放 1，其余全部放 0。',
          ),
          formula(
            String.raw`y_i=\begin{cases}1,&i=\mathrm{target\_id}\\0,&i\ne\mathrm{target\_id}\end{cases}\qquad\text{本题：target\_id=1，}\ y=[0,1,0,0,0]`,
            'pᵢ 是模型对候选 i 给出的 Probability；yᵢ 是训练数据给出的 0 或 1 标签。两者来源不同，不能混为一谈。',
          ),
          table(
            ['候选 i', 'Token', '模型预测 pᵢ', '标签 yᵢ', '在 Cross Entropy 中的作用'],
            [
              ['0', '我', '0.0802', '0', '不是正确答案，不计入 −ln(p_correct)。'],
              ['1', '喜欢', '0.5923', '1', '正确答案；读取这一项作为 p_correct。'],
              ['2', 'AI', '0.2179', '0', '不是正确答案。'],
              ['3', '学习', '0.0295', '0', '不是正确答案。'],
              ['4', '猫', '0.0802', '0', '不是正确答案。'],
            ],
          ),
          paragraph(
            '因此在 Gradient 公式 gᵢ=pᵢ−yᵢ 中，正确“喜欢”的 g₁=0.5923−1=−0.4077；“AI”的 g₂=0.2179−0=+0.2179。负号会让正确候选的相对 Logit 被推高，正号会让错误候选的相对 Logit 被压低。',
          ),
        ]),
        callout('Loss 这个数怎样告诉模型“该往哪边改”？', [
          paragraph(
            'Loss 本身只有一个数，例如 0.5237；Optimizer 还需要知道：把每个 Logit 稍微调大一点，会让 Loss 上升还是下降、变化多少。这个局部变化率就是 Gradient。先把五个 Logits 想成五个可微调旋钮，下一步再追踪真正被更新的 Weights。',
          ),
          formula(
            String.raw`L=-\ln\left(\frac{e^{z_y}}{\sum_j e^{z_j}}\right)=-z_y+\ln\left(\sum_j e^{z_j}\right)`,
            '把 Softmax 代入 Loss：−z_y 专门奖励正确 Logit 变大；后面的 Log-Sum-Exp 来自所有候选共同竞争的 Softmax 分母。',
          ),
          formula(
            String.raw`g_i=\frac{\partial L}{\partial z_i}=p_i-y_i`,
            'yᵢ 是 one-hot Target：正确候选 yᵢ=1，其它候选 yᵢ=0。Softmax 与 Negative Log 组合后，Gradient 恰好简化成“预测 Probability 减标签”。',
          ),
          paragraph(
            'gᵢ 的读法是：若把 zᵢ 增加很小的 Δzᵢ，Loss 大约改变 gᵢ×Δzᵢ。负数表示调高该 Logit 会降低 Loss；正数表示调高它会增加 Loss。Gradient Descent 会执行“减去学习率乘 Gradient”，所以它会把负 Gradient 对应的 Logit 推高，把正 Gradient 对应的 Logit 推低。',
          ),
        ]),
        table(
          ['候选', 'pᵢ', 'Target yᵢ', 'gᵢ=pᵢ−yᵢ', 'Gradient Descent 的方向'],
          [
            ['我', '0.0802', '0', '+0.0802', 'z_我 向下调一点'],
            ['喜欢（正确）', '0.5923', '1', '−0.4077', 'z_喜欢 向上调一点'],
            ['AI', '0.2179', '0', '+0.2179', 'z_AI 向下调一点'],
            ['学习', '0.0295', '0', '+0.0295', 'z_学习 向下调一点'],
            ['猫', '0.0802', '0', '+0.0802', 'z_猫 向下调一点'],
          ],
          '候选顺序为 [我, 喜欢, AI, 学习, 猫]；显示值经四舍五入。五个 Gradient 相加约为 0，说明 Softmax 主要重新分配候选之间的相对分数。',
        ),
        callout('用很小的改动核对正负号', [
          table(
            ['只改变一项', '新的 p(喜欢)', '新的 Loss', '说明'],
            [
              ['不改 z=[0,2,1,−1,0]', '0.592299', '0.523744', '基准。'],
              ['把正确 z_喜欢 从 2 增至 2.01', '0.594711', '0.519679', 'Loss 下降，符合 g_喜欢<0。'],
              ['把错误 z_AI 从 1 增至 1.01', '0.591005', '0.525932', 'Loss 上升，符合 g_AI>0。'],
            ],
            '固定 Logits 的数值微调，只用于验证 Gradient 方向；它不是训练日志。',
          ),
        ]),
        formula(
          String.raw`\frac{\partial L}{\partial z_i}=p_i-\mathrm{one\_hot}(y)_i`,
          'Softmax 与 Cross Entropy 组合后，logit gradient 等于 probability 减去正确 target 的 one-hot vector。',
        ),
        code(
          'text',
          `p                     = [0.080, 0.592, 0.218, 0.029, 0.080]
one_hot(target=喜欢)   = [0,     1,     0,     0,     0]
p - one_hot(target)   = [0.080,-0.408, 0.218, 0.029, 0.080]

Gradient Descent subtracts this gradient:
喜欢 has a negative gradient, so its relative logit is pushed up;
the other candidates have positive gradients, so their relative logits are pushed down.`,
        ),
        callout('手算一次教学更新', [
          paragraph(
            '为了先看清方向，暂时把五个 Logits 当成直接可更新变量，并使用 learning rate η=0.1。真实网络会更新产生 Logits 的 Output Head、Context Model 和 Embedding Parameters。',
          ),
          code(
            'text',
            `old logits = [ 0.000,  2.000, 1.000, -1.000,  0.000]
gradient   = [ 0.080, -0.408, 0.218,  0.029,  0.080]

new logits = old logits - 0.1 × gradient
           = [-0.008,  2.041, 0.978, -1.003, -0.008]

重新计算 Softmax：
P(喜欢)  0.592 → 0.606
Loss     0.524 → 0.501`,
          ),
          paragraph(
            '这一步闭合了学习因果链：正确答案的相对 Logit 上升 → Softmax Probability 提高 → Cross Entropy Loss 降低。',
          ),
        ]),
        callout('Logit 的 Gradient 怎样回传到真正的 Parameters？', [
          paragraph(
            'Logits 不是模型长期保存的参数；每次 forward 都会重新算出它们。真正要更新的是 Output Head 的 W_out、b_out，以及前面负责产生 h 的 Parameters。已知 z=W_out h+b_out 和 g=dL/dz 后，Chain Rule 的下一站如下。这里 W_out 的 shape 是 `[V,C]=[5,4]`，每一行对应一个候选 Token 的评分规则。',
          ),
          formula(
            String.raw`\frac{\partial L}{\partial b_{\mathrm{out}}}=g,\qquad \frac{\partial L}{\partial W_{\mathrm{out}}}=g\,h^{\mathsf T},\qquad \frac{\partial L}{\partial h}=W_{\mathrm{out}}^{\mathsf T}g`,
            'Bias 的每一项直接收到对应 gᵢ；第 i 行 Output Weight 的 Gradient 是 gᵢ×h；h 则收集全部候选评分规则传回的影响。',
          ),
          table(
            ['量', 'shape', '本例的含义'],
            [
              ['g=dL/dz', '[V]=[5]', '[0.0802,−0.4077,0.2179,0.0295,0.0802]：五个候选 Logit 的方向。'],
              ['dL/db_喜欢', 'scalar', 'g_喜欢=−0.4077；执行减法更新时，喜欢的 Bias 会上升。'],
              ['dL/dw_喜欢', '[C]=[4]', 'g_喜欢×h=−0.4077×[0.20,−0.10,0.70,0.30]≈[−0.0815,0.0408,−0.2854,−0.1223]。'],
              ['dL/dh', '[C]=[4]', 'W_outᵀg：把五个候选的反馈汇总，交给产生 h 的 Context Model。'],
            ],
          ),
          code(
            'text',
            `本例“喜欢”的 Output Head 参数：
old w_喜欢 = [0, 1, 2, 2]
old b_喜欢 = 0.1

dL/dw_喜欢 ≈ [-0.0815, 0.0408, -0.2854, -0.1223]
dL/db_喜欢 ≈ -0.4077

若只观察这一行、learning rate η=0.1：
new w_喜欢 = old w_喜欢 - η × dL/dw_喜欢
           ≈ [0.0082, 0.9959, 2.0285, 2.0122]
new b_喜欢 ≈ 0.1408`,
          ),
          paragraph(
            '真实的一步会同时更新全部五行 W_out、全部 Bias，以及产生 h 的 Embedding、Attention、FFN 等前面参数。h 收到的 Gradient 继续沿 Context Model 反传；这就是 Backpropagation 把一个最终 Loss 分配给许多 Parameters 的过程。',
          ),
        ]),
        callout('Batch Mean Loss 会怎样改变 Gradient？', [
          paragraph(
            '前面 g=p−y 是单题 Loss 的 Gradient。本例一次有 B×T=3×2=6 道题，默认 mean reduction 会先把六个单题 Loss 平均。因此每一道题传回自己 Logits 的 Gradient 还要除以 6；这样 Batch 放入更多题目时，Loss 与更新步幅不会只因题目数量变大而成倍放大。',
          ),
          formula(
            String.raw`L_{\mathrm{batch}}=\frac{1}{BT}\sum_{b,t}L_{b,t},\qquad \frac{\partial L_{\mathrm{batch}}}{\partial z_{b,t,i}}=\frac{p_{b,t,i}-y_{b,t,i}}{BT}`,
            '本例的除数是 BT=6。若明确使用 sum reduction，则不除以 6；必须在代码与解释中写清 reduction。',
          ),
        ]),
      ],
      [
        'loss 不是 accuracy 或百分比；越低越好，理论下界为 0。',
        'loss 直接读正确 token 的 probability，但 Softmax 让全部 logits 相互竞争，所以全部都会收到梯度。',
        'Cross Entropy 不是只判断 Argmax 对错；即使最大候选已正确，提高其 Probability 仍会降低 Loss。',
        'gᵢ=pᵢ−yᵢ 表示把 Logit zᵢ 增大一点会怎样改变 Loss：正确项为负、错误项为正。',
        '直接更新 Logits 只是教学显微镜；真实训练更新 W_out、b_out 和产生 h 的前面 Parameters。',
        'mean reduction 时，每个位置的 Logit Gradient 还要除以有效题目数；训练通常平均全部位置，不只看最后一个 Token。',
      ],
      check(
        'Target 是“喜欢”且 p_喜欢=0.5923 时，g_喜欢 与 g_AI 分别是多少？它们告诉 Gradient Descent 做什么？',
        [
          paragraph(
            'g_喜欢=0.5923−1=−0.4077，g_AI=0.2179−0=+0.2179。Gradient Descent 执行“参数减去学习率乘 Gradient”；在直接看 Logit 的教学镜头下，这会让 z_喜欢 上升、z_AI 下降。真实网络中同一方向会经由 Chain Rule 变成对对应 Output Weight、Bias 和产生 h 的 Parameters 的更新。',
          ),
        ],
      ),
    ),
    section(
      'o0243-12-pytorch-crossentropyloss-logits',
      '12. 为什么 PyTorch F.cross_entropy 接收 Logits',
      '数学说明中先谈 probability，但训练 API 若再接收已 Softmax 的 probability，会重复内部变换并降低数值稳定性。',
      [
        '直接把 raw logits 与整数 target IDs 传入 F.cross_entropy。',
        '先验证一题的 [1,5] logits 与 [1] target，再扩展到六题。',
        '把六个 [B,T] 位置明确展平为六行 V=5 的分类题。',
      ],
      [
        paragraph(
          'F.cross_entropy 在内部稳定地结合 LogSoftmax 与 negative log likelihood。因此它的输入是 raw logits；targets 是范围 0 到 V−1 的 torch.long IDs，而不是 one-hot vectors。',
        ),
        code(
          'python',
          `import torch
import torch.nn.functional as F

# 一道题，五个候选 raw logits
logits_one = torch.tensor(
    [[0.0, 2.0, 1.0, -1.0, 0.0]],
    requires_grad=True,
)  # [1,5]

# 正确答案是“喜欢”，ID=1
target_one = torch.tensor([1], dtype=torch.long)  # [1]

loss_one = F.cross_entropy(logits_one, target_one)
loss_one.backward()

print(loss_one.item())
# approximately 0.524

print(logits_one.grad)
# approximately [[0.080, -0.408, 0.218, 0.029, 0.080]]`,
        ),
        paragraph(
          '这段代码与上一节手算完全对应：[1,5] 表示一题有五个候选分数，[1] 表示这一题只需一个正确类别 ID。确认单题后，再把 batch 中的六个位置排成六题。',
        ),
        table(
          [
            'flattened row',
            'batch position',
            'input / context',
            'target token',
            'target ID',
          ],
          [
            ['0', '[0,0]', '我 / 我', '喜欢', '1'],
            ['1', '[0,1]', '喜欢 / 我 喜欢', 'AI', '2'],
            ['2', '[1,0]', '猫 / 猫', '喜欢', '1'],
            ['3', '[1,1]', '喜欢 / 猫 喜欢', '我', '0'],
            ['4', '[2,0]', '我 / 我', '学习', '3'],
            ['5', '[2,1]', '学习 / 我 学习', 'AI', '2'],
          ],
          'reshape 保持 row 对齐：flattened logits 的每行与 flattened targets 的同一索引是一道题',
        ),
        code(
          'python',
          `import torch
import torch.nn.functional as F

# logits: [B,T,V] = [3,2,5]; targets: [B,T] = [3,2]
B, T, V = logits.shape
logits_2d = logits.reshape(B * T, V)       # [6,5]
targets_1d = targets.reshape(B * T)        # [6], dtype=torch.long

loss = F.cross_entropy(
    logits_2d,
    targets_1d,
)                                           # scalar mean loss

# Incorrect: F.cross_entropy expects logits, not already-softmaxed probabilities.
# probabilities = F.softmax(logits_2d, dim=-1)
# loss = F.cross_entropy(probabilities, targets_1d)`,
        ),
        formula(
          String.raw`[3,2,5]\to[6,5]\quad\text{and}\quad[3,2]\to[6]`,
          '合并 B 与 T，只改变组织方式；对应关系和 vocabulary axis V=5 保持不变。',
        ),
      ],
      [
        '不要先 Softmax 再传给 F.cross_entropy。',
        'targets 是 torch.long 的 IDs，不是 one-hot vectors。',
        'PyTorch 对 [B,T,V] 的类别维理解不应靠猜测；本例明确 reshape 为 [B×T,V]。',
      ],
      check('为什么 logits_2d 是 [6,5] 而 targets_1d 是 [6]？', [
        paragraph(
          'B×T=3×2=6 道分类题；每题有 V=5 个 raw logits，而 target 只需一个正确类别 ID。',
        ),
      ]),
    ),
    section(
      'o0244-13-bigram-language-model',
      '13. 最简单的 Bigram Language Model',
      '我们已有输入 embedding [V,C]=[5,4]，但还需要一个能直接给所有下一 token 打分的最小模型。',
      [
        '区分通常的 token embedding 表与 Bigram 的 [V,V] next-token-logit table。',
        '用可运行模型显示 [B,T] IDs 如何产生 [B,T,V_vocab] logits 和 loss。',
      ],
      [
        paragraph(
          '通常的输入 nn.Embedding(V,C)=nn.Embedding(5,4) 的 row 是四维连续 representation；本节的 nn.Embedding(V_vocab,V_vocab)=nn.Embedding(5,5) 是另一张表。它的每一 row 直接存五个“候选下一 token”的 logits，不是五维语义 embedding。',
        ),
        formula(
          String.raw`P(x_{t+1}\mid x_1,\ldots,x_t)=P(x_{t+1}\mid x_t)`,
          'Bigram 的强假设：预测时只使用当前 token，忽略更早左侧上下文。',
        ),
        table(
          ['table', 'shape', 'row meaning', 'column / feature meaning'],
          [
            [
              'input embedding E',
              '[V,C]=[5,4]',
              '当前 token',
              '四个 learned features',
            ],
            [
              'Bigram W_bigram',
              '[V,V]=[5,5]',
              '当前 token',
              '五个 candidate next-token logits',
            ],
          ],
        ),
        code(
          'python',
          `import torch
import torch.nn as nn
import torch.nn.functional as F


class BigramLanguageModel(nn.Module):
    def __init__(self, vocab_size: int):
        super().__init__()
        # 每个 ID 查出一整行下一-token logits，而非语义 embedding。
        self.token_table = nn.Embedding(vocab_size, vocab_size)

    def forward(self, token_ids, targets=None):
        # token_ids: [B, T]
        logits = self.token_table(token_ids)
        # logits: [B, T, V_vocab]

        if targets is None:
            return logits, None

        B, T, V_vocab = logits.shape
        loss = F.cross_entropy(
            logits.reshape(B * T, V_vocab),
            targets.reshape(B * T),
        )
        return logits, loss`,
        ),
        formula(
          String.raw`\mathrm{logits}[b,t,:]=W_{\mathrm{bigram}}[\mathrm{token\_ids}[b,t],:]`,
          '输入每一个 ID 时，读出该 ID 的完整 five-candidate logit row；本 batch 输出 [3,2,5]。',
        ),
      ],
      [
        'Bigram row 的值是 logits，Softmax 前不是 probabilities。',
        'nn.Embedding(5,5) 在这里不是同一张 [5,4] semantic/input table。',
        'Bigram 不会综合整句；相同当前 token 必然给相同 logits。',
      ],
      check(
        '为什么 Bigram 的 token_table.weight.shape 是 [5,5]，而输入 embedding 是 [5,4]？',
        [
          paragraph(
            'Bigram 每个 row 必须直接给 V=5 个下一-token logits；普通输入 embedding 每个 row 则只携带 C=4 个 learned features。',
          ),
        ],
      ),
    ),
    section(
      'o0246-14-loop',
      '14. 训练仍然是同一个 Loop',
      'Bigram 刚创建时的 [5,5] 表是随机的；它必须根据右移 targets 调整相对 logits。',
      [
        '把 forward、cross-entropy、zero_grad、backward 与 step 连到一个可运行循环。',
        '再次区分 teacher forcing 的并行训练和生成的逐 token 追加。',
      ],
      [
        code(
          'python',
          `inputs = torch.tensor([
    [0, 1],  # 我→喜欢，喜欢→AI
    [4, 1],  # 猫→喜欢，喜欢→我
    [0, 3],  # 我→学习，学习→AI
], dtype=torch.long)

targets = torch.tensor([
    [1, 2],
    [1, 0],
    [3, 2],
], dtype=torch.long)

torch.manual_seed(7)
model = BigramLanguageModel(vocab_size=5)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-2)

model.train()
for step in range(500):
    logits, loss = model(inputs, targets)         # [3,2,5], scalar

    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    optimizer.step()

    if step % 100 == 0:
        print(step, loss.item())`,
        ),
        formula(
          String.raw`L=-\frac{1}{B\times T}\sum_b\sum_t\log\operatorname{softmax}(\mathrm{logits}[b,t,:])[\mathrm{targets}[b,t]]`,
          '本 batch 对六个位置的 correct next-token negative log probability 求平均。',
        ),
        table(
          ['步骤', '改变的状态'],
          [
            ['forward', '用真实 inputs 得到全部 [3,2,5] logits 和 mean loss'],
            ['zero_grad', '清掉上一轮累积的 gradient'],
            ['backward', '从六个 targets 的 loss 计算每个参数的 gradient'],
            ['step', 'optimizer 用 gradient 更新 [5,5] table'],
          ],
        ),
        callout('现在再回看 Embedding Row 怎样更新', [
          paragraph(
            '在一般、未绑权的语言模型中，flatten(inputs)=[0,1,4,1,0,3]。Input Embedding 的 row 0（我）被 lookup 两次，row 1（喜欢）两次，row 3（学习）一次，row 4（猫）一次；这些使用路径产生的 Gradients 会分别累加回同一参数 row。',
          ),
          code(
            'text',
            `教学示例：假设 Backward 已算出 E[0] 的 gradient

E_before[0] = [ 0.20, -0.10, 0.70, 0.30]
gradient    = [ 0.40, -0.20, 0.10, 0.00]
η           = 0.10

E_after[0]
= E_before[0] - η × gradient
= [0.16, -0.08, 0.69, 0.30]`,
          ),
          paragraph(
            '这组 Gradient 是教学假设值，不能只看语料直接推导。Bigram 本身使用 [V,V]=[5,5] Logit Table，没有独立的 [V,C] Input Embedding；但它的 row update 仍遵循相同的 Parameter − Learning Rate × Gradient 原则。',
          ),
        ]),
      ],
      [
        '训练前不应对 logits 手动 Softmax。',
        '忘记 zero_grad 会让 PyTorch 默认累积梯度。',
        '训练时不把预测追加回 input；本节使用真实前缀的 teacher forcing。',
        '一个 mini-batch 没查到某 row 只说明没有该数据 lookup gradient；weight decay 等优化器规则仍可能影响参数。',
      ],
      check('为什么 “喜欢” row 会收到来自不同 target 的训练信号？', [
        paragraph(
          '在六题中 喜欢→AI 与 喜欢→我 都会查 W_bigram[1,:]；Cross Entropy 会让这一 row 把概率分配给数据中出现的两种后续。',
        ),
      ]),
    ),
    section(
      'o0247-15-sampling-probability-token',
      '15. 从最后位置选择下一个 Token：Argmax 与 Sampling',
      'prompt [我, 喜欢] 的模型输出有两个时间位置；当前轮只应把哪一组 logits 变成新 token？',
      [
        '固定 logits[:, -1, :] 是每个 batch 最后时间位置的唯一 append distribution。',
        '比较确定的 Argmax 与按概率抽取的 Sampling，并保持 next_id shape 为 [B,1]。',
      ],
      [
        code(
          'text',
          `prompt: 我 喜欢 -> [[0,1]], shape [1,2]
logits: [1,2,5]
logits[:, 0, :]: “我”后面是什么
logits[:, 1, :]: “喜欢”后面是什么
last_logits = logits[:, -1, :]  # [1,5]，用于本轮追加`,
        ),
        table(
          ['strategy', 'rule', 'result characteristic'],
          [
            [
              'Argmax',
              '永远选择最大 probability',
              '同一 state 可重复，较确定但可能单一',
            ],
            [
              'Sampling',
              '按 Softmax probability 抽样',
              '高概率更常出现，低概率仍可能被选，更多样',
            ],
          ],
        ),
        code(
          'python',
          `@torch.no_grad()
def generate(model, token_ids, max_new_tokens, temperature=1.0):
    if temperature <= 0:
        raise ValueError("temperature 必须大于 0")

    model.eval()
    for _ in range(max_new_tokens):
        logits, _ = model(token_ids)              # [B, T, V_vocab]
        last_logits = logits[:, -1, :]            # [B, V_vocab]
        probabilities = F.softmax(
            last_logits / temperature,
            dim=-1,
        )                                         # [B, V_vocab]
        next_id = torch.multinomial(
            probabilities,
            num_samples=1,
        )                                         # [B, 1]
        token_ids = torch.cat(
            (token_ids, next_id),
            dim=1,
        )                                         # [B, T + 1]

    return token_ids

# Greedy alternative:
# next_id = torch.argmax(last_logits, dim=-1, keepdim=True)  # [B,1]`,
        ),
        paragraph(
          '温度 τ>0 使用 softmax(last_logits / τ)：τ=1 保持原分布，τ<1 更尖锐，τ>1 更平坦。本教学词表没有 <EOS>，所以必须用 max_new_tokens 限定循环。',
        ),
      ],
      [
        'logits[-1,:,:] 取的是最后一个 batch；正确切片是 logits[:, -1, :]。',
        'Softmax 应沿 vocabulary dim=-1，而不是时间维。',
        '不能把全部 [B,T,V] logits 一次采样并追加；当前轮只追加一个 [B,1] token。',
        'Sampling 不是均匀随机；Argmax 也不一定更“正确”。',
      ],
      check('为什么 next_id 必须是 [B,1] 而不是 [B]？', [
        paragraph(
          'torch.cat 沿 dim=1 追加一个新的时间位置；[B,1] 正好是一列 token ID，与已有 token_ids [B,T] 拼成 [B,T+1]。',
        ),
      ]),
    ),
    section(
      'o0250-16-bigram-model',
      '16. Bigram 的关键局限：只记得最后一个词',
      '两个 prompt 可以有不同开头，却以同一 token 结尾；Bigram 是否能据此给不同的下一词分布？',
      [
        '用结构性反例说明限制来自信息通路，而非只怪数据、训练轮数或词表大小。',
        '为 Attention 需要读取整个可见前缀建立明确动机。',
      ],
      [
        code(
          'python',
          `prompt_a = torch.tensor([[0, 1]])  # 我 喜欢
prompt_b = torch.tensor([[4, 1]])  # 猫 喜欢

logits_a, _ = model(prompt_a)
logits_b, _ = model(prompt_b)

last_a = logits_a[:, -1, :]
last_b = logits_b[:, -1, :]

assert torch.equal(last_a, last_b)`,
        ),
        paragraph(
          '两个 prompt 最后的 ID 都是 1，所以 Bigram 都只查 W_bigram[1,:]。这不是偶然的训练结果：只要表仍是 [V_vocab,V_vocab] 并且输入接口只提供当前 token，更早的 我 或 猫 不可能影响最后位置输出。',
        ),
        formula(
          String.raw`a_{\mathrm{last}}=b_{\mathrm{last}}\Rightarrow W_{\mathrm{bigram}}[a_{\mathrm{last}},:]=W_{\mathrm{bigram}}[b_{\mathrm{last}},:]\Rightarrow P(\mathrm{next}\mid a)=P(\mathrm{next}\mid b)`,
          '相同末 token 的两个上下文，在 Bigram 中必得相同 next-token distribution。',
        ),
        paragraph(
          '固定词表的表只有 5×5=25 个 logits；它可以记住一步转移，是教学与数据管线 baseline，却不能表示同一当前词在不同长上下文中的不同续写。',
        ),
      ],
      [
        '多训练几轮无法创造模型没有提供的早期-token 信息通路。',
        '增大单 token embedding 宽度不等于能访问更多时间位置。',
        '偶尔生成通顺片段不证明模型利用了整句；局部相邻统计也可能看似合理。',
      ],
      check('为何 [我,喜欢] 与 [猫,喜欢] 的 last logits 必然相同？', [
        paragraph(
          '最后 token 都是 喜欢（ID 1），Bigram 只读取同一 row W_bigram[1,:]，不读取更早位置。',
        ),
      ]),
    ),
    section(
      'o0251-17-perplexity',
      '17. Perplexity：模型对真实下一词有多“困惑”',
      '训练 loss 下降不够直观；还需要一个能在留出数据上总结 next-token probability 拟合的指标。',
      [
        '把有效 token 的平均自然对数 NLL 指数化，并说明何时可横向比较。',
        '明确 PPL 仅衡量正规化 next-token likelihood，不等于事实、推理或安全质量。',
      ],
      [
        formula(
          String.raw`\mathrm{mean\_NLL}=-\frac{1}{N}\sum_i\log P(x_i\mid x_{<i}),\qquad \mathrm{PPL}=\exp(\mathrm{mean\_NLL})`,
          'N 是有效预测 token 数；本课程自然对数下 PPL 是有效 token 平均 NLL 的 exp。',
        ),
        table(
          ['每个真实 token 的 probability', 'mean_NLL', 'PPL', '直觉'],
          [
            [
              '1/5（五个候选均匀）',
              'ln(5) ≈ 1.609',
              '5',
              '像在五个候选间同样犹豫',
            ],
            ['1/2', 'ln(2) ≈ 0.693', '2', '平均像在两个候选间犹豫'],
          ],
        ),
        code(
          'python',
          `import math


@torch.no_grad()
def evaluate_perplexity(model, data_loader):
    model.eval()
    total_nll = 0.0
    total_tokens = 0

    for inputs, targets in data_loader:
        logits, _ = model(inputs)                 # [B, T, V_vocab]
        V_vocab = logits.size(-1)
        nll_sum = F.cross_entropy(
            logits.reshape(-1, V_vocab),
            targets.reshape(-1),
            reduction="sum",
        )
        total_nll += float(nll_sum)
        total_tokens += targets.numel()

    if total_tokens == 0:
        raise ValueError("没有可用于评估的 token")

    return math.exp(total_nll / total_tokens)`,
        ),
        callout(
          '可比条件',
          [
            list(
              [
                '同一 tokenizer、Vocabulary、留出语料与数据划分。',
                '同一文本预处理、BOS/EOS/PAD、mask/ignore_index 规则。',
                '同一 context length、窗口 / stride 策略、自然对数和有效-token 加权 reduction。',
                '同一正规化自回归 next-token 任务，并都使用 model.eval() 与 torch.no_grad()。',
              ],
              true,
            ),
            paragraph(
              '若有 padding 或 ignore_index=-100，分母也只能计算未被 mask 的有效 targets；不能简单平均大小不同 batch 的 mean losses。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '先平均每个 token 的 NLL，再做一次 exp；不能先算每 token PPL 再平均。',
        '不同 tokenizer 的 PPL 不可直接比较。',
        '训练集 PPL 接近 1 可能是记忆，不代表泛化。',
        '低 PPL 不保证回答真实、安全或对人有用。',
      ],
      check('什么时候可以写 perplexity = torch.exp(loss)？', [
        paragraph(
          '只有 loss 确实是所有有效 token 的平均自然对数 NLL 时；跨 batch 时要确保按有效 token 数加权。',
        ),
      ]),
    ),
    section(
      'o0252-18-week-6-7',
      '18. Week 6 总结：一条完整的最小语言模型流水线',
      '零散记住 API 容易在维度变化处迷路；需要把文本、IDs、logits、loss 和生成重新连成一个接口契约。',
      [
        '复盘主线的每一个 shape 与训练/生成分叉。',
        '说明 Attention 会换掉上下文建模模块，而不会推翻 next-token logits、loss 或最后位置生成。',
      ],
      [
        chain([
          '文本按 Tokenizer 编码成 raw IDs [3,3]',
          '右移得到 inputs / targets [3,2]',
          '一般 LM：input embedding [3,2,4] → context model / output head → logits [3,2,5]',
          'Bigram：IDs [3,2] → 直接查 [5,5] logit table → logits [3,2,5]',
          '展平为 logits [6,5] 与 targets [6]',
          'F.cross_entropy 得到 scalar mean loss',
          'backward → optimizer 更新；生成则取最后位置并追加',
        ]),
        code(
          'text',
          `Week 6 fixed batch:
raw IDs                              [3,3]
shifted inputs                       [3,2]

General language model path:
IDs                                  [3,2]
input embedding                      [3,2,4]
context model + output head          [3,2,5] vocabulary logits

Bigram shortcut path:
IDs                                  [3,2]
direct W_bigram [5,5] lookup         [3,2,5] vocabulary logits

flattened logits                     [6,5]
flattened targets                    [6]
mean cross-entropy loss              scalar

Generation from prompt [[0,1]]:
prompt IDs                           [1,2]
model logits                         [1,2,5]
last logits[:, -1, :]                [1,5]
next_id                              [1,1]
appended prompt                      [1,3]`,
        ),
        callout('两条建模路径，不要串接', [
          paragraph(
            '一般语言模型把 IDs 先查成四维 input embeddings [3,2,4]，再由能使用左侧上下文的模块和 output head 产生 [3,2,5] logits。Bigram 是替代这个中间表示与上下文模块的 shortcut：它直接把每个 ID 查为一 row 五候选 logits，所以没有 [3,2,4] 中间张量。两条路径随后都用相同的 right-shift targets、[6,5]/[6] cross-entropy 和最后位置生成接口。',
          ),
        ]),
        table(
          ['训练', '生成'],
          [
            [
              '文本 → IDs → shifted inputs/targets → [B,T,V] logits → flatten → cross-entropy → backward → update',
              'prompt IDs → [B,T,V] logits → logits[:, -1, :] [B,V] → Argmax/Sampling → next_id [B,1] → append → repeat',
            ],
          ],
        ),
      ],
      [
        'T 是当前 sequence length，不是 Vocabulary size V。',
        '展平不会丢掉监督关系；同序展开的 logits 与 targets 行仍对齐。',
        '训练不只用最后位置；生成当前轮才只用最后位置。',
        '低 PPL 不会消除 Bigram 只能看到当前 token 的结构限制。',
      ],
      check(
        '为何 Week 7 加入 Attention 后仍保留 logits、cross-entropy 和 logits[:, -1, :]？',
        [
          paragraph(
            'Attention 改善的是每个位置如何融合可见左侧上下文；语言模型仍输出 vocabulary logits，用 right-shift target 训练，并自回归地从最后位置追加一个 token。',
          ),
        ],
      ),
    ),
    section(
      'o0253-19-week-6-week-7',
      '19. 从 Bigram 过渡到 Attention：让当前位置回看整个前缀',
      'Bigram 对 [我,喜欢] 与 [猫,喜欢] 的最后位置给出同一分布；需要一种机制让“喜欢”也能按需使用前面的 我 或 猫。',
      [
        '给出 Self-Attention 的问题、Query/Key/Value 的直觉、因果约束和 shape。',
        '保留 Week 6 的 next-token interface，同时谨慎说明 Attention 提供能力而非保证理解。',
      ],
      [
        paragraph(
          'Self-Attention 让每个位置动态汇总允许看到的历史位置。Query 是当前位置正在寻找什么信息，Key 是每个候选位置提供的匹配线索，Value state 是匹配后真正汇总的内容。它们通常由同一 hidden representation 的不同可学习投影得到，不是三个额外 token。',
        ),
        table(
          ['quantity', 'typical shape', 'meaning'],
          [
            ['query, key', '[B,T,d_k]', '用于位置间匹配'],
            ['value_states', '[B,T,d_v]', '被权重汇总的内容'],
            [
              'attention scores / weights',
              '[B,T,T]',
              '每个 Query 对每个 Key position 的分数 / 归一化权重',
            ],
            ['context', '[B,T,d_v]', '加权 Values'],
            [
              'final vocabulary logits',
              '[B,T,V_vocab]',
              '仍是 Week 6 的 next-token 接口',
            ],
          ],
        ),
        code(
          'python',
          `import math

# query, key:    [B, T, d_k]
# value_states:  [B, T, d_v]
scores = query @ key.transpose(-2, -1)             # [B, T, T]
scores = scores / math.sqrt(d_k)

# causal_mask 可广播到 [B,T,T]；True 表示允许查看的位置。
scores = scores.masked_fill(~causal_mask, float("-inf"))
weights = F.softmax(scores, dim=-1)                # [B, T, T]
context = weights @ value_states                   # [B, T, d_v]`,
        ),
        formula(
          String.raw`\mathrm{score}_{t,j}=\frac{q_t\cdot k_j}{\sqrt{d_k}},\qquad \alpha_{t,j}=\operatorname{softmax}_j(\mathrm{score}_{t,j}),\qquad \mathrm{context}_t=\sum_{j\le t}\alpha_{t,j}\,\mathrm{value}_j`,
          'causal mask 只允许 j≤t；每个 Query 在可见 Key positions 的最后一维上归一化。',
        ),
        paragraph(
          '对 prompt A=[我,喜欢] 与 B=[猫,喜欢]，第二位置的当前 token 虽都为 喜欢，但 Attention 可读取不同的第 0 位置，因此最后 logits 可能不同。它只是提供使用更长上下文的路径；未经训练并不保证模型会给某个特定答案，更不保证“理解”。',
        ),
      ],
      [
        'Attention 不会替代 token embedding、vocabulary output head 或 cross-entropy。',
        '没有 causal mask 就会偷看未来 target，破坏自回归训练目标。',
        'Attention 的 Value state 不等于词表大小 V_vocab。',
        'Softmax 对每个 Query 的可见 Key 维（scores 最后一维）做，不跨 Query positions。',
        '进入 Week 7 后生成仍只使用 logits[:, -1, :]。',
      ],
      check(
        'Attention 如何让两个都以“喜欢”结尾的 prompt 可能产生不同 last logits？',
        [
          paragraph(
            'Bigram 只查 喜欢 的一 row；Attention 的第二位置还可按 causal mask 关注前面不同的 我 或 猫，得到不同 context representation，再映射为可能不同的 vocabulary logits。',
          ),
        ],
      ),
    ),
  ],
};
