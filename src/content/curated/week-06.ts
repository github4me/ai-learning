/* eslint-disable no-useless-escape -- Formula literals use LaTex command markers. */
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

const latexCommandPattern =
  /\b(alpha|cdot|exp|frac|in|le|ldots|ln|log|mathbb|mathrm|mid|operatorname|partial|prod|qquad|quad|Rightarrow|sqrt|sum|text|times|to)\b/gu;

const formula = (latex: string, accessibleText: string): CuratedBodyBlock => ({
  type: 'formula',
  latex: latex
    .replace('Einmathbb', String.raw`E\in\mathbb`)
    .replace(latexCommandPattern, String.raw`\$1`),
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
): CuratedBodyBlock => ({ type: 'table', headers, rows, ...(caption ? { caption } : {}) });

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
  keyQuestion: '模型怎样把“我 喜欢 AI”变成可训练的 next-token prediction，并逐个 token 生成？',
  objectives: [
    '区分 token、tokenizer、vocabulary、ID、embedding、logit 与 probability。',
    '沿同一批数据追踪 [3,3] → [3,2] → [3,2,4] → [3,2,5] → [6,5]。',
    '用 Bigram 看清交叉熵训练、最后位置生成，以及它为何需要 Attention。',
  ],
  estimatedReadingMinutes: 65,
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
        paragraph('本周始终使用同一个 tokenizer 规则：按空格切分。固定词表、语料和维度不随章节改变。训练时模型同时学习六个“当前 token → 真实下一 token”问题；生成时则一次只追加一个 token。'),
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
        paragraph('我→喜欢、喜欢→AI、猫→喜欢、喜欢→我、我→学习、学习→AI。它们来自同一三条语料各自右移一位后的两个位置。'),
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
        paragraph('Token 是 Tokenizer 交给模型处理的基本单位，不一定是完整单词，也可能是字符、subword 或 byte。本周为了能手算，Tokenizer 按空格切分。Vocabulary 是它允许使用的有限 token 清单；Token ID 是某个 token 在这份清单中的整数地址。'),
        table(
          ['原文', 'Tokens', 'IDs'],
          [
            ['我 喜欢 AI', '[我, 喜欢, AI]', '[0,1,2]'],
            ['猫 喜欢 我', '[猫, 喜欢, 我]', '[4,1,0]'],
            ['我 学习 AI', '[我, 学习, AI]', '[0,3,2]'],
          ],
          '同一 Tokenizer 下的完整编码',
        ),
        callout('把四个词分开记', [
          list([
            'Token：实际交给模型的一个处理单位，例如“猫”。',
            'Tokenizer：切分、编码和解码的规则与程序。',
            'Vocabulary：可被编码的 token 清单。',
            'Token ID：token 在 Vocabulary 中的位置，例如 猫 的地址是 4。',
          ]),
        ], 'concept'),
      ],
      [
        'Token 不等于“单词”；单位由 Tokenizer 规则决定。',
        '猫=4、AI=2 不表示猫比 AI 大两倍。',
        'ID 负责寻址，不负责表达含义。',
      ],
      check('“猫 喜欢 我”为何编码为 [4,1,0]？ID 4 表达什么？', [
        paragraph('因为 Vocabulary 中 猫 位于索引 4；4 只是地址，不是语义大小。'),
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
        paragraph('Embedding 把离散 ID 查成一个可学习的连续向量。这里的输入表是 nn.Embedding(V,C) = nn.Embedding(5,4)：五个 Vocabulary rows，每行四个 learned features。下面是明确标注的教学初始值，不是人工写好的词义。'),
        table(['ID / Token', 'c₀', 'c₁', 'c₂', 'c₃'], embeddingRows, 'didactic initial value：E 的形状 [V,C]=[5,4]'),
        formula('E[\mathrm{token\_id}]\in\mathbb{R}^{4}', 'token_id 查出 E[token_id]，得到长度 C=4 的向量。'),
        paragraph('例如 我 选择 E[0]=[0.20,-0.10,0.70,0.30]；猫 选择 E[4]=[-0.70,0.40,0.30,0.60]。训练会经由 Loss、Backpropagation 和 Optimizer 修改这些坐标。'),
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
        formula('E\in\mathbb{R}^{V\times C}=\mathbb{R}^{5\times4}', 'E 的 row 轴大小 V=5，每行一个 token；column 轴大小 C=4，每列一个 learned feature。'),
        table(['ID / Token', 'c₀', 'c₁', 'c₂', 'c₃'], embeddingRows, '与第 2 节相同的 didactic initial value'),
        code(
          'text',
          `one_hot(4) = [0,0,0,0,1]

one_hot(4) @ E
= E[4]
= [-0.70,0.40,0.30,0.60]

nn.Embedding(5,4).weight.shape == [5,4]`,
        ),
        paragraph('One-hot 是选择机制：它只把第 4 row 选出来。实际实现不会创建长度 V 的巨大 one-hot vector，而是直接读取 E[id]；两者前向结果相同。'),
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
      '4. Batch 从 [B,T] 变成 [B,T,C]',
      '单个 ID 的 lookup 已明确，但训练会同时处理多个 sequence 和多个位置。',
      [
        '定义 rank、axis、axis size，以及 B、N、T、C、V 的具体含义。',
        '逐位置显示 inputs [3,2] 如何只新增 feature axis 变为 [3,2,4]。',
      ],
      [
        paragraph('rank 是 axis 的数量；[3,2] 有两个 axis，axis size 分别是 3 和 2。N=3 是原句长度，右移后 T=N−1=2。Embedding 只接收 inputs，targets 仍是整数 ID。'),
        code(
          'text',
          `raw IDs [B,N] = [[0,1,2], [4,1,0], [0,3,2]]  # [3,3]
inputs  [B,T] = [[0,1],   [4,1],   [0,3]]    # [3,2]
targets [B,T] = [[1,2],   [1,0],   [3,2]]    # [3,2]

[B,T] --Embedding(V,C)--> [B,T,C]
[3,2] ------------------> [3,2,4]`,
        ),
        table(
          ['位置', 'Token / ID', 'x[b,t,:]'],
          [
            ['[0,0]', '我 / 0', '[0.20,-0.10,0.70,0.30]'],
            ['[0,1]', '喜欢 / 1', '[0.60,0.30,-0.20,0.10]'],
            ['[1,0]', '猫 / 4', '[-0.70,0.40,0.30,0.60]'],
            ['[1,1]', '喜欢 / 1', '[0.60,0.30,-0.20,0.10]'],
            ['[2,0]', '我 / 0', '[0.20,-0.10,0.70,0.30]'],
            ['[2,1]', '学习 / 3', '[0.10,0.20,0.90,0.40]'],
          ],
          '六个输入位置都从同一张 [5,4] didactic initial matrix 查出',
        ),
        table(
          ['axis', 'size', 'meaning'],
          [
            ['B', '3', '三个 sequences'],
            ['N', '3', 'shift 前每个 source sequence 的 tokens'],
            ['T', '2', '每条 shifted input 的训练位置'],
            ['C', '4', '每个位置的连续 features'],
            ['V', '5', 'lookup table rows / vocabulary candidates，不是 x 的额外 axis'],
          ],
        ),
      ],
      [
        'T=2，不是原句的 N=3。',
        'Embedding 不改变 B 或 T，只新增 C。',
        '[3,2,4] 最后一维是 features，不是 vocabulary candidates。',
      ],
      check('x[1,0,:] 是什么？整个 x 有多少标量？', [
        paragraph('它是猫的 row [-0.70,0.40,0.30,0.60]；总数为 3×2×4=24。'),
      ]),
    ),
    section(
      'o0230-5-embedding',
      '5. 一个 Embedding Row 怎样更新',
      '初始 Embedding 是任意数值；需要把 batch、loss、backprop、lookup gradient 和 optimizer update 连成一条可见链路。',
      [
        '看见重复 token 的 gradient 如何汇总到同一参数 row。',
        '区分这条 input-lookup gradient 路径与其他可能的参数更新路径。',
      ],
      [
        code(
          'text',
          `flatten(inputs) = [0,1,4,1,0,3]

row 0（我）被选择两次：我→喜欢、我→学习
row 1（喜欢）被选择两次
row 3（学习）被选择一次
row 4（猫）被选择一次
row 2（AI）在 inputs 中被选择零次`,
        ),
        table(['ID / Token', 'c₀', 'c₁', 'c₂', 'c₃'], embeddingRows, '更新前仍使用同一 didactic initial [5,4] matrix'),
        code(
          'text',
          `E_before[0] = [ 0.20, -0.10, 0.70, 0.30]
gradient    = [ 0.40, -0.20, 0.10, 0.00]
η           = 0.10

E_after[0]
= E_before[0] - η × gradient
= [0.16, -0.08, 0.69, 0.30]`,
        ),
        callout('高级边界：这不是“没 lookup 就一定不更新”', [
          paragraph('上面的 gradient 是对六任务平均 loss backprop 后的教学示例，不能只由 corpus 推导。这里讨论独立、未与输出 head 绑权的 nn.Embedding(5,4) 的 input-lookup 路径：AI 虽出现在 targets，却未出现在 inputs，所以 E[2] 没有这一路的 lookup gradient。若权重绑定，输出路径可给出 dense gradients；decoupled weight decay 或已有 optimizer moments 也可能改变零 lookup-gradient 参数。'),
        ]),
      ],
      [
        'rows 不按人类语义标签手工调整。',
        '重复 token 不会新建第二 row；所有出现都贡献给同一 row。',
        '“没有 lookup gradient”只描述这一路径，不能泛化为参数绝不会改变。',
      ],
      check('哪些 rows 收到 input-lookup gradient？AI row 为什么没有？', [
        paragraph('{0,1,3,4} 收到；ID 2 未出现在 inputs，只出现在 targets，因此 input lookup 没有选择 E[2]。'),
      ]),
    ),
    section(
      'o0232-6-language-model',
      '6. Language Model：根据上下文为所有候选分配概率',
      '有了连续表示后，模型仍需回答：在当前上下文之后，词表中的哪一个 token 可能出现？',
      [
        '先用条件概率的直觉说明“已知左侧内容后预测下一个 token”。',
        '明确模型输出的是整个 Vocabulary distribution，不是一个保证为真的答案。',
      ],
      [
        paragraph('条件概率先用一句话理解：在已经看到上下文后，某候选成为下一个 token 的相对可能性。Language Model 为每个 Vocabulary candidate 给出这一整张分布；高概率表示更符合训练中学到的模式，不保证内容真实。'),
        formula('P(x_{t+1}\mid x_{\le t})', '给定到位置 t 为止的左侧 token，预测下一 token 的条件概率。'),
        formula('\sum_{v=0}^{V-1}P(x_{t+1}=v\mid x_{\le t})=1', '五个 candidate 的条件概率必须加总为 1。'),
        table(
          ['输入位置', '当前可见上下文（一般语言模型）', 'Target'],
          [
            ['[0,0]', '我', '喜欢'],
            ['[0,1]', '我 喜欢', 'AI'],
            ['[1,0]', '猫', '喜欢'],
            ['[1,1]', '猫 喜欢', '我'],
            ['[2,0]', '我', '学习'],
            ['[2,1]', '我 学习', 'AI'],
          ],
          'B×T=3×2 的六道 next-token 分类题',
        ),
        paragraph('一般语言模型可使用可见的全部左侧上下文；第 13 节的 Bigram 是刻意简化的特殊模型，只使用当前 token。'),
      ],
      [
        'Language Model 输出的是完整分布，不只是 argmax token。',
        'P(AI | 我 喜欢) 可以与 P(AI | 我) 完全不同。',
        '概率描述模型分布，不是事实核验。',
      ],
      check('为什么“我→喜欢”和“我→学习”可以同时出现在训练集中？', [
        paragraph('同一当前 token 可以在不同上下文或样本中有不同后续；模型学习的是分布而非为每个输入地址写一个永远唯一的答案。'),
      ]),
    ),
    section(
      'o0234-7-autoregressive',
      '7. Autoregressive：把一次预测重复成生成',
      '模型每次只给出一个 next-token distribution，却需要生成更长的 continuation。',
      [
        '理解生成把同一“上下文 → 分布 → 选择 → 追加”过程逐轮重复。',
        '区分 teacher-forced parallel training 与 iterative autoregressive generation。',
      ],
      [
        chain([
          '已有 prompt IDs',
          '模型输出 logits [B,T,V]',
          '只取 logits[:, -1, :]',
          'Softmax / 选择 next_id [B,1]',
          '追加到 prompt',
          '重复',
        ]),
        table(
          ['对比项', '训练（teacher forcing）', '生成（autoregressive）'],
          [
            ['已知内容', '真实 inputs 与真实 targets', '只有当前 prompt，之后包含模型刚选出的 token'],
            ['一次处理的位置', '并行处理全部 B×T 个位置', '当前轮只从最后位置选择一个 token'],
            ['loss / backward / step', '计算并更新参数', '不计算或反传，不更新参数'],
            ['序列长度', '固定训练窗口 [3,2]', '每轮增长一个 token'],
          ],
        ),
        formula('P(x_{1:T})=\prod_{t=1}^{T}P(x_t\mid x_{<t})', '一段序列的概率是每一步条件概率的连乘，而不是彼此独立的概率。'),
        paragraph('auto 指模型刚选出的输出会成为下一轮输入之一，并不表示“自动训练”。若前一步选错，后续分布也会在该生成历史上继续计算。'),
      ],
      [
        '生成不是一次 forward 就产生任意长文本。',
        '训练可以并行所有位置，生成仍有逐 token 的顺序依赖。',
        '生成时不会调用 backward() 或 optimizer.step()。',
      ],
      check('为什么训练可并行而生成要逐个 token？', [
        paragraph('训练时真实右移 inputs 已经给齐每个位置；生成的下一输入依赖本轮刚选出的 next_id，必须先确定它。'),
      ]),
    ),
    section(
      'o0235-8-input-target',
      '8. Input 和 Target 为什么错开一位',
      'next-token prediction 需要模型看到当前 token，却不能在当前位置先看到正确的下一 token。',
      [
        '由同一序列自动构造 input 与正确标签，说明自监督答案来自原始文本。',
        '说明 shift 定义标签，causal mask 则在可用的上下文模型中阻止未来泄漏。',
      ],
      [
        code(
          'text',
          `raw IDs [B,N] = [[0,1,2], [4,1,0], [0,3,2]]  # [3,3]
inputs  [B,T] = [[0,1],   [4,1],   [0,3]]    # [3,2]
targets [B,T] = [[1,2],   [1,0],   [3,2]]    # [3,2]

T = N - 1 = 2`,
        ),
        table(
          ['batch, position', 'input token', 'target token', '一般 causal LM 此处可见的左侧'],
          [
            ['[0,0]', '我', '喜欢', '我'],
            ['[0,1]', '喜欢', 'AI', '我 喜欢'],
            ['[1,0]', '猫', '喜欢', '猫'],
            ['[1,1]', '喜欢', '我', '猫 喜欢'],
            ['[2,0]', '我', '学习', '我'],
            ['[2,1]', '学习', 'AI', '我 学习'],
          ],
        ),
        callout('shift 和 causal mask 分工不同', [
          paragraph('right shift 规定每个位置的“正确下一 token”。一般 Transformer 一次读入整行时还必须用 causal mask 禁止位置 t 看右侧 future token；Bigram 每个位置只查当前 token，本身没有跨位置读取。'),
        ]),
      ],
      [
        'target 与 input shape 相同，不表示内容相同。',
        '把 input 和 target 完全相同会让模型复制已见答案，形成信息泄漏。',
        'shift 不是移动 Embedding，而是移动监督关系。',
      ],
      check('target[1,1] 是什么？它对应哪个预测问题？', [
        paragraph('target[1,1]=0，即 我；在一般 causal LM 中它是“猫 喜欢 → 我”的监督，在 Bigram 中简化为“喜欢 → 我”。'),
      ]),
    ),
    section(
      'o0237-9-model-probability',
      '9. Logits：模型先给五个候选打分',
      '神经网络不能直接输出汉字；它先需要为同一份 Vocabulary 中每个候选给出可比较的原始分数。',
      [
        '定义 logit 与输出轴 V，并把 embedding/context representation 映射到每个 token candidate。',
        '理解 logit 不是 probability：可为负，且不要求和为 1。',
      ],
      [
        paragraph('对一个预测位置，logit 向量的索引必须与固定词表顺序 [我, 喜欢, AI, 学习, 猫] 对齐。若上下文表示 h 有 C=4 个 features，常见 output head 把 [C] 映射为 [V]。'),
        formula('z=Wh+b,\quad W\in\mathbb{R}^{V\times C},\quad [C]=[4]\to[V]=[5]', '输出层对四维 hidden vector 产生五个未经归一化的候选分数。'),
        table(
          ['Token ID', 'Token', 'logit z'],
          [
            ['0', '我', '0'],
            ['1', '喜欢', '2'],
            ['2', 'AI', '1'],
            ['3', '学习', '-1'],
            ['4', '猫', '0'],
          ],
          '上下文“我”的固定 labelled logits example；候选顺序不可改变',
        ),
        formula('z=[0,2,1,-1,0]', '喜欢得分最高，但 2 是 score，不是 200% probability。'),
        formula('[B,T,C]=[3,2,4]\to[B,T,V]=[3,2,5]', '每个 batch、时间位置都有一个五-token logit vector。'),
      ],
      [
        'logit 不是 probability；负 logit 合法。',
        '[B,T,V] 的最后一维 V 才是候选类别。',
        '所有 logits 同时加一个常数不改变 Softmax，因为相对差距不变。',
      ],
      check('本例 z[3]=-1 代表什么？', [
        paragraph('它表示候选 学习 的原始相对分数较低，不是 -1% 概率；Softmax 后它仍有正概率。'),
      ]),
    ),
    section(
      'o0239-10-softmax-logits-probability',
      '10. Softmax：把 Logits 变成 Probability',
      'logits 能比较高低，但不能直接说明某 token 的概率，也不保证候选数加总为 1。',
      [
        '把任意五个 logits 转为合法、可用于解释和 sampling 的 Vocabulary distribution。',
        '完整计算固定的 labelled example，保留所有约定数值。',
      ],
      [
        formula('p_i=\frac{e^{z_i}}{\sum_{j=0}^{V-1}e^{z_j}}', '先把每个 logit 变正，再除以所有五个 exponentials 的总和。'),
        table(
          ['candidate order', 'logit', 'exponential', 'probability'],
          [
            ['我', '0', '1.000', '0.080'],
            ['喜欢', '2', '7.389', '0.592'],
            ['AI', '1', '2.718', '0.218'],
            ['学习', '-1', '0.368', '0.029'],
            ['猫', '0', '1.000', '0.080'],
          ],
          '固定顺序 [我, 喜欢, AI, 学习, 猫]；logits [0,2,1,-1,0]'),
        code(
          'text',
          `exponentials = [1.000,7.389,2.718,0.368,1.000]
sum = 12.475
probabilities = [0.080,0.592,0.218,0.029,0.080]
0.080 + 0.592 + 0.218 + 0.029 + 0.080 ≈ 1`,
        ),
        callout('数值稳定性（高级）', [
          paragraph('softmax(z)=softmax(z−max(z))。本例可先从 [0,2,1,-1,0] 减去最大值 2，得到 [-2,0,-1,-3,-2]；概率不变，但能避免过大的 exponentials。训练实现交给 PyTorch 的稳定算法。'),
        ]),
      ],
      [
        'Softmax 产生分布，不负责决定最终 token。',
        '某 token 的概率取决于全部 logits，不只取决于自己的分数。',
        '训练时不要先手动 Softmax 再交给 F.cross_entropy；展示或 sampling 时才显式计算。',
        '对 [B,T,V] 应沿 vocabulary 维 dim=-1 做 Softmax。',
      ],
      check('为何 喜欢 的 logit 最高，但它不是“唯一答案”？', [
        paragraph('Softmax 给它 0.592，不是 1；其余候选仍保留概率，sampling 也可能选择它们。'),
      ]),
    ),
    section(
      'o0241-11-cross-entropy-probability',
      '11. Cross Entropy：把正确答案的概率变成 Loss',
      '一张概率表不能直接让 optimizer 判断更新方向；训练需要一个可最小化的标量错误分数。',
      [
        '读取正确 target 的 probability，把预测质量转为 loss 并反传给全部竞争 logits。',
        '用固定 Softmax distribution 精确计算 target=喜欢 时的 0.524。',
      ],
      [
        formula('L=-\ln(p_y)', '单个位置的 Cross Entropy：y 是正确 token ID，p_y 是该位置给正确 token 的概率。'),
        table(
          ['上下文', 'target', 'p(correct)', 'loss'],
          [
            ['我', '喜欢（ID 1）', '0.592', '-ln(0.592) ≈ 0.524'],
            ['我（若 target 改为）', 'AI', '0.218', '约 1.524'],
            ['我（若 target 改为）', '猫', '0.080', '约 2.524'],
          ],
        ),
        paragraph('Cross Entropy 不只检查 argmax 是否正确：若正确答案同样是喜欢，概率从 0.51 升到 0.90，loss 仍会下降。对多个位置，平均 loss 是每个正确 target 负对数概率的平均。'),
        formula('\frac{\partial L}{\partial z_i}=p_i-\mathrm{one\_hot}(y)_i', 'Softmax 与 Cross Entropy 组合后，logit gradient 等于 probability 减去正确 target 的 one-hot vector。'),
        code(
          'text',
          `p                     = [0.080, 0.592, 0.218, 0.029, 0.080]
one_hot(target=喜欢)   = [0,     1,     0,     0,     0]
p - one_hot(target)   = [0.080,-0.408, 0.218, 0.029, 0.080]

Gradient Descent subtracts this gradient:
喜欢 has a negative gradient, so its relative logit is pushed up;
the other candidates have positive gradients, so their relative logits are pushed down.`,
        ),
      ],
      [
        'loss 不是 accuracy 或百分比；越低越好，理论下界为 0。',
        'loss 直接读正确 token 的 probability，但 Softmax 让全部 logits 相互竞争，所以全部都会收到梯度。',
        '训练通常平均全部位置，不只看最后一个 token。',
      ],
      check('target 是 喜欢 且 p=0.592 时 loss 为何约 0.524？', [
        paragraph('按自然对数计算：L=−ln(p_y)=−ln(0.592)≈0.524。'),
      ]),
    ),
    section(
      'o0243-12-pytorch-crossentropyloss-logits',
      '12. 为什么 PyTorch F.cross_entropy 接收 Logits',
      '数学说明中先谈 probability，但训练 API 若再接收已 Softmax 的 probability，会重复内部变换并降低数值稳定性。',
      [
        '直接把 raw logits 与整数 target IDs 传入 F.cross_entropy。',
        '把六个 [B,T] 位置明确展平为六行 V=5 的分类题。',
      ],
      [
        paragraph('F.cross_entropy 在内部稳定地结合 LogSoftmax 与 negative log likelihood。因此它的输入是 raw logits；targets 是范围 0 到 V−1 的 torch.long IDs，而不是 one-hot vectors。'),
        table(
          ['flattened row', 'batch position', 'input / context', 'target token', 'target ID'],
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
        formula('[3,2,5]\to[6,5]\quad\text{and}\quad[3,2]\to[6]', '合并 B 与 T，只改变组织方式；对应关系和 vocabulary axis V=5 保持不变。'),
      ],
      [
        '不要先 Softmax 再传给 F.cross_entropy。',
        'targets 是 torch.long 的 IDs，不是 one-hot vectors。',
        'PyTorch 对 [B,T,V] 的类别维理解不应靠猜测；本例明确 reshape 为 [B×T,V]。',
      ],
      check('为什么 logits_2d 是 [6,5] 而 targets_1d 是 [6]？', [
        paragraph('B×T=3×2=6 道分类题；每题有 V=5 个 raw logits，而 target 只需一个正确类别 ID。'),
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
        paragraph('通常的输入 nn.Embedding(V,C)=nn.Embedding(5,4) 的 row 是四维连续 representation；本节的 nn.Embedding(V_vocab,V_vocab)=nn.Embedding(5,5) 是另一张表。它的每一 row 直接存五个“候选下一 token”的 logits，不是五维语义 embedding。'),
        formula('P(x_{t+1}\mid x_1,\ldots,x_t)=P(x_{t+1}\mid x_t)', 'Bigram 的强假设：预测时只使用当前 token，忽略更早左侧上下文。'),
        table(
          ['table', 'shape', 'row meaning', 'column / feature meaning'],
          [
            ['input embedding E', '[V,C]=[5,4]', '当前 token', '四个 learned features'],
            ['Bigram W_bigram', '[V,V]=[5,5]', '当前 token', '五个 candidate next-token logits'],
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
        formula('\mathrm{logits}[b,t,:]=W_{\mathrm{bigram}}[\mathrm{token\_ids}[b,t],:]', '输入每一个 ID 时，读出该 ID 的完整 five-candidate logit row；本 batch 输出 [3,2,5]。'),
      ],
      [
        'Bigram row 的值是 logits，Softmax 前不是 probabilities。',
        'nn.Embedding(5,5) 在这里不是同一张 [5,4] semantic/input table。',
        'Bigram 不会综合整句；相同当前 token 必然给相同 logits。',
      ],
      check('为什么 Bigram 的 token_table.weight.shape 是 [5,5]，而输入 embedding 是 [5,4]？', [
        paragraph('Bigram 每个 row 必须直接给 V=5 个下一-token logits；普通输入 embedding 每个 row 则只携带 C=4 个 learned features。'),
      ]),
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
        print(step, float(loss))`,
        ),
        formula('L=-\frac{1}{B\times T}\sum_b\sum_t\log\operatorname{softmax}(\mathrm{logits}[b,t,:])[\mathrm{targets}[b,t]]', '本 batch 对六个位置的 correct next-token negative log probability 求平均。'),
        table(
          ['步骤', '改变的状态'],
          [
            ['forward', '用真实 inputs 得到全部 [3,2,5] logits 和 mean loss'],
            ['zero_grad', '清掉上一轮累积的 gradient'],
            ['backward', '从六个 targets 的 loss 计算每个参数的 gradient'],
            ['step', 'optimizer 用 gradient 更新 [5,5] table'],
          ],
        ),
      ],
      [
        '训练前不应对 logits 手动 Softmax。',
        '忘记 zero_grad 会让 PyTorch 默认累积梯度。',
        '训练时不把预测追加回 input；本节使用真实前缀的 teacher forcing。',
        '一个 mini-batch 没查到某 row 只说明没有该数据 lookup gradient；weight decay 等优化器规则仍可能影响参数。',
      ],
      check('为什么 “喜欢” row 会收到来自不同 target 的训练信号？', [
        paragraph('在六题中 喜欢→AI 与 喜欢→我 都会查 W_bigram[1,:]；Cross Entropy 会让这一 row 把概率分配给数据中出现的两种后续。'),
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
            ['Argmax', '永远选择最大 probability', '同一 state 可重复，较确定但可能单一'],
            ['Sampling', '按 Softmax probability 抽样', '高概率更常出现，低概率仍可能被选，更多样'],
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
        paragraph('温度 τ>0 使用 softmax(last_logits / τ)：τ=1 保持原分布，τ<1 更尖锐，τ>1 更平坦。本教学词表没有 <EOS>，所以必须用 max_new_tokens 限定循环。'),
      ],
      [
        'logits[-1,:,:] 取的是最后一个 batch；正确切片是 logits[:, -1, :]。',
        'Softmax 应沿 vocabulary dim=-1，而不是时间维。',
        '不能把全部 [B,T,V] logits 一次采样并追加；当前轮只追加一个 [B,1] token。',
        'Sampling 不是均匀随机；Argmax 也不一定更“正确”。',
      ],
      check('为什么 next_id 必须是 [B,1] 而不是 [B]？', [
        paragraph('torch.cat 沿 dim=1 追加一个新的时间位置；[B,1] 正好是一列 token ID，与已有 token_ids [B,T] 拼成 [B,T+1]。'),
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
        paragraph('两个 prompt 最后的 ID 都是 1，所以 Bigram 都只查 W_bigram[1,:]。这不是偶然的训练结果：只要表仍是 [V_vocab,V_vocab] 并且输入接口只提供当前 token，更早的 我 或 猫 不可能影响最后位置输出。'),
        formula('a_{\mathrm{last}}=b_{\mathrm{last}}\Rightarrow W_{\mathrm{bigram}}[a_{\mathrm{last}},:]=W_{\mathrm{bigram}}[b_{\mathrm{last}},:]\Rightarrow P(\mathrm{next}\mid a)=P(\mathrm{next}\mid b)', '相同末 token 的两个上下文，在 Bigram 中必得相同 next-token distribution。'),
        paragraph('固定词表的表只有 5×5=25 个 logits；它可以记住一步转移，是教学与数据管线 baseline，却不能表示同一当前词在不同长上下文中的不同续写。'),
      ],
      [
        '多训练几轮无法创造模型没有提供的早期-token 信息通路。',
        '增大单 token embedding 宽度不等于能访问更多时间位置。',
        '偶尔生成通顺片段不证明模型利用了整句；局部相邻统计也可能看似合理。',
      ],
      check('为何 [我,喜欢] 与 [猫,喜欢] 的 last logits 必然相同？', [
        paragraph('最后 token 都是 喜欢（ID 1），Bigram 只读取同一 row W_bigram[1,:]，不读取更早位置。'),
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
        formula('\mathrm{mean\_NLL}=-\frac{1}{N}\sum_i\log P(x_i\mid x_{<i}),\qquad \mathrm{PPL}=\exp(\mathrm{mean\_NLL})', 'N 是有效预测 token 数；本课程自然对数下 PPL 是有效 token 平均 NLL 的 exp。'),
        table(
          ['每个真实 token 的 probability', 'mean_NLL', 'PPL', '直觉'],
          [
            ['1/5（五个候选均匀）', 'ln(5) ≈ 1.609', '5', '像在五个候选间同样犹豫'],
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
        callout('可比条件', [
          list([
            '同一 tokenizer、Vocabulary、留出语料与数据划分。',
            '同一文本预处理、BOS/EOS/PAD、mask/ignore_index 规则。',
            '同一 context length、窗口 / stride 策略、自然对数和有效-token 加权 reduction。',
            '同一正规化自回归 next-token 任务，并都使用 model.eval() 与 torch.no_grad()。',
          ], true),
          paragraph('若有 padding 或 ignore_index=-100，分母也只能计算未被 mask 的有效 targets；不能简单平均大小不同 batch 的 mean losses。'),
        ], 'principle'),
      ],
      [
        '先平均每个 token 的 NLL，再做一次 exp；不能先算每 token PPL 再平均。',
        '不同 tokenizer 的 PPL 不可直接比较。',
        '训练集 PPL 接近 1 可能是记忆，不代表泛化。',
        '低 PPL 不保证回答真实、安全或对人有用。',
      ],
      check('什么时候可以写 perplexity = torch.exp(loss)？', [
        paragraph('只有 loss 确实是所有有效 token 的平均自然对数 NLL 时；跨 batch 时要确保按有效 token 数加权。'),
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
          '输入 Embedding 得到 [3,2,4]',
          'Bigram / language-model head 得到 logits [3,2,5]',
          '展平为 logits [6,5] 与 targets [6]',
          'F.cross_entropy 得到 scalar mean loss',
          'backward → optimizer 更新；生成则取最后位置并追加',
        ]),
        code(
          'text',
          `Week 6 fixed batch:
raw IDs                              [3,3]
shifted inputs                       [3,2]
input embeddings                     [3,2,4]
vocabulary logits                    [3,2,5]
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
        callout('额外的四-token shape trace（高级核对）', [
          code(
            'text',
            `full = [[0,1,2,3], [0,1,4,2]]       shape [B=2,L=4]
inputs = full[:, :-1]                  shape [2,3]
targets = full[:, 1:]                  shape [2,3]
logits                                 shape [2,3,5]
flattened logits / targets             [6,5] / [6]
generation last logits / next_id       [1,5] / [1,1]`,
          ),
          paragraph('这是同一接口的额外代码核对，不替换本周固定的三句 [3,3] 训练语料。这里的 6 来自 B×T=2×3，不是词表大小；Vocabulary axis 始终是 5。'),
        ]),
        table(
          ['训练', '生成'],
          [
            ['文本 → IDs → shifted inputs/targets → [B,T,V] logits → flatten → cross-entropy → backward → update', 'prompt IDs → [B,T,V] logits → logits[:, -1, :] [B,V] → Argmax/Sampling → next_id [B,1] → append → repeat'],
          ],
        ),
      ],
      [
        'T 是当前 sequence length，不是 Vocabulary size V。',
        '展平不会丢掉监督关系；同序展开的 logits 与 targets 行仍对齐。',
        '训练不只用最后位置；生成当前轮才只用最后位置。',
        '低 PPL 不会消除 Bigram 只能看到当前 token 的结构限制。',
      ],
      check('为何 Week 7 加入 Attention 后仍保留 logits、cross-entropy 和 logits[:, -1, :]？', [
        paragraph('Attention 改善的是每个位置如何融合可见左侧上下文；语言模型仍输出 vocabulary logits，用 right-shift target 训练，并自回归地从最后位置追加一个 token。'),
      ]),
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
        paragraph('Self-Attention 让每个位置动态汇总允许看到的历史位置。Query 是当前位置正在寻找什么信息，Key 是每个候选位置提供的匹配线索，Value state 是匹配后真正汇总的内容。它们通常由同一 hidden representation 的不同可学习投影得到，不是三个额外 token。'),
        table(
          ['quantity', 'typical shape', 'meaning'],
          [
            ['query, key', '[B,T,d_k]', '用于位置间匹配'],
            ['value_states', '[B,T,d_v]', '被权重汇总的内容'],
            ['attention scores / weights', '[B,T,T]', '每个 Query 对每个 Key position 的分数 / 归一化权重'],
            ['context', '[B,T,d_v]', '加权 Values'],
            ['final vocabulary logits', '[B,T,V_vocab]', '仍是 Week 6 的 next-token 接口'],
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
        formula('\mathrm{score}_{t,j}=\frac{q_t\cdot k_j}{\sqrt{d_k}},\qquad \alpha_{t,j}=\operatorname{softmax}_j(\mathrm{score}_{t,j}),\qquad \mathrm{context}_t=\sum_{j\le t}\alpha_{t,j}\,\mathrm{value}_j', 'causal mask 只允许 j≤t；每个 Query 在可见 Key positions 的最后一维上归一化。'),
        paragraph('对 prompt A=[我,喜欢] 与 B=[猫,喜欢]，第二位置的当前 token 虽都为 喜欢，但 Attention 可读取不同的第 0 位置，因此最后 logits 可能不同。它只是提供使用更长上下文的路径；未经训练并不保证模型会给某个特定答案，更不保证“理解”。'),
      ],
      [
        'Attention 不会替代 token embedding、vocabulary output head 或 cross-entropy。',
        '没有 causal mask 就会偷看未来 target，破坏自回归训练目标。',
        'Attention 的 Value state 不等于词表大小 V_vocab。',
        'Softmax 对每个 Query 的可见 Key 维（scores 最后一维）做，不跨 Query positions。',
        '进入 Week 7 后生成仍只使用 logits[:, -1, :]。',
      ],
      check('Attention 如何让两个都以“喜欢”结尾的 prompt 可能产生不同 last logits？', [
        paragraph('Bigram 只查 喜欢 的一 row；Attention 的第二位置还可按 causal mask 关注前面不同的 我 或 猫，得到不同 context representation，再映射为可能不同的 vocabulary logits。'),
      ]),
    ),
  ],
};
