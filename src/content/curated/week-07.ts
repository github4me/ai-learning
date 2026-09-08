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

const positionRows = [
  ['b=0, t=0', 'x[0,0,:]', '我', 'Prompt A 的第一个 Token'],
  ['b=0, t=1', 'x[0,1,:]', '喜欢', 'Prompt A 的第二个 Token'],
  ['b=1, t=0', 'x[1,0,:]', '猫', 'Prompt B 的第一个 Token'],
  ['b=1, t=1', 'x[1,1,:]', '喜欢', 'Prompt B 的第二个 Token'],
];

const matrixAxes =
  '每张 [T,T]=[2,2] 表中，行 t 是发起读取的 Query Position，列 j 是被比较的 Key Position，也是稍后对应的 Value Position。它们都不是 Feature Axis。';

export const week07Revision: CuratedWeekRevision = {
  weekSlug: 'week-07',
  title: 'Week 7 - Attention：让当前位置按需读取左侧上下文',
  keyQuestion:
    '当“喜欢”既出现在 [我,喜欢] 又出现在 [猫,喜欢] 时，模型如何从输入向量计算 Q、K、V，给可见位置打分，并产生不同的上下文表示与下一词 Logits？',
  objectives: [
    '用同一个可复现数值例子完整计算 X → Q/K/V → Raw Scores → Scale → Causal Mask → Attention Weights → Weighted Values。',
    '解释 Attention 如何打分、分数如何通过训练学会，以及 Attention Softmax 与 Vocabulary Softmax 的区别。',
    '准确读取 [B,T,C]、[B,T,d_head]、[B,T,T] 和 [B,n_head,T,T] 中每个轴的语义。',
    '实现并审计可复现的单 Head、可复用的 Causal Attention Head 与 Multi-Head Attention。',
    '说明 Attention Output 如何继续影响 Logits、Attention 的边界、T² 成本，以及它为什么需要 Week 8 的 Transformer Block。',
  ],
  estimatedReadingMinutes: 110,
  sections: [
    section(
      'o0255-week-7',
      'Week 7 核心目标：让相同 Token 读取不同前缀',
      'Week 6 的 Bigram 对相同当前 Token 只查询同一行参数，所以 [我,喜欢] 与 [猫,喜欢] 的最后“喜欢”会产生相同 Logits。',
      [
        '建立 Attention 要解决的具体问题，而不是先背诵一条密集公式。',
        '固定一组 Prompt、Shape 和教学参数，让后续每个数字都能追溯来源。',
      ],
      [
        paragraph(
          '本周只围绕两个 Prompt 展开：Prompt A=[我,喜欢]，Prompt B=[猫,喜欢]。两者最后一个 Token 相同，但合理的模型应该能让最后的“喜欢”读取不同的左侧信息。Attention 增加的就是这条动态信息通路。',
        ),
        table(
          ['Batch / Position', 'Tensor Slot', 'Token', '语义'],
          positionRows,
          '固定 B=2、T=2、C=4；后续所有矩阵都来自这两个 Prompt。',
        ),
        chain([
          '输入表示 X [B,T,C] = [2,2,4]',
          '每个 Head 投影出 Q / K / V [2,2,2]',
          'QKᵀ 产生 Raw Scores [B,T,T] = [2,2,2]',
          '除以 √d_k，应用 Causal Mask',
          '沿 Key Position Axis 做 Softmax 得 Weights [2,2,2]',
          'Weights @ Values 得 Head Output [2,2,2]',
          '两个 Heads Concat + W_O 恢复 [2,2,4]',
          '后续 Transformer 与 LM Head 产生 Logits [2,2,V_vocab]',
        ]),
        formula(
          String.raw`\operatorname{context}_t=\sum_{j\le t}\alpha_{t,j}v_j`,
          '位置 t 为所有允许位置 j 分配读取比例 alpha，并把对应 Value 加权汇总。',
        ),
        callout(
          '先记住边界',
          [
            paragraph(
              'Attention 输出的是 Contextual Features，不是 Vocabulary Probability；它让后续 Logits 可以不同，但不保证未经训练的模型一定得到有意义的结果。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'Attention 不是更大的永久记忆，也不是对模型理解能力的证明。',
        'GPT 的 Causal Attention 只能读取当前位置和左侧历史，不能读取右侧未来 Token。',
      ],
      check(
        '为什么两个最后都是“喜欢”的 Prompt 在 Bigram 中相同，在 Attention 中却可能不同？',
        [
          paragraph(
            'Bigram 只查询“喜欢”的固定参数行；Attention 的最后 Query 可以读取不同的第一个位置，也就是 Prompt A 的“我”或 Prompt B 的“猫”。',
          ),
        ],
      ),
    ),
    section(
      'o0257-1-context-aggregation',
      '1. 从输入 X 到最简单的 Context Aggregation',
      '初学者容易把 Token ID、Embedding 和 Attention 输入混为一谈，也容易误以为只要把上下文平均就已经等于 Attention。',
      [
        '明确 X 是向量表示而不是 Token ID。',
        '用可手算的 Uniform Mean 建立基线，并准确说明它缺少什么。',
      ],
      [
        paragraph(
          'Attention 不直接接收 Token ID。Token ID 只是用于查表的整数；进入 Attention 的 X 是 Embedding 或上一层输出的向量。本课使用简化表示，使每一步矩阵乘法都能手算。真实模型中的向量通常是训练得到的稠密小数。',
        ),
        formula(
          String.raw`X_A=\begin{bmatrix}1&0&0&0\\0&1&0&0\end{bmatrix},\qquad X_B=\begin{bmatrix}0&0&1&0\\0&1&0&0\end{bmatrix}`,
          'Prompt A 的两行分别表示“我、喜欢”；Prompt B 的两行分别表示“猫、喜欢”。',
        ),
        formula(
          String.raw`X\in\mathbb{R}^{[B,T,C]}=\mathbb{R}^{[2,2,4]}`,
          '两个 Prompt 组成 Batch，每个 Prompt 有两个位置，每个位置有四个 Features。',
        ),
        paragraph(
          '一个简单基线是对当前位置允许读取的前缀做均匀平均。最终位置 t=1 的固定读取比例是 [0.5,0.5]；它能让 A 与 B 因输入不同而产生不同平均值，但不能根据当前 Query 动态改变读取比例。',
        ),
        formula(
          String.raw`\bar{x}_{A,1}=\frac{[1,0,0,0]+[0,1,0,0]}{2}=[0.5,0.5,0,0]`,
          'Prompt A 最终位置的均匀上下文平均。',
        ),
        formula(
          String.raw`\bar{x}_{B,1}=\frac{[0,0,1,0]+[0,1,0,0]}{2}=[0,0.5,0.5,0]`,
          'Prompt B 最终位置的均匀上下文平均。',
        ),
        table(
          ['机制', '最终位置对 j=0 / j=1 的读取', '能否按 Query 动态选择'],
          [
            ['Causal Uniform Mean', '[0.5, 0.5]', '不能，比例固定'],
            ['Prompt A 的教学 Attention Head', '[0.599, 0.401]', '可以'],
            ['Prompt B 的教学 Attention Head', '[0.426, 0.574]', '可以'],
          ],
          'Attention 的优势不是“第一次能汇总”，而是每个 Query 都能计算自己的读取比例。',
        ),
      ],
      [
        '不能把 Prompt A 与 Prompt B 当成一条四 Token 序列平均；Batch Examples 彼此独立。',
        'Uniform Mean 不是完全相同的输出：不同输入仍会给出不同平均向量；它缺少的是按 Query 学习选择。',
      ],
      check('Uniform Mean 与 Attention 的核心区别是什么？', [
        paragraph(
          'Uniform Mean 使用预先固定的相等比例；Attention 根据当前位置的 Query 与各位置的 Key 动态计算比例。',
        ),
      ]),
    ),
    section(
      'o0258-2-q-k-v',
      '2. 用搜索系统理解 Query、Key、Value',
      '“回看上下文”没有说明当前位置要找什么、候选位置怎样被匹配，以及找到以后真正带回什么。',
      [
        '用三个任务问题分别定义 Q、K、V。',
        '强调它们是同一输入的 Learned Views，而不是三份外部文本。',
      ],
      [
        table(
          ['Attention 必须回答的问题', '名称', '在最终“喜欢”的例子中'],
          [
            ['当前位置正在寻找什么？', 'Query (Q)', '“喜欢”形成当前读取请求'],
            ['每个位置凭什么被找到？', 'Key (K)', '“我”或“猫”提供可匹配线索'],
            ['找到位置后带回什么？', 'Value (V)', '对应位置的内容参与新表示'],
          ],
        ),
        paragraph(
          '可以把 Query 想成搜索请求、Key 想成索引线索、Value 想成记录正文。这个比喻只解释职责；模型中没有真正的字符串搜索，也没有人为指定“某一维等于主语”。',
        ),
        formula(
          String.raw`Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V`,
          '同一个输入 X 经过三套独立的可学习投影，产生 Query、Key 和 Value。',
        ),
        formula(
          String.raw`X:[2,2,4],\qquad W_Q,W_K,W_V:[4,2]\quad\Longrightarrow\quad Q,K,V:[2,2,2]`,
          'Batch 与 Token Position 轴不变，四个输入 Features 投影为一个 Head 的两个 Features。',
        ),
      ],
      [
        'Q、K、V 不是固定的人类语言标签，也不是额外输入的三句话。',
        'Key 用来形成读取比例；Value 才是最后被加权带回的内容。',
      ],
      check('Attention Weights 形成以后，Q、K、V 中哪一种会被加权相加？', [
        paragraph(
          'Value。Q 与 K 决定读取地址和比例，Value 提供被取回的 Payload。',
        ),
      ]),
    ),
    section(
      'o0260-3',
      '3. 为什么需要三份表示',
      '如果匹配线索与被传回内容必须使用完全相同的 Features，模型会失去分别优化“怎样找到我”和“找到后带走什么”的自由度。',
      [
        '区分匹配地址与信息 Payload。',
        '说明三套投影怎样通过最终 Loss 一起学习。',
      ],
      [
        paragraph(
          '一个位置可以用 Key 宣传“怎样找到我”，用 Value 保存“找到我后应带走什么”，并在自己的读取轮次用 Query 表达“我现在需要什么”。三者来自同一个 x_t，但使用不同参数。',
        ),
        formula(
          String.raw`W_Q,W_K,W_V\in\mathbb{R}^{4\times2},\qquad q_t,k_t,v_t\in\mathbb{R}^{2}`,
          '本周一个 Head 内的三套矩阵都将四维输入投影为两维。',
        ),
        formula(
          String.raw`x_t\in\mathbb{R}^{1\times4},\qquad x_tW\in\mathbb{R}^{1\times2}`,
          '采用 Row-Vector 写法，一个位置的四维输入乘四乘二矩阵得到两维表示。',
        ),
        callout(
          '角色来自训练，不是人工指定',
          [
            paragraph(
              '训练数据不会附带“这里应该关注主语”的 Attention 标签。Next-Token Loss 通过后续 Logits 反向传播，逐步更新 W_Q、W_K 与 W_V，使有助于降低 Loss 的匹配和 Payload 更容易被使用。',
            ),
          ],
          'concept',
        ),
      ],
      [
        '三份表示不表示复制三份文本，也不表示增加三个 Token。',
        '一个 Head 的 Key 或 Value 不能自动解释为固定语法角色。',
      ],
      check('为什么 Key 不需要保存 Value 中的全部信息？', [
        paragraph(
          '找到记录与读取记录是两件不同工作；用于匹配的简短线索不必等于找到后真正传回的内容。',
        ),
      ]),
    ),
    section(
      'o0261-4-query-key-dot-product',
      '4. 从 XW 得到 Q、K、V，再计算 Raw Scores',
      '只写 Q=XW_Q 并直接展示 Score，会让 Q、K、V 和分数看起来凭空出现。',
      [
        '给出可核对的 X、W_Q、W_K、W_V，并计算两条 Prompt 的全部 Q、K、V。',
        '让最终“喜欢”的每个 Dot Product 都能手算复现。',
      ],
      [
        paragraph(
          '下面的参数专门为教学设计，目的是让所有数字可以手算。真实模型通常从随机参数开始，通过训练得到稠密小数。这里的 W 仍是全局共享矩阵，并不是为每个 Token 单独写一套规则。',
        ),
        formula(
          String.raw`W_Q=\begin{bmatrix}0.5&0.5\\1&1\\-0.5&0.5\\0&0\end{bmatrix},\quad W_K=\begin{bmatrix}0.8\sqrt2&0\\0.2\sqrt2&0.2\sqrt2\\0&0.1\sqrt2\\0&0\end{bmatrix},\quad W_V=\begin{bmatrix}1&0\\0&1\\-1&0\\0&0\end{bmatrix}`,
          '三套教学投影均为 [C,d_head]=[4,2]。',
        ),
        paragraph(
          '例如 x_喜欢=[0,1,0,0]，所以它乘任一 W 时会取出对应矩阵的第二行：q_喜欢=[1,1]，k_喜欢=[0.2√2,0.2√2]≈[0.283,0.283]，v_喜欢=[0,1]。',
        ),
        formula(
          String.raw`Q_A=\begin{bmatrix}0.5&0.5\\1&1\end{bmatrix},\quad K_A=\begin{bmatrix}1.131&0\\0.283&0.283\end{bmatrix},\quad V_A=\begin{bmatrix}1&0\\0&1\end{bmatrix}`,
          'Prompt A=[我,喜欢] 的 Query、Key 与 Value。',
        ),
        formula(
          String.raw`Q_B=\begin{bmatrix}-0.5&0.5\\1&1\end{bmatrix},\quad K_B=\begin{bmatrix}0&0.141\\0.283&0.283\end{bmatrix},\quad V_B=\begin{bmatrix}-1&0\\0&1\end{bmatrix}`,
          'Prompt B=[猫,喜欢] 的 Query、Key 与 Value。',
        ),
        paragraph(
          '最终“喜欢”的 Query 是 [1,1]。它与“我”的 Key 做 Dot Product：1×1.131+1×0=1.131；与“喜欢”自己的 Key 计算：1×0.283+1×0.283=0.566。',
        ),
        paragraph(
          '在 Prompt B 中，它与“猫”的 Key 计算：1×0+1×0.141=0.141；与“喜欢”自己的 Key 仍得到 0.566。',
        ),
        formula(
          String.raw`S_A=Q_AK_A^\top=\begin{bmatrix}0.566&0.283\\1.131&0.566\end{bmatrix},\qquad S_B=Q_BK_B^\top=\begin{bmatrix}0.071&0\\0.141&0.566\end{bmatrix}`,
          '两条 Prompt 的完整 Raw Score Matrices；每个元素都是一组 Query 与 Key 的 Dot Product。',
        ),
      ],
      [
        'Raw Score 可以是任意实数，还不是 Probability。',
        'Dot Product 是 Learned Compatibility，不是经过人类认证的语义相似度，也不是 Cosine Similarity。',
      ],
      check('Prompt A 中最终“喜欢”对“我”的 Raw Score 1.131 是怎样产生的？', [
        paragraph(
          '最终“喜欢”的 Query [1,1] 与“我”的 Key [1.131,0] 对应相乘并求和：1×1.131+1×0=1.131。',
        ),
      ]),
    ),
    section(
      'o0263-5-softmax-scores-weights',
      '5. 从 Scores 到 Attention Weights',
      'Raw Scores 没有范围限制，不能直接解释为稳定的读取比例；同时必须区分 Attention Softmax 与 Vocabulary Softmax。',
      ['完整计算 Scale 与 Row Softmax。', '明确 Softmax 的 Axis 和概率语义。'],
      [
        paragraph(
          '先将最终 Query Row 除以 √d_k。本例 d_k=2，所以 Prompt A 从 [1.131,0.566] 得到 [0.8,0.4]，Prompt B 从 [0.141,0.566] 得到 [0.1,0.4]。最终位置可以读取两列，因此这一行没有未来位置需要屏蔽。',
        ),
        formula(
          String.raw`\alpha_{t,j}=\frac{\exp(\hat{s}_{t,j})}{\sum_{r=0}^{T-1}\exp(\hat{s}_{t,r})}`,
          '对固定 Query Row t，沿全部 Key Position Columns 做 Softmax。',
        ),
        code(
          'text',
          `Prompt A, final query row
scaled scores = [0.8, 0.4]
exp values    = [2.226, 1.492]
sum           = 3.718
weights       = [0.599, 0.401]

Prompt B, final query row
scaled scores = [0.1, 0.4]
exp values    = [1.105, 1.492]
sum           = 2.597
weights       = [0.426, 0.574]`,
        ),
        table(
          ['Softmax', '竞争的 Axis', '回答的问题'],
          [
            [
              'Attention Softmax',
              'T 个 Key Positions',
              '当前 Query 应读取哪些位置？',
            ],
            [
              'Vocabulary Softmax',
              'V 个 Vocabulary Tokens',
              '下一个 Token 应该是哪一个？',
            ],
          ],
          '数学函数相同，但输入、Axis 与含义不同。Attention Weight 不是下一词概率。',
        ),
        formula(
          String.raw`P=\operatorname{softmax}(\widehat{S},\mathrm{dim}=-1),\qquad \widehat{S},P:[B,T,T]=[2,2,2]`,
          '每一行单独归一化，最后一维 j 的 Weights 加总为一。使用 P 表示 Weight Matrix，避免与 Prompt A 的名称混淆。',
        ),
      ],
      [
        'Softmax 使用 dim=-2 会沿 Query Rows 归一化，即使 Shape 能运行，语义也已经错误。',
        'Attention Weight 数值较大不等于该 Token 对最终预测具有完整因果解释。',
      ],
      check('为什么 Attention Softmax 必须让每个 Query Row 分别加总为 1？', [
        paragraph(
          '每个 Query 都要独立分配自己的读取比例；同一行的 Key/Value Positions 是这一次读取中的竞争候选。',
        ),
      ]),
    ),
    section(
      'o0264-6-values',
      '6. 用 Weights 加权汇总 Values',
      '找到匹配位置仍不够；层还必须把相应位置的信息以可微方式带回当前 Query。',
      [
        '完成 Prompt A 与 Prompt B 的完整 Weighted Value Calculation。',
        '分清 Weights、Values 与 Head Output 的含义。',
      ],
      [
        formula(
          String.raw`o_t=\sum_{j=0}^{T-1}\alpha_{t,j}v_j`,
          '每个允许位置的 Attention Weight 乘对应 Value，再把所有结果相加。',
        ),
        code(
          'text',
          `Prompt A, final 喜欢
weights = [0.599, 0.401]
Values  = [[1,0], [0,1]]

o_A = 0.599 * [1,0] + 0.401 * [0,1]
    = [0.599, 0.401]

Prompt B, final 喜欢
weights = [0.426, 0.574]
Values  = [[-1,0], [0,1]]

o_B = 0.426 * [-1,0] + 0.574 * [0,1]
    = [-0.426, 0.574]`,
        ),
        paragraph(
          '两条 Prompt 的最后 Token 都是“喜欢”，但 Head Output 已经不同。差异一部分来自 Key 不同造成的 Weight 不同，另一部分来自“我”和“猫”的 Value 本身不同。',
        ),
        formula(
          String.raw`P:[B,T,T]\ @\ V:[B,T,d_{\mathrm{head}}]\longrightarrow O:[B,T,d_{\mathrm{head}}]`,
          '矩阵乘法沿 Key/Value Position j 汇总，保留 Batch、Query Position 与 Head Feature。',
        ),
        callout(
          '最重要的职责分工',
          [
            list([
              'Q/K 的比较决定“读取哪里、读取多少”。',
              'V 决定“从被读取的位置带回什么”。',
              'O 是新的 Contextual Representation，不是 Token ID，也不是 Vocabulary Probability。',
            ]),
          ],
          'principle',
        ),
      ],
      [
        'Weights 应乘 Values，不是再乘 Keys。',
        'O 的最后一维是 Head Features，不是两个 Token，也不是两个概率。',
      ],
      check('Prompt A 与 Prompt B 的最终 Head Output 为什么不同？', [
        paragraph(
          '第一个位置的 Key 使两条 Prompt 得到不同 Weights，同时“我”和“猫”的 Value 也不同；两种差异都会进入 Weighted Sum。',
        ),
      ]),
    ),
    section(
      'o0265-7-scaled-dot-product-attention',
      '7. 一条完整的 Scaled Dot-Product Attention 计算链',
      '把 Attention 压成一条公式很容易背错顺序，也会隐藏分数从哪里来、Mask 放在哪里以及模型如何学会打分。',
      [
        '把每个操作和中间 Tensor 独立命名。',
        '将教学数值与训练梯度路径连成一条因果链。',
      ],
      [
        formula(
          String.raw`\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\left(\operatorname{mask}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)\right)V`,
          '标准 Causal Scaled Dot-Product Attention。',
        ),
        chain([
          'X @ W_Q/W_K/W_V → Q、K、V',
          'Q @ Kᵀ → Raw Scores S',
          'S / √d_k → Scaled Scores',
          'Future Columns → −∞ → Masked Scores',
          'Row Softmax → Attention Weights P',
          'P @ V → Head Output O',
        ]),
        formula(
          String.raw`Q:[B,T,d_k]\ @\ K^\top:[B,d_k,T]\rightarrow S:[B,T,T],\qquad P:[B,T,T]\ @\ V:[B,T,d_v]\rightarrow O:[B,T,d_v]`,
          '第一次矩阵乘法消去 Head Feature Axis，第二次矩阵乘法消去 Key/Value Position Axis。',
        ),
        paragraph(
          '训练时，O 继续影响 Transformer 的后续表示、Language Model Head、Logits 与 Cross Entropy Loss。梯度再从 Loss 反向经过 O、P、Softmax 和 Scores，更新 W_Q、W_K 与 W_V。模型不是先拥有正确 Attention 表，而是在降低最终预测 Loss 的过程中逐步学会怎样打分和传递内容。',
        ),
        formula(
          String.raw`\mathrm{Loss}\rightarrow\mathrm{Logits}\rightarrow O\rightarrow P\rightarrow S\rightarrow Q,K,V\rightarrow W_Q,W_K,W_V`,
          '反向传播把最终预测误差传回产生 Query、Key 与 Value 的参数。',
        ),
      ],
      [
        '不能跳过 Scale、Mask 或 Softmax 中任何一步。',
        '训练没有直接告诉模型“喜欢应该关注我”；这种路由由最终 Loss 间接学习。',
      ],
      check('模型中“什么位置应得高分”是谁决定的？', [
        paragraph(
          'W_Q 与 W_K 决定 Query 和 Key 的坐标；最终预测 Loss 通过反向传播更新这些参数，使有用的匹配逐步得到更合适的分数。',
        ),
      ]),
    ),
    section(
      'o0266-8-sqrt-d-k',
      '8. 为什么除以 √d_k，而不是 d_k',
      '只说“维度大时分数会变大”仍没有解释为什么标准公式使用平方根，也无法理解它与 Softmax 梯度的关系。',
      [
        '给出平方根缩放的统计直觉。',
        '用同一 Prompt 数值验证缩放结果与不变量。',
      ],
      [
        paragraph(
          'Dot Product 是 d_k 个乘积之和。若每个分量大致零均值、单位方差且不过度相关，那么这些乘积之和的方差约随 d_k 增长，标准差则约随 √d_k 增长。除以 √d_k 可以把典型 Score Scale 拉回较稳定的范围。',
        ),
        formula(
          String.raw`q\cdot k=\sum_{i=1}^{d_k}q_i k_i,\qquad \operatorname{Var}(q\cdot k)\approx d_k,\qquad \operatorname{Std}(q\cdot k)\approx\sqrt{d_k}`,
          '这是理解缩放因子的常用近似统计直觉，不是对所有训练状态的严格独立性声明。',
        ),
        code(
          'text',
          `Prompt A, final query
raw scores       = [1.131, 0.566]
sqrt(d_k)        = sqrt(2) ≈ 1.414
scaled scores    = [0.800, 0.400]

Prompt B, final query
raw scores       = [0.141, 0.566]
scaled scores    = [0.100, 0.400]`,
        ),
        paragraph(
          '如果分数绝对值过大，Softmax 容易过早接近 One-Hot，较小候选获得接近零的梯度。缩放不会改变同一行的排序，只调整 Softmax 接收到的数值尺度。',
        ),
        formula(
          String.raw`\widetilde{S}=S/\sqrt{d_k},\qquad S,\widetilde{S}:[B,T,T]`,
          'Scale 是逐元素除法，不改变任何 Axis 或 Shape。',
        ),
      ],
      [
        '应除以 √d_k；不是除以 d_k，也不是除以整个 Model Width C。',
        'Scale 不负责禁止未来位置，也不会让每行自动加总为一。',
      ],
      check('除以 √d_k 后，什么保持不变，什么变得更稳定？', [
        paragraph(
          '同一 Query Row 内的 Score 排序保持不变；Softmax 的输入尺度及其训练梯度通常更容易控制。',
        ),
      ]),
    ),
    section(
      'o0268-9-self-attention-shape',
      '9. Self-Attention 的 Shape 与每个 Axis',
      '本例中的 B、T 和 d_head 都等于 2，许多 Tensor 都打印成 [2,2,2]，很容易把不同 Axis 当成同一件事。',
      [
        '给每个 Axis 固定语义，而不是只背数字。',
        '解释 K Transpose 与两次 Matrix Multiplication 消去的轴。',
      ],
      [
        table(
          ['Tensor', 'Shape', '三个 Axis 的含义'],
          [
            ['X', '[B,T,C] = [2,2,4]', 'Batch, Token Position, Model Feature'],
            [
              'Q / K / V',
              '[B,T,d_head] = [2,2,2]',
              'Batch, Token Position, Head Feature',
            ],
            [
              'Scores / Weights',
              '[B,T,T] = [2,2,2]',
              'Batch, Query Position, Key/Value Position',
            ],
            [
              'Head Output',
              '[B,T,d_head] = [2,2,2]',
              'Batch, Query Position, Head Feature',
            ],
          ],
          'Shape 数字相同不表示 Axis 含义相同。',
        ),
        formula(
          String.raw`Q:[B,T,d_k]\ @\ K.\operatorname{transpose}(-2,-1):[B,d_k,T]\rightarrow S:[B,T,T]`,
          'K 只交换最后两个轴；Batch Axis 保持不动。',
        ),
        formula(
          String.raw`P:[B,T,T]\ @\ V:[B,T,d_v]\rightarrow O:[B,T,d_v]`,
          'Weights 的最后一个 Position Axis 与 Value 的 Position Axis 相乘，留下 Query Position 与 Value Feature。',
        ),
        paragraph(matrixAxes),
        table(
          ['索引', '含义'],
          [
            ['weights[0,1,0]', 'Prompt A 最终“喜欢”分给“我”的 Weight'],
            ['weights[1,1,0]', 'Prompt B 最终“喜欢”分给“猫”的 Weight'],
            ['output[1,1,:]', 'Prompt B 最终“喜欢”的 Head Output Vector'],
          ],
        ),
      ],
      [
        'T 出现两次分别表示 Query Position 与 Key/Value Position，不是 Feature Axis。',
        '不能 Transpose Batch Axis；应使用 transpose(-2,-1)。',
      ],
      check('weights[1,1,0] 表示什么？', [
        paragraph(
          '它是 Prompt B 的最终“喜欢”Query 分给同一 Prompt 第一个 Token“猫”的 Attention Weight。',
        ),
      ]),
    ),
    section(
      'o0270-10-gpt-causal-mask',
      '10. 为什么 GPT 需要 Causal Mask',
      'Teacher-Forced Training 会一次提供完整输入；如果较早位置能读取右侧 Token，就会偷看生成时尚不存在的信息。',
      [
        '用下一词预测任务说明 Future Leakage。',
        '用 T=2 与 T=4 两个矩阵建立 Lower-Triangular 直觉。',
      ],
      [
        paragraph(
          '例如输入 [我,喜欢]、目标 [喜欢,猫]。位置 t=0 应只根据“我”预测“喜欢”；若未使用 Mask，它可以直接读取右侧已经出现的“喜欢”，相当于训练时看见答案。生成时未来 Token 尚不存在，因此这种能力无法使用。',
        ),
        formula(
          String.raw`M_{t,j}=\begin{cases}1,&j\le t\\0,&j>t\end{cases}`,
          'Query Position t 只允许读取当前位置和所有左侧 Key Positions。',
        ),
        formula(
          String.raw`M_{T=2}=\begin{bmatrix}1&0\\1&1\end{bmatrix},\qquad M_{T=4}=\begin{bmatrix}1&0&0&0\\1&1&0&0\\1&1&1&0\\1&1&1&1\end{bmatrix}`,
          '在 Row=Query、Column=Key 的约定下，Causal Mask 是 Lower Triangular。',
        ),
        paragraph(
          '位置 t=3 可以读取 0、1、2、3，不是只能读取紧邻的前一个 Token。Mask 只划定信息边界，不决定允许位置之间具体读取多少。',
        ),
        formula(
          String.raw`M:[T,T]\ \xrightarrow{\text{broadcast over Batch and Heads}}\ \mathrm{Scores}:[B,n_{\mathrm{head}},T,T]`,
          '同一 Mask 可广播到所有 Batch Examples 和 Heads，但不会让不同 Batch 彼此读取。',
        ),
      ],
      [
        '在 Row=Query、Column=Key 的约定下，正确 Mask 是下三角而不是上三角。',
        'Causal 不等于只读取前一个 Token，而是可读取全部可见历史与当前位置。',
      ],
      check('为什么不使用 Mask 会造成训练与生成不一致？', [
        paragraph(
          '训练中的较早位置可以依赖右侧未来输入，但逐 Token 生成时那些未来输入还没有产生。',
        ),
      ]),
    ),
    section(
      'o0272-11-mask-softmax-infty',
      '11. 为什么 Mask 在 Softmax 前使用 −∞',
      '将 Forbidden Score 改成 0 并不表示删除候选，因为 Softmax 会为 0 分配正数 Weight。',
      [
        '比较正确的 Pre-Softmax Masking 与两个常见错误。',
        '将本例的完整 Scaled Scores 转换为 Masked Scores 与 Weights。',
      ],
      [
        table(
          ['t=0 的 Scaled Row', '结果'],
          [
            ['原始 [0.2,0.9]', '第二列是 Future'],
            ['错误：Future 改为 0', 'Softmax([0.2,0]) = [0.550,0.450]'],
            ['正确：Future 改为 −∞', 'Softmax([0.2,−∞]) = [1,0]'],
          ],
          '0 是合法 Score，不等于“移除候选”；−∞ 的指数才是 0。',
        ),
        formula(
          String.raw`\widehat{S}_{t,j}=\begin{cases}\widetilde{S}_{t,j},&M_{t,j}=1\\-\infty,&M_{t,j}=0\end{cases},\qquad e^{-\infty}=0`,
          'Forbidden Position 在 Softmax Distribution 中获得精确的零 Weight。',
        ),
        formula(
          String.raw`\widehat{S}_A=\begin{bmatrix}0.4&-\infty\\0.8&0.4\end{bmatrix},\qquad \widehat{S}_B=\begin{bmatrix}0.05&-\infty\\0.1&0.4\end{bmatrix}`,
          '本例 Scale 后再应用 Causal Mask 的结果。',
        ),
        formula(
          String.raw`P_A=\begin{bmatrix}1&0\\0.599&0.401\end{bmatrix},\qquad P_B=\begin{bmatrix}1&0\\0.426&0.574\end{bmatrix}`,
          '每个 Query Row 分别执行 Softmax；第一行只能读取自己。',
        ),
      ],
      [
        '不能把 Post-Softmax Weights 乘零后直接结束；允许位置的 Weights 将不再加总为一。',
        '在本例每行至少有对角线位置可见，因此不会出现整行都是 −∞。',
      ],
      check('为什么 Forbidden Score 不能简单改成 0？', [
        paragraph(
          '0 在 Softmax 中对应 e⁰=1，仍会获得正 Weight；而且允许 Scores 还可能小于 0，使错误的零分反而更大。',
        ),
      ]),
    ),
    section(
      'o0273-12-attention-head-pytorch',
      '12. 可复现全部教学数字的 PyTorch 代码',
      '随机初始化的 nn.Linear 不会自动产生正文示例数字；如果代码与数学示例没有共享参数，读者运行后会以为自己的实现错误。',
      [
        '使用与正文完全相同的 X 和 W，逐步打印所有中间 Tensor。',
        '让示例输出可以与手算结果逐行核对。',
      ],
      [
        code(
          'python',
          `import math

import torch


torch.set_printoptions(precision=4, sci_mode=False)

sqrt_2 = math.sqrt(2)

# [B,T,C] = [2,2,4]
x = torch.tensor([
    [
        [1.0, 0.0, 0.0, 0.0],  # 我
        [0.0, 1.0, 0.0, 0.0],  # 喜欢
    ],
    [
        [0.0, 0.0, 1.0, 0.0],  # 猫
        [0.0, 1.0, 0.0, 0.0],  # 喜欢
    ],
])

# Formula convention: [C,d_head] = [4,2]
w_q = torch.tensor([
    [0.5, 0.5],
    [1.0, 1.0],
    [-0.5, 0.5],
    [0.0, 0.0],
])

w_k = torch.tensor([
    [0.8 * sqrt_2, 0.0],
    [0.2 * sqrt_2, 0.2 * sqrt_2],
    [0.0, 0.1 * sqrt_2],
    [0.0, 0.0],
])

w_v = torch.tensor([
    [1.0, 0.0],
    [0.0, 1.0],
    [-1.0, 0.0],
    [0.0, 0.0],
])

q = x @ w_q
k = x @ w_k
v = x @ w_v

raw_scores = q @ k.transpose(-2, -1)
scaled_scores = raw_scores / math.sqrt(q.size(-1))

T = x.size(1)
causal_mask = torch.tril(torch.ones(T, T, dtype=torch.bool))
masked_scores = scaled_scores.masked_fill(~causal_mask, float("-inf"))

weights = torch.softmax(masked_scores, dim=-1)
output = weights @ v

print("Q:", q)
print("K:", k)
print("V:", v)
print("Raw scores:", raw_scores)
print("Scaled and masked scores:", masked_scores)
print("Attention weights:", weights)
print("Head output:", output)`,
        ),
        code(
          'text',
          `Expected final rows
Prompt A weights: [0.5987, 0.4013]
Prompt B weights: [0.4256, 0.5744]

Prompt A output:  [ 0.5987, 0.4013]
Prompt B output:  [-0.4256, 0.5744]`,
        ),
        paragraph(
          '这段代码使用 x @ w_q，所以 W 按公式写成 [C,d_head]。nn.Linear(C,d_head) 内部存储的 weight 是 [d_head,C]，运行时框架使用其转置；两种写法的数学含义相同。',
        ),
      ],
      [
        '教学参数用于复现计算，不代表真实模型会人工设置这些语义。',
        '不要只打印最终 Output；调试 Attention 时应依次检查 Q、K、V、Raw Scores、Masked Scores、Weights。',
      ],
      check('为什么这段代码不使用随机初始化的 nn.Linear？', [
        paragraph(
          '它的任务是精确复现正文手算数字，所以必须使用与正文一致的固定教学参数；真实训练代码则使用可学习参数。',
        ),
      ]),
    ),
    section(
      'o0274-13',
      '13. 可复用的 Causal Attention Head',
      '教学矩阵能解释数学，但真实模型还需要可学习参数、Runtime Mask Slice、Shape Contract 与 Context Length 检查。',
      [
        '实现从 [B,T,C] 到 [B,T,d_head] 的最小可复用 Head。',
        '把每行代码映射回对应公式与 Shape。',
      ],
      [
        code(
          'python',
          `import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class AttentionHead(nn.Module):
    def __init__(self, embed_dim: int, head_size: int, context_length: int):
        super().__init__()

        self.query = nn.Linear(embed_dim, head_size, bias=False)
        self.key = nn.Linear(embed_dim, head_size, bias=False)
        self.value = nn.Linear(embed_dim, head_size, bias=False)

        self.register_buffer(
            "causal_mask",
            torch.tril(
                torch.ones(
                    context_length,
                    context_length,
                    dtype=torch.bool,
                )
            ),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B,T,C]
        _, T, _ = x.shape

        if T > self.causal_mask.size(0):
            raise ValueError("Sequence length exceeds context_length")

        q = self.query(x)  # [B,T,d_head]
        k = self.key(x)    # [B,T,d_head]
        v = self.value(x)  # [B,T,d_head]

        scores = q @ k.transpose(-2, -1)  # [B,T,T]
        scores = scores / math.sqrt(k.size(-1))

        mask = self.causal_mask[:T, :T]
        scores = scores.masked_fill(~mask, float("-inf"))

        weights = F.softmax(scores, dim=-1)
        return weights @ v  # [B,T,d_head]`,
        ),
        table(
          ['代码阶段', '公式', 'Shape'],
          [
            [
              'query/key/value(x)',
              'Q=XW_Q, K=XW_K, V=XW_V',
              '[B,T,C] → [B,T,d_head]',
            ],
            [
              'q @ k.transpose(-2,-1)',
              'S=QKᵀ',
              '[B,T,d_head] @ [B,d_head,T] → [B,T,T]',
            ],
            ['scores / sqrt(k.size(-1))', 'S/√d_k', '[B,T,T] → [B,T,T]'],
            ['masked_fill', 'Future → −∞', '[B,T,T] → [B,T,T]'],
            ['softmax(dim=-1)', 'Row Softmax', '[B,T,T] → [B,T,T]'],
            ['weights @ v', 'O=PV', '[B,T,T] @ [B,T,d_head] → [B,T,d_head]'],
          ],
        ),
        paragraph(
          'register_buffer 让 Mask 随模型移动到 CPU 或 GPU，但不会成为 Trainable Parameter。[:T,:T] 让同一个最大 Context Mask 适配当前 Runtime Sequence Length。',
        ),
      ],
      [
        '该 Head 返回 [B,T,d_head]，还没有恢复 Model Width C，也没有产生 Vocabulary Logits。',
        'Runtime T 不能超过初始化时的 context_length。',
      ],
      check(
        '这个 AttentionHead 为什么不能直接与输入 x 做 Residual Addition？',
        [
          paragraph(
            '单 Head Output 的最后一维是 d_head=2，而输入的最后一维是 C=4；需要 Multi-Head Concat 与 Output Projection 恢复到 C。',
          ),
        ],
      ),
    ),
    section(
      'o0278-14-self-attention',
      '14. 为什么叫 Self-Attention',
      '“Self”常被误解为每个 Token 只能看自己，或者被误解为不同 Batch 中的 Token 可以相互读取。',
      [
        '区分 Self-Attention 与 Cross-Attention 的数据来源。',
        '确认 Batch Examples 始终保持隔离。',
      ],
      [
        paragraph(
          'Self 的含义是 Q、K、V 都来自同一条输入 X。它不表示 Token 只能看自己；GPT 的 Causal Self-Attention 允许每个位置看自己和全部可见左侧。',
        ),
        formula(
          String.raw`Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V`,
          'Self-Attention 中三者来自同一组序列表示。',
        ),
        table(
          ['类型', 'Query 来源', 'Key / Value 来源'],
          [
            ['Self-Attention', '序列 X', '同一序列 X'],
            ['Cross-Attention', '目标序列或当前状态', '另一条 Source Sequence'],
          ],
        ),
        formula(
          String.raw`S:[B,T,T]\neq[B,T,B,T]`,
          '每个 Batch Item 只拥有自己的 Query×Key Matrix，没有跨 Batch 的 Attention Axis。',
        ),
        paragraph(
          'Prompt A 的 Scores Slice 只包含“我、喜欢”；Prompt B 的 Slice 只包含“猫、喜欢”。把两条 Prompt 放入同一 Batch 只是并行计算，不是把它们接成一段文本。',
        ),
      ],
      [
        'Self 不等于只 Attend to 自己。',
        'Q/K 的内容比较本身不提供完整 Absolute Position；Week 8 会加入 Position Embedding。',
      ],
      check('Prompt A 的“喜欢”可以读取 Prompt B 的“猫”吗？', [
        paragraph(
          '不能。两条 Prompt 是独立 Batch Examples，各自拥有独立的 [T,T] Score Slice。',
        ),
      ]),
    ),
    section(
      'o0279-15-multi-head-attention',
      '15. Multi-Head Attention 与 Output Projection',
      '单个 Head 只有一套投影和一套读取分布；同时，单 Head 的 d_head 输出通常小于 Model Width C，不能直接进入 Residual Path。',
      [
        '解释多个 Heads 为什么并行以及 Head Axis 与 Position Axes 的区别。',
        '实现 Concat 与 W_O，并说明 W_O 的实际用途。',
      ],
      [
        paragraph(
          '每个 Head 都有自己的 W_Q、W_K、W_V，可以学习不同的匹配空间和 Payload。不同 Head 可能利用不同线索，但不保证它们自动变成可命名的语法专家。',
        ),
        formula(
          String.raw`C=4,\qquad n_{\mathrm{head}}=2,\qquad d_{\mathrm{head}}=C/n_{\mathrm{head}}=2`,
          '两个两维 Heads 在 Feature Axis 上连接后恰好恢复四维 Model Width。',
        ),
        chain([
          'X [B,T,C] = [2,2,4]',
          'Head 1 Output [2,2,2]',
          'Head 2 Output [2,2,2]',
          'Concat on Feature Axis → [2,2,4]',
          'Output Projection W_O:[4,4] → [2,2,4]',
        ]),
        formula(
          String.raw`\operatorname{MultiHead}(X)=\operatorname{Concat}(O^{(1)},O^{(2)})W_O`,
          'Concat 只把 Head Features 放在一起；W_O 学习怎样重新混合它们并保持外部 Shape 为 C。',
        ),
        code(
          'python',
          `class MultiHeadAttention(nn.Module):
    def __init__(self, embed_dim: int, num_heads: int, context_length: int):
        super().__init__()

        if embed_dim % num_heads != 0:
            raise ValueError("embed_dim must be divisible by num_heads")

        head_size = embed_dim // num_heads

        self.heads = nn.ModuleList([
            AttentionHead(embed_dim, head_size, context_length)
            for _ in range(num_heads)
        ])

        self.output_projection = nn.Linear(
            embed_dim,
            embed_dim,
            bias=False,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        head_outputs = [head(x) for head in self.heads]
        concatenated = torch.cat(head_outputs, dim=-1)
        return self.output_projection(concatenated)`,
        ),
        paragraph(
          'Output Projection 不只是为了 Shape。Concat 后不同 Head 的 Features 仍只是并排放置；W_O 允许模型学习如何跨 Head 重新组合信息，并为后续 Residual Addition 提供 [B,T,C] 接口。',
        ),
      ],
      [
        'n_head=2 不会让最终外部宽度变为 8；两个 d_head=2 的输出 Concat 后是 C=4。',
        '每个 Head 都有自己的 [T,T] Weights，也都必须应用 Causal Mask。',
      ],
      check('为什么 Multi-Head Concat 后还需要 W_O？', [
        paragraph(
          'Concat 只把各 Head Features 并排放置；W_O 学习跨 Head 混合并保持输出宽度为 C，使结果能继续进入 Residual Path。',
        ),
      ]),
    ),
    section(
      'o0281-16-attention',
      '16. Attention Output 怎样影响最终 Logits',
      '初学者常把 Attention Weights 当作下一词概率，或者不知道 Head Output 后面还要经过哪些步骤才产生 Logits。',
      [
        '把 Week 7 的 Contextual Features 接回 Week 6 的 Output Head。',
        '划清 Attention Weight、Hidden Representation、Logit 与 Probability 的边界。',
      ],
      [
        chain([
          'X [B,T,C]',
          'Multi-Head Attention [B,T,C]',
          'Transformer 后续 Residual / FFN / Layers [B,T,C]',
          'Language Model Head W_vocab:[C,V_vocab]',
          'Logits [B,T,V_vocab]',
          '需要解释概率时再对 Vocabulary Axis 做 Softmax',
        ]),
        formula(
          String.raw`H:[B,T,C]\ @\ W_{\mathrm{vocab}}:[C,V_{\mathrm{vocab}}]\rightarrow\mathrm{Logits}:[B,T,V_{\mathrm{vocab}}]`,
          'Language Model Head 把每个位置的 Contextual Features 映射为每个 Vocabulary Token 的原始分数。',
        ),
        paragraph(
          '本课的 Prompt A 与 Prompt B 已在最终位置产生不同的 Head Output。经过 Multi-Head、W_O 与后续 Transformer 处理后，它们可以形成不同的 H，因此 Language Model Head 可以产生不同 Logits。Attention 并不直接输出哪个 Token。',
        ),
        table(
          ['对象', '典型 Shape', '意义'],
          [
            [
              'Attention Weights',
              '[B,n_head,T,T]',
              '每个 Query 读取哪些 Key/Value Positions',
            ],
            [
              'Contextual Features H',
              '[B,T,C]',
              '每个位置经过上下文处理后的表示',
            ],
            ['Vocabulary Logits', '[B,T,V_vocab]', '每个候选 Token 的原始分数'],
            [
              'Vocabulary Probabilities',
              '[B,T,V_vocab]',
              'Logits 沿 Vocabulary Axis Softmax 后的分布',
            ],
          ],
        ),
        callout('打开最后一段连接：损失怎样改变一次读取', [
          paragraph(
            '先不引入完整 GPT，只在本周的单头输出后接一个固定的两维评分层。A 的末位置输出 h=[0.598688,0.401312]，B 是 [−0.425557,0.574443]。这里 h 宽度为 2，是单头的小型分类实验；不是上一周四维输出层的同一组权重。词表和目标仍保持 A→AI、B→我。',
          ),
          code(
            'text',
            '固定评分矩阵 W_vocab（两行是特征，五列是候选）：\n[[0,1,2,-1,0],\n [0,0,0, 1,0]]\nlogits = h @ W_vocab；偏置为 0。',
          ),
          table(
            ['上下文', '算出的 logits', '目标概率 / 单题损失'],
            [
              [
                '我 喜欢',
                '[0,0.598688,1.197375,−0.197375,0]',
                'p(AI)≈0.416424；L≈0.876051',
              ],
              [
                '猫 喜欢',
                '[0,−0.425557,−0.851115,1,0]',
                'p(我)≈0.172455；L≈1.757621',
              ],
            ],
          ),
          paragraph(
            '两题平均损失约 1.316836。为了只观察一个因素，本实验只调整 Wq[1,0]：它原来是 1，因为“喜欢”的输入选择第 1 行，所以这个参数影响末位置 query 的第一个分量。先从 loss 求出这个参数的梯度，再改变它，整个评分层保持不动。',
          ),
          code(
            'text',
            'A 的末行 scaled scores：[0.8q, 0.2q+0.2]\nB 的末行 scaled scores：[0.1, 0.2q+0.2]\nq=Wq[1,0]=1。两行各做 Softmax，再加权 Value，最后算词表 logits 和 CE。\n此固定实验 d(mean loss)/dq≈−0.076159；学习率 0.01 时 q_new≈1.000762。',
          ),
          paragraph(
            '上面的数值是固定公式的计算参考，不是训练日志。运行 course_examples/week07_attention.py 可以看到自动求导给出的梯度与更新前后概率。只有 q 这一个元素被更新，目的是隔离影响；一般训练会同时更新全部参与的参数。',
          ),
          paragraph(
            '这解释了 Q/K/V 为什么不需要人工标注“谁该关注谁”：next-token 目标通过词表损失、输出表示和加权计算，把反馈传回投影矩阵。Value 有自己的加权求和路径，不必先绕过 score 才收到梯度；Q/K 则经 score 和 Softmax 路径收到反馈。',
          ),
        ]),
        callout(
          'Attention 不是什么',
          [
            list([
              '不是外部数据库查询或永久 Memory。',
              '不是最终 Vocabulary Probability。',
              '不是模型全部推理过程。',
              '一张 Attention Heatmap 不是最终预测的完整因果解释。',
            ]),
          ],
          'principle',
        ),
      ],
      [
        '不要把 Attention Weights 直接送入 Vocabulary Softmax；LM Head 接收的是 Contextual Features。',
        '某个 Weight 为零不代表该 Token 没有经其他 Head、Residual 或 Layer 影响最终结果。',
      ],
      check(
        'Attention Weights 与 Vocabulary Probabilities 分别回答什么问题？',
        [
          paragraph(
            'Attention Weights 回答“当前 Query 读取哪些位置”；Vocabulary Probabilities 回答“下一个 Token 可能是哪一个”。',
          ),
        ],
      ),
    ),
    section(
      'o0282-17-attention',
      '17. Attention 的计算成本',
      '每个 Query Position 都要与每个 Key Position 比较；Sequence 变长时，Score 与 Weight Matrices 会迅速增大。',
      [
        '从 [T,T] Matrix 推导 T² 项。',
        '用本课固定 B、Head 数与不同 T 做数值比较。',
      ],
      [
        paragraph(
          '每个 Head 的 Score Matrix 有 T² 个 Elements。所有 Batch Examples 和 Heads 合计拥有 B×n_head×T² 个 Score Elements；Weights 还需要同样数量的 Elements，训练还会保存额外 Activations 与 Gradients。',
        ),
        table(
          ['固定 B=2、n_head=2', '全部 Heads 的 Score Elements', '相对 T=2'],
          [
            ['T=2', '2 × 2 × 2² = 16', '1 倍'],
            ['T=1000', '2 × 2 × 1000² = 4,000,000', '250,000 倍'],
          ],
        ),
        formula(
          String.raw`\mathrm{Score\ Elements}=B\,n_{\mathrm{head}}\,T^2`,
          '每个 Batch、每个 Head 都有自己的 Query×Key Position Matrix。',
        ),
        formula(
          String.raw`\mathrm{Pairwise\ Attention\ Cost}=O(B\,n_{\mathrm{head}}\,T^2d_{\mathrm{head}})=O(BT^2C)`,
          '在 C=n_head×d_head 时，QK 与 Attention-Value Multiplication 都包含二次 Sequence Length 项。',
        ),
        paragraph(
          'Causal Mask 禁止读取未来位置，但普通 Dense 实现仍可能先构造完整 T×T Matrix。不同优化实现可以减少实际 Memory 或运算，但不会改变本课需要理解的基础 Shape。',
        ),
      ],
      [
        'O(T²) 不表示模型所有计算都只有二次项；Linear Projections 和 FFN 还依赖 C。',
        'T² 来自所有 Query-Key Position Pairs，不是因为每个 Token Vector 有 T 个 Features。',
      ],
      check('当 B、Heads 和 Width 固定时，T 翻倍后 Score Elements 增长几倍？', [
        paragraph('四倍，因为 (2T)²=4T²。'),
      ]),
    ),
    section(
      'o0283-18-week-7-7',
      '18. Week 7 调试清单与必须掌握的 10 件事',
      'Attention 术语和 Shape 很多，学习者容易记住碎片，却无法定位计算链中第一个出错的步骤。',
      [
        '建立从输入到 Output 的逐层调试顺序。',
        '用十个固定要点回收本周全部核心概念。',
      ],
      [
        table(
          ['调试顺序', '应该检查什么'],
          [
            ['1. X', '确认是 [B,T,C] 向量，不是 Token ID'],
            ['2. Q/K/V', '确认 [B,T,d_head]，数值来自相应 Projection'],
            ['3. Scores', '确认使用 K.transpose(-2,-1)，得到 [B,T,T]'],
            ['4. Scale', '确认除以 √d_k'],
            ['5. Mask', '确认 Future Columns 在 Softmax 前为 −∞'],
            ['6. Softmax', '确认 dim=-1，每个 Query Row 加总为 1'],
            ['7. Retrieval', '确认 Weights @ V，而不是 @ K'],
            ['8. Multi-Head', '确认在 Feature Axis Concat，并经 W_O 恢复 C'],
            ['9. Batch', '确认不同 Batch Examples 没有相互读取'],
            [
              '10. Logits',
              '确认 LM Head 接收 Contextual Features，而不是 Attention Weights',
            ],
          ],
        ),
        list(
          [
            'Attention 解决相同当前 Token 无法读取不同前缀的问题。',
            'X 是 Token 的向量表示，不是 Token ID。',
            'Query 表达当前位置需要寻找什么。',
            'Key 提供用于匹配的 Learned Clue。',
            'Value 提供匹配后真正带回的 Payload。',
            'QKᵀ 的每个元素都是一个 Query-Key Dot Product Raw Score。',
            'Scale、Mask、Row Softmax 的顺序不能交换或省略。',
            'Causal Mask 禁止 Future，但允许全部历史和当前位置。',
            'Multi-Head Concat 与 W_O 将多个 Head 恢复到 Model Width C。',
            'Attention Output 是 Contextual Features；LM Head 才产生 Vocabulary Logits。',
          ],
          true,
        ),
        formula(
          String.raw`X\rightarrow Q,K,V\rightarrow QK^\top\rightarrow /\sqrt{d_k}\rightarrow\mathrm{Mask}\rightarrow\mathrm{Softmax}\rightarrow PV\rightarrow\mathrm{MultiHead}\rightarrow H\rightarrow\mathrm{Logits}`,
          '从输入表示到下一词原始分数的完整概念链。',
        ),
      ],
      [
        '不要只打印 Shape；Shape 正确但 Softmax Axis 或 Matrix Axis 错误时，代码仍可能运行。',
        '不要用一张 Attention Weight Matrix 解释整个模型的最终预测。',
      ],
      check(
        '如果 Scores 正确，但 Future Position 仍有正 Weight，最应该先检查哪两步？',
        [
          paragraph(
            '先检查 Causal Mask 是否在 Softmax 前正确应用，再检查 Softmax 是否沿 Key Position Axis dim=-1 运行。',
          ),
        ],
      ),
    ),
    section(
      'o0284-19-week-7-week-8',
      '19. Week 7 → Week 8：Attention 还不是完整 Transformer Block',
      'Attention 可以跨位置交换信息，但还缺显式 Position Information、稳定的 Residual Path、Normalization 与逐位置非线性处理。',
      [
        '建立 Week 8 各组件的职责边界。',
        '验证每次 Residual Addition 都要求相同 Shape。',
      ],
      [
        paragraph(
          'Week 8 将从同一个 [B,T,C]=[2,2,4] 接口继续。Token Embedding 与 Position Embedding 相加后仍为 [2,2,4]；Multi-Head Attention 经过 Concat 与 W_O 后也必须返回 [2,2,4]，才能与 Residual Path 相加。',
        ),
        chain([
          'Token Embedding + Position Embedding [2,2,4]',
          'Pre-Norm Multi-Head Attention [2,2,4]',
          'x + Attention(LN₁(x)) [2,2,4]',
          'Per-Position FFN [2,2,4]',
          'x₁ + FFN(LN₂(x₁)) [2,2,4]',
          'Language Model Head → Logits [2,2,V_vocab]',
        ]),
        formula(
          String.raw`x_1=x+\operatorname{Attention}(\operatorname{LN}_1(x)),\qquad x_2=x_1+\operatorname{FFN}(\operatorname{LN}_2(x_1))`,
          '每次 Residual Addition 两侧 Shape 都必须为 [B,T,C]。',
        ),
        table(
          ['组件', '主要职责'],
          [
            ['Position Embedding', '提供 Token 顺序与位置信息'],
            [
              'Causal Multi-Head Attention',
              '跨允许的 Token Positions 混合信息',
            ],
            ['FFN', '在每个 Position 独立执行相同非线性变换'],
            ['Residual Connection', '保留原路径并改善深层训练'],
            ['Layer Normalization', '帮助稳定各层输入尺度'],
          ],
        ),
      ],
      [
        '不能把 Single-Head Output [2,2,2] 直接与 x [2,2,4] 相加。',
        'FFN 不跨 Token Positions 混合；跨位置读取由 Attention 完成。',
      ],
      check('Week 8 中哪个组件跨位置混合，哪个组件逐位置独立处理？', [
        paragraph(
          'Causal Multi-Head Attention 跨允许的 Token Positions 混合；FFN 对每个 Position 独立使用同一套非线性网络。',
        ),
      ]),
    ),
  ],
};
