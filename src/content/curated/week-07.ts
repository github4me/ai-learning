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
  ['b=0, t=0', 'x[0,0,:]', '我', 'prompt A 的第一个 token'],
  ['b=0, t=1', 'x[0,1,:]', '喜欢', 'prompt A 的第二个 token'],
  ['b=1, t=0', 'x[1,0,:]', '猫', 'prompt B 的第一个 token'],
  ['b=1, t=1', 'x[1,1,:]', '喜欢', 'prompt B 的第二个 token'],
];

const matrixAxes =
  '每张 [T,T]=[2,2] 表：行是 query position t（t=0 第一个 token；t=1 第二个 token），列是 key/value position j（j=0 第一个 token；j=1 第二个 token），不是 feature 轴。';

export const week07Revision: CuratedWeekRevision = {
  weekSlug: 'week-07',
  title: 'Week 7 - Attention：让当前位置按需读取左侧上下文',
  keyQuestion:
    '当“喜欢”既出现在[我,喜欢]又出现在[猫,喜欢]时，模型如何读取不同的前缀并给出可能不同的下一词 logits？',
  objectives: [
    '沿 x → Q/K/V → scores → causal mask → weights → weighted Values → output 追踪一次因果 Attention。',
    '准确读取每张 [T,T] 矩阵的 query 行与 key/value 列。',
    '用 B=2、T=2、C=4、n_head=2、head_size=2 实现并审计 causal multi-head attention。',
    '说明 Attention 的限制、T² 成本，以及它为什么需要 Week 8 的 Transformer block。',
  ],
  estimatedReadingMinutes: 70,
  sections: [
    section(
      'o0255-week-7',
      'Week 7 核心目标：让“喜欢”按需读取前缀',
      'Week 6 的 Bigram 对相同最后 token 只查同一行。因此 [我,喜欢] 和 [猫,喜欢] 的最后 喜欢 必然得到同一组 next-token logits。',
      [
        '把固定的一 token lookup 换成每个位置都能按内容读取允许前缀的机制。',
        '保留 Week 6 的 [B,T,V_vocab] logits、right-shift loss 与 logits[:, -1, :] 生成接口。',
      ],
      [
        paragraph(
          'Attention 是动态路由：当前位置先决定哪些可见位置重要，再混合那些位置携带的信息。固定窗口、循环状态和卷积也能聚合上下文；Attention 的特点是每个 query 都能直接、按内容比较所有允许位置。它不是更大的永久记忆，也不证明模型理解了文本。',
        ),
        table(
          ['batch / position', 'tensor slot', 'token', '它属于哪条 prompt'],
          positionRows,
          '本周固定 batch：B=2，T=2，C=4',
        ),
        chain([
          'x [B,T,C] = [2,2,4]',
          '每个 head 的 Q / K / V [2,2,2]',
          'scores [B,T,T] = [2,2,2]',
          'causal mask → weights [2,2,2]',
          'weighted Values / head output [2,2,2]',
          '两个 heads concat [2,2,4]',
          'output projection [2,2,4]',
          'later language-model head → logits [2,2,V_vocab]',
        ]),
        paragraph(
          '下面的 t 表示 query 所在的行，j 表示它要读取的 key/value 所在的列。第二个 喜欢 能读取不同的 j=0：A 中是 我，B 中是 猫；这给后续表示和 logits 不同的通路，但未经训练不保证某个具体结果。',
        ),
        formula(
          String.raw`\mathrm{context}_t=\sum_{j\le t}\alpha_{t,j}v_j`,
          '位置 t 的 context 是它对所有允许 key/value 位置 j 的 attention weight 与 Value 的加权和。',
        ),
      ],
      [
        'Attention 自己输出的是 contextual features，不是 vocabulary probabilities；稍后的 output head 才映射为 logits。',
        'GPT 的 causal Attention 不能读取右侧未来 token。',
      ],
      check(
        '为什么 Attention 能让两个最后都是“喜欢”的 prompt 可能不同，而 Bigram 不能？',
        [
          paragraph(
            'Bigram 只查 喜欢 的固定 row；Attention 的最后 query 可在 causal mask 下读取不同的 position-0 Key 与 Value（我 或 猫）。',
          ),
        ],
      ),
    ),
    section(
      'o0257-1-context-aggregation',
      '1. 最简单的 Context Aggregation',
      '若把可见 token 一律平均，任何 query 都得到同一种静态摘要，无法选择不同的前缀信息。',
      [
        '先以 uniform mean 作为清楚的 baseline，再看为何需要每个 query 自己的 weights。',
        '区分“能够汇总”与“能按当前需求选择”。',
      ],
      [
        paragraph(
          '对两条长度为 T=2 的序列，平均把 x₀ 和 x₁ 压成一个长度 C=4 的向量。它不是错误方法，只是对于最终 喜欢，它不能按 query 改变给 我 或 猫 的影响量。',
        ),
        formula(
          String.raw`\bar{x}=\frac{1}{T}\sum_{j=0}^{T-1}x_j\in\mathbb{R}^{C},\qquad T=2,\ C=4,\ \bar{x}\in\mathbb{R}^{4}`,
          '把两个位置的四维向量均匀平均，得到一个四维向量。',
        ),
        table(
          [
            'mechanism',
            '最终 喜欢 对 position 0 / 1 的读取',
            '是否为每个 query 单独选择',
          ],
          [
            ['uniform mean', '[0.5, 0.5]', '否'],
            ['head 1 illustrative trained outcome, A', '[0.599, 0.401]', '是'],
            ['head 1 illustrative trained outcome, B', '[0.426, 0.574]', '是'],
          ],
          '注意：mean baseline 没有 [T,T] 矩阵；Attention 的 [T,T] 才为每个 query 提供一行。',
        ),
      ],
      [
        '两条 batch sequence 彼此独立，不能把 A 和 B 当成一条四 token 序列平均。',
        'mean 不是“错误”，它只是所有位置使用固定相等 weights。',
      ],
      check('uniform mean 的哪一点使最终“喜欢”无法适配 我 与 猫 的差异？', [
        paragraph(
          '它对每个位置固定给相等 weight，不能针对当前 query 改变读取比例。',
        ),
      ]),
    ),
    section(
      'o0258-2-q-k-v',
      '2. 用搜索系统理解 Q、K、V',
      '“回看上下文”没有说明当前位置要找什么、候选怎样匹配、又要带回什么内容。',
      [
        '先回答三个任务问题，再把答案命名为 Query、Key 和 Value。',
        '说明三者都是同一输入 x 的 learned views，而不是三份外部 token list。',
      ],
      [
        table(
          ['层必须回答的问题', '随后名称', '在最终 喜欢 的例子中'],
          [
            [
              '当前位置需要什么？',
              'Query (Q)',
              '可学习为寻找较早位置的某种线索',
            ],
            [
              '每个可见位置靠什么被找到？',
              'Key (K)',
              'j=0 提供来自 我 或 猫 的匹配线索',
            ],
            [
              '找到后应带回什么？',
              'Value (V)',
              'j=0 的内容参与最终 representation',
            ],
          ],
        ),
        paragraph(
          '只有在明确三件不同工作之后才叫 Q、K、V。分开的 learned projection 让训练可让“用于匹配的 clue”不同于“需要传回的 payload”；初始参数随机，角色来自 loss gradient，而非人工指定语法标签。',
        ),
        formula(
          String.raw`Q^{(h)}=XW_Q^{(h)},\qquad K^{(h)}=XW_K^{(h)},\qquad V^{(h)}=XW_V^{(h)}`,
          '第 h 个 head 对同一个输入 X 使用三套可学习投影，产生 Query、Key 和 Value。',
        ),
        formula(
          String.raw`X:[B,T,C]=[2,2,4],\qquad W_{Q,K,V}^{(h)}:[C,\mathrm{head\_size}]=[4,2]\quad\Longrightarrow\quad Q,K,V:[2,2,2]`,
          '批次和位置轴保持不变，四个输入 features 投影为每个 head 的两个 features。',
        ),
      ],
      [
        'Q、K、V 不是固定的人类语言标签，也不是额外输入的三句话。',
        'Key 用于匹配，Value 才是加权汇总时被带回的内容。',
      ],
      check('weights 形成后，Q、K、V 中哪一种会被加权相加？', [
        paragraph(
          'Value。Q 与 K 决定读取地址（weights），V 提供被汇总的内容。',
        ),
      ]),
    ),
    section(
      'o0260-3',
      '3. 为什么要有三份表示',
      '若只共享一个表示，匹配条件与要传回的内容会被迫使用完全相同的 features。',
      [
        '把 Query、Key、Value 的职责分离为可独立学习的线索和 payload。',
        '用 row-vector shape 说明每个位置如何获得 head_size=2 的表示。',
      ],
      [
        paragraph(
          '位置可以用 Key 宣传“怎样找到我”，用 Value 保存“找到我后带走什么”，并在自己的轮次用 Query 表达“我现在需要什么”。在 A 中，j=0 的 Key 可匹配最终 喜欢 的 Query，且 Value 可为 [1,0]；B 的 j=0 则由 猫 产生另一组 Key 与 Value。',
        ),
        formula(
          String.raw`W_Q^{(h)},W_K^{(h)},W_V^{(h)}\in\mathbb{R}^{4\times2},\qquad q_t^{(h)},k_t^{(h)},v_t^{(h)}\in\mathbb{R}^{2}`,
          '本周每个 head 的三种投影矩阵均把四维输入投影为两维。',
        ),
        formula(
          String.raw`x_t\in\mathbb{R}^{1\times4},\qquad x_tW\in\mathbb{R}^{1\times2}\quad\text{when}\quad W\in\mathbb{R}^{4\times2}`,
          '采用 row-vector 写法时，一个位置的四维输入乘以四乘二矩阵得到两维 head representation。',
        ),
      ],
      [
        '三份表示不表示复制三份文本，也不表示多了三个 token 输入。',
        '一个 head 的 Key 或 Value 不能自动解释为“主语”或其他固定语法角色。',
      ],
      check('为什么理想的 matching Key 可以省去 Value 仍保留的信息？', [
        paragraph(
          '找到记录和传回有用内容是两件不同工作；匹配线索不必包含完整 payload。',
        ),
      ]),
    ),
    section(
      'o0261-4-query-key-dot-product',
      '4. Query 与 Key 的 Dot Product',
      '每个 Query 需要为每个候选 Key position 产生一个可比较的分数。',
      [
        '把 dot product 解释为 learned compatibility score，而不是人类认证的语义相似度。',
        '以 head 1 的最终 喜欢 为例，标出 dot-product 产生一整行 scores。',
      ],
      [
        paragraph(
          '固定 query row t 后，它与每个 key column j 做一次 dot product。对应 learned dimensions 越对齐，分数可越高；这个“可”由训练决定，不是任何绝对语义结论。',
        ),
        formula(
          String.raw`s_{t,j}^{(h)}=q_t^{(h)}\cdot k_j^{(h)},\qquad S^{(h)}=Q^{(h)}(K^{(h)})^\top`,
          '第 h 个 head 的 score 元素是 query position t 与 key position j 的 dot product。',
        ),
        table(
          ['head 1, final query row t=1', 'j=0: first token', 'j=1: 喜欢'],
          [
            ['A = [我,喜欢], raw dot-product scores', '1.131', '0.566'],
            ['B = [猫,喜欢], raw dot-product scores', '0.141', '0.566'],
          ],
          '这是 illustrative trained-head outcome；行是最终 喜欢 的 query，列是它可比较的 Key positions。',
        ),
        formula(
          String.raw`Q:[2,2,2],\qquad K.\operatorname{transpose}(-2,-1):[2,2,2],\qquad S:[2,2,2]`,
          'transpose 只交换最后两个轴，保留 batch B=2；输出的最后两轴分别是 query position 和 key position。',
        ),
        paragraph(matrixAxes),
      ],
      [
        '不要 transpose batch axis；PyTorch 的 transpose(-2,-1) 只交换时间与 head-feature 两个最后轴。',
        'score 可以为任意实数，尚不是 probability。',
      ],
      check('在 S[b,t,j] 中，t 与 j 分别索引什么？', [
        paragraph(
          't 是 query position 的行；j 是 key position（也就是稍后 Value position）的列。',
        ),
      ]),
    ),
    section(
      'o0263-5-softmax-scores-weights',
      '5. Softmax 把 Scores 变成 Weights',
      'scores 是不受限制的正负数，不能直接作为稳定的加权比例。',
      [
        '让每个允许的 query row 都成为非负且和为一的 weight distribution。',
        '明确 Softmax 沿 key-position column axis dim=-1 运行。',
      ],
      [
        paragraph(
          '缩放并 mask 后，Softmax 让同一个 query row 内的 Key positions 竞争。下面是 head 1 的 illustrative trained-head outcome；它们是 attention weights，不是 Week 6 对五个 vocabulary token 的 probabilities。',
        ),
        formula(
          String.raw`\alpha_{t,j}=\frac{\exp(\tilde{s}_{t,j})}{\sum_{r=0}^{T-1}\exp(\tilde{s}_{t,r})}`,
          '对固定 query row t，key positions r 的指数分数归一化为 attention weights。',
        ),
        table(
          [
            'prompt, t=1 final 喜欢',
            'scaled score row [j=0,j=1]',
            'row Softmax weights [j=0,j=1]',
          ],
          [
            ['A = [我,喜欢]', '[0.8, 0.4]', '[0.599, 0.401]'],
            ['B = [猫,喜欢]', '[0.1, 0.4]', '[0.426, 0.574]'],
          ],
          '每一 row 只在 key/value columns 上归一化。',
        ),
        formula(
          String.raw`A=\operatorname{softmax}(\tilde{S},\mathrm{dim}=-1),\qquad A:[B,T,T]=[2,2,2]`,
          'scores 的 shape 保持不变；最后一维 j 被转换为每个 query 的 attention weights。',
        ),
      ],
      [
        'Softmax 沿 query axis dim=-2 会把语义弄错，即使 tensor shape 能运行。',
        '较高 attention weight 不是对最终预测的完整解释。',
      ],
      check('为什么是每个 query row，而不是整个 [T,T] 矩阵，分别加总为 1？', [
        paragraph(
          '每个 query 独立决定怎样分配自己的读取；同一 row 的所有可见 key/value columns 共同竞争。',
        ),
      ]),
    ),
    section(
      'o0264-6-values',
      '6. 加权汇总 Values',
      '找到相关位置还不够；层还需要以可微方式把这些位置的内容带回 query position。',
      [
        '让 Key 负责“去哪里”，让 Value 负责“带回什么”。',
        '完成一个有标签的 single-head weighted Value calculation。',
      ],
      [
        paragraph(
          '对于 prompt A 的 head 1、最终 query t=1，取 position j=0 的 Value v₀=[1,0]（来自 我），以及 j=1 的 Value v₁=[0,1]（来自 喜欢）。这些是一个 head 内两维的 learned values，不是 token IDs 或 vocabulary probabilities。',
        ),
        formula(
          String.raw`o_t^{(h)}=\sum_{j=0}^{T-1}\alpha_{t,j}^{(h)}v_j^{(h)}=\sum_{j\le t}\alpha_{t,j}^{(h)}v_j^{(h)}`,
          'mask 让未来位置的 weight 为零，因此因果情形只实际汇总 j 小于或等于 t 的 Values。',
        ),
        code(
          'text',
          `Prompt A, head 1, query row t=1 (final 喜欢)
columns: j=0 first token 我       j=1 second token 喜欢
weights: [0.599, 0.401]
Values:  v_0 = [1, 0]             v_1 = [0, 1]

o_1 = 0.599 * v_0 + 0.401 * v_1
    = 0.599 * [1,0] + 0.401 * [0,1]
    = [0.599, 0.401]              # head_size=2 features`,
        ),
        formula(
          String.raw`A^{(h)}:[2,2,2]\ @\ V^{(h)}:[2,2,2]\ \longrightarrow\ O^{(h)}:[2,2,2]`,
          'matrix product 沿 scores 的 key column j 与 Values 的 position axis 相乘，保留 query position 和两个 head features。',
        ),
        paragraph(
          'B 的 j=0 Value 来自 猫，不是 我；即使两条序列的 weights 偶然相同，Values 仍可使 output 不同。',
        ),
      ],
      [
        'weights 应乘 Values，不是 Keys。',
        'O 的最后一维是两个 head features，不是两个 token 或两个 probabilities。',
      ],
      check('哪一部分改变“读取地址”，哪一部分改变“带回内容”？', [
        paragraph(
          'Q/K 的比较改变 weights，也就是地址；V 决定被这些 weights 带回的 payload。',
        ),
      ]),
    ),
    section(
      'o0265-7-scaled-dot-product-attention',
      '7. Scaled Dot-Product Attention',
      '把整个 Attention 写成一条密集公式会遮住比较、缩放、mask、归一化和取回之间的顺序。',
      [
        '把一个 causal head 分解成可逐项检查的中间张量。',
        '把 causal mask 明确插在 Softmax 之前。',
      ],
      [
        formula(
          String.raw`\operatorname{Attention}(Q,K,V)=\operatorname{softmax}\!\left(\operatorname{mask}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)\right)V,\qquad d_k=\mathrm{head\_size}=2`,
          '一个 causal attention head 依次比较 Query 和 Key、按根号 d_k 缩放、mask、行 Softmax，并用 weights 汇总 Values。',
        ),
        formula(
          String.raw`S=QK^\top,\qquad \tilde{S}=S/\sqrt{d_k},\qquad A=\operatorname{softmax}(\operatorname{mask}(\tilde{S})),\qquad O=AV`,
          '分开的中间变量依次是 raw scores、scaled scores、attention weights 和 head output。',
        ),
        table(
          [
            'A = [我,喜欢], head 1 after scaling + mask',
            'key/value j=0: 我',
            'key/value j=1: 喜欢',
          ],
          [
            ['query t=0: first token 我', 's₀₀', '−∞'],
            ['query t=1: final 喜欢', '0.8', '0.4'],
          ],
          '行=query position，列=key/value position；first row 的 future column 已在 Softmax 前屏蔽。',
        ),
        formula(
          String.raw`S,A:[B,T,T]=[2,2,2],\qquad O:[B,T,\mathrm{head\_size}]=[2,2,2]`,
          'single head 的 score 与 weight 都有一对 token-position 轴；weighted Values 恢复为每个 query 的两个 head features。',
        ),
      ],
      [
        'mask 放在 Softmax 后会留下未重新归一化的 weights。',
        '这里的 Softmax 不是 vocabulary Softmax。',
      ],
      check('把一个 causal head 的五个操作按正确顺序排列。', [
        paragraph(
          'QK transpose 得 scores，除以 √d_k，应用 causal mask，沿 key columns row-Softmax，最后乘 V。',
        ),
      ]),
    ),
    section(
      'o0266-8-sqrt-d-k',
      '8. 为什么除以 √d_k',
      'Key 的维度变多时，dot product 的大小通常也变大，可能把 Softmax 推得过尖，使梯度更难优化。',
      [
        '说明 scaling 是 score-scale 校准，而不是 mask 或 normalization。',
        '用 d_k=head_size=2 完整计算 A 的最终 score row。',
      ],
      [
        formula(
          String.raw`\tilde{s}_{t,j}=\frac{q_t\cdot k_j}{\sqrt{d_k}},\qquad d_k=2`,
          '每一个 raw dot-product score 作为标量除以 Query/Key width 的平方根。',
        ),
        code(
          'text',
          `Prompt A, head 1, final query t=1
raw score row              = [1.131, 0.566]
sqrt(d_k) = sqrt(2)       ≈ 1.414
scaled score row           = [1.131 / 1.414, 0.566 / 1.414]
                           ≈ [0.800, 0.400]`,
        ),
        paragraph(
          '除以正数不会改变同一 row 内分数的排序；它让 Softmax 接收到更稳定的数值范围。这个两维例子只展示操作，d_k 更大时，许多乘积相加的变化更明显。',
        ),
        formula(
          String.raw`\tilde{S}:[B,T,T]=[2,2,2]`,
          '缩放逐元素进行，不改变 score tensor 的任何 axis 或 shape。',
        ),
      ],
      [
        '不要除以 d_k，也不要除以 √C；score vector 宽度是 d_k=head_size=2。',
        'scaling 既不阻止未来位置，也不让 weights 自动加总为一。',
      ],
      check('除以 √d_k 后什么保持不变，什么更稳定？', [
        paragraph(
          '同一 row 的 score 排序保持不变；Softmax 的数值尺度和梯度通常更好处理。',
        ),
      ]),
    ),
    section(
      'o0268-9-self-attention-shape',
      '9. Self-Attention 的 Shape',
      '初学者容易把 [T,T] 看成 feature 或 batch，因而写出错误的 transpose 或 Softmax axis。',
      [
        '让每个 matrix axis 与矩阵乘法都可审计。',
        '说明 self 表示 Q、K、V 都来自同一条 sequence X。',
      ],
      [
        paragraph(
          'A 与 B 在同一个 batch，但 Attention 从不跨 batch 读取。A 的 Q/K/V 都由 X_A=[我,喜欢] 产生；B 的 Q/K/V 都由 X_B=[猫,喜欢] 产生。',
        ),
        table(
          [
            'head 1 scaled score slice',
            'key/value j=0: first token',
            'key/value j=1: 喜欢',
          ],
          [
            ['A, query t=0: 我', 's₀₀', 'future → masked'],
            ['A, query t=1: 喜欢', '0.8', '0.4'],
            ['B, query t=0: 猫', 's₀₀', 'future → masked'],
            ['B, query t=1: 喜欢', '0.1', '0.4'],
          ],
          '各 prompt 都有自己的 [T,T] slice；例如 S[0,1,0] 是 A 的最终 喜欢 查询 A 的 我。',
        ),
        formula(
          String.raw`Q,K,V:[B,T,\mathrm{head\_size}]=[2,2,2]`,
          '一个 head 的 Q、K、V 都保留 batch B=2、token positions T=2 与两个 head features。',
        ),
        formula(
          String.raw`Q\ @\ K.\operatorname{transpose}(-2,-1):[2,2,2]\ @\ [2,2,2]\longrightarrow[2,2,2],\qquad A\ @\ V:[2,2,2]\ @\ [2,2,2]\longrightarrow[2,2,2]`,
          '第一次矩阵乘法把 head-feature axis 相乘，第二次把 key-position axis 与 Value position axis 相乘。',
        ),
        paragraph(matrixAxes),
      ],
      [
        'T 出现两次是两个 token-position axes，从来不是 C feature axis。',
        '打印 shape 时不能丢失 batch；transpose 后仍是 [B,T,head_size] 的三个 axes，只是最后两轴交换后用于 matmul。',
      ],
      check('weights[1,1,0] 的含义是什么？', [
        paragraph(
          '它是 prompt B（b=1）的最终 喜欢 query（t=1）分给 B 的第一个 token 猫（j=0）的 attention weight。',
        ),
      ]),
    ),
    section(
      'o0270-10-gpt-causal-mask',
      '10. 为什么 GPT 需要 Causal Mask',
      'teacher-forced training 一次把完整 [B,T] 输入交给所有位置；未 mask 的 Attention 会偷看生成时不存在的 future input。',
      [
        '让训练与逐 token generation 遵守相同的左到右信息边界。',
        '以 T=2 的 lower-triangular mask 显示每个 query 允许的 columns。',
      ],
      [
        paragraph(
          '规则是 query position t 只能读取 key position j≤t。最终 喜欢（t=1）可读两列；第一个 token（t=0）只能读自己，不能把后面的 喜欢 当作预测线索。',
        ),
        table(
          [
            'causal mask M, row=query / column=key',
            'j=0: first token',
            'j=1: second token',
          ],
          [
            ['t=0: first token query', '1 allow', '0 forbid'],
            ['t=1: second token query', '1 allow', '1 allow'],
          ],
          'T=2 的 mask 是 [[1,0],[1,1]]；它同时适用于 A 与 B，并 broadcast 到 B=2。',
        ),
        formula(
          String.raw`M_{t,j}=\begin{cases}1,&j\le t\\0,&j>t\end{cases},\qquad M\in\{0,1\}^{[T,T]}=\{0,1\}^{[2,2]}`,
          'causal mask 在 row=query、column=key 的约定下是 lower triangular。',
        ),
        formula(
          String.raw`M:[2,2]\ \xrightarrow{\text{broadcast over }B}\ \mathrm{scores}:[B,T,T]=[2,2,2]`,
          '同一二维 mask 被两个 batch examples 共享，并不混合 A 与 B。',
        ),
      ],
      [
        'causal 并不等于只能看紧邻的前一个 token；它可看全部允许历史和当前位置自己。',
        '在此 row=query、column=key 约定下，mask 是下三角而不是上三角。',
      ],
      check(
        '为什么 unmasked teacher forcing 会造成 train/inference mismatch？',
        [
          paragraph(
            '训练中的较早位置可读取未来 input，但生成时未来 token 尚未产生，因此模型依赖了不可用信息。',
          ),
        ],
      ),
    ),
    section(
      'o0272-11-mask-softmax-infty',
      '11. 为什么 Mask 在 Softmax 前使用 −∞',
      '若只是把 forbidden score 改为零，Softmax 仍会给它正 weight。',
      [
        '用负无穷在归一化前把 future positions 从 distribution 中移除。',
        '对比正确的 pre-Softmax masking 与错误的 post-Softmax zeroing。',
      ],
      [
        table(
          ['first query t=0, columns [j=0,j=1]', 'result'],
          [
            ['raw scaled scores', '[0.2, 0.9]'],
            ['mask [1,0] before Softmax', '[0.2, −∞]'],
            ['Softmax(masked row)', '[1, 0]'],
            [
              'incorrect: replace forbidden score with 0',
              'Softmax([0.2, 0]) = [0.550, 0.450]',
            ],
          ],
          '正确流程保留允许分数并把 forbidden column 改为 −∞。',
        ),
        formula(
          String.raw`\hat{S}_{t,j}=\begin{cases}\tilde{S}_{t,j},&M_{t,j}=1\\-\infty,&M_{t,j}=0\end{cases},\qquad \exp(-\infty)=0`,
          'mask 后 forbidden score 的 exponential 为零，因此其 attention weight 恰为零。',
        ),
        formula(
          String.raw`\hat{S},A:[B,T,T]=[2,2,2]`,
          'mask 和 row Softmax 都不改变 batch、query position 或 key/value position axes。',
        ),
      ],
      [
        '不要把 post-Softmax weights 乘零后就结束；那会使允许 weights 不再和为一。',
        '在 PyTorch 中使用 float("-inf") 再 F.softmax，而不是把某个任意有限大负数说成精确数学的 −∞。',
      ],
      check('为什么把 forbidden score 改成 0 反而可能让它成为最大候选？', [
        paragraph('允许 scores 可以为负，而 e⁰ 仍为正；0 不是“移除”这个候选。'),
      ]),
    ),
    section(
      'o0273-12-attention-head-pytorch',
      '12. 一个 Attention Head 的 PyTorch 实现',
      '公式必须落到能随 runtime T 正确切 mask、且每一步 shape 都可检查的操作序列。',
      [
        '给出一个从 [B,T,C] 到 [B,T,head_size] 的最小 causal head。',
        '把 runtime mask、scale、axis 选择映射为具体 PyTorch lines。',
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
            torch.tril(torch.ones(context_length, context_length, dtype=torch.bool)),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [B,T,C]; in this lesson x is [2,2,4].
        _, T, _ = x.shape
        q = self.query(x)                         # [B,T,head_size] = [2,2,2]
        k = self.key(x)                           # [2,2,2]
        v = self.value(x)                         # [2,2,2]

        scores = q @ k.transpose(-2, -1)          # [B,T,T] = [2,2,2]
        scores = scores / math.sqrt(k.size(-1))   # k.size(-1) == head_size == 2
        mask = self.causal_mask[:T, :T]            # [T,T] = [2,2]
        scores = scores.masked_fill(~mask, float("-inf"))
        weights = F.softmax(scores, dim=-1)        # row-softmax over key positions
        return weights @ v                         # [B,T,head_size] = [2,2,2]`,
        ),
        formula(
          String.raw`O=\operatorname{softmax}\!\left(\operatorname{mask}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)\right)V`,
          '代码中的 projections、scores、mask、Softmax 和 weights at V 分别实现这一条公式的连续阶段。',
        ),
        table(
          ['code stage', 'input → output shape for B=2,T=2,C=4'],
          [
            ['self.query/key/value(x)', '[2,2,4] → [2,2,2]'],
            ['q @ k.transpose(-2,-1)', '[2,2,2] @ [2,2,2] → [2,2,2]'],
            ['mask / F.softmax(..., dim=-1)', '[2,2,2] → [2,2,2]'],
            ['weights @ v', '[2,2,2] @ [2,2,2] → [2,2,2]'],
          ],
        ),
      ],
      [
        '一 head 返回 [B,T,head_size]=[2,2,2]，还没有恢复 C=4，也没有生成 vocabulary logits。',
        '不要硬编码某个 T 的 mask slice；必须按当前 runtime T 取 [:T,:T]。',
        'register_buffer 的 mask 会随 device 移动，但不是 trainable parameter。',
      ],
      check('这一个 head 返回什么 shape，为什么不是 [B,T,C]？', [
        paragraph(
          '它返回 [2,2,2]，因为本例每个 head 只有 head_size=2 个 features；multi-head concat/projection 才恢复 C=4。',
        ),
      ]),
    ),
    section(
      'o0274-13',
      '13. 代码与公式逐行对应',
      '学习者可能各自认识公式和 PyTorch 片段，却无法定位哪一步首先产生错误 tensor。',
      [
        '建立 formula → code → shape 的 debug map。',
        '让 mask 明确位于 scaled scores 与 Softmax 之间。',
      ],
      [
        table(
          ['stage', 'formula', 'PyTorch', 'shape / A final row'],
          [
            [
              '1. projections',
              'Q=XW_Q, K=XW_K, V=XW_V',
              'q=self.query(x); k=self.key(x); v=self.value(x)',
              '[2,2,4] → [2,2,2]',
            ],
            [
              '2. scores + scale',
              'S=QKᵀ/√d_k',
              'scores=q @ k.transpose(-2,-1); scores /= sqrt(k.size(-1))',
              'A final row: [0.8,0.4]',
            ],
            [
              '3. causal mask',
              'Ŝ=mask(S)',
              'scores=scores.masked_fill(~mask, -∞)',
              '[2,2,2] → [2,2,2]',
            ],
            [
              '4. normalize + retrieve',
              'A=softmax(Ŝ); O=AV',
              'weights=F.softmax(scores,dim=-1); out=weights @ v',
              '[0.8,0.4] → [0.599,0.401]; O [2,2,2]',
            ],
          ],
          '每一行都对应同一 single-head forward；文字公式的 lossless LaTex 在下面逐项给出。',
        ),
        formula(
          String.raw`Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V`,
          'projection stage 把 [2,2,4] 的 X 变为三个 [2,2,2] tensors。',
        ),
        formula(
          String.raw`S=\frac{QK^\top}{\sqrt{d_k}},\qquad \hat{S}=\operatorname{mask}(S),\qquad A=\operatorname{softmax}(\hat{S}),\qquad O=AV`,
          'scaled scores、mask、row Softmax 和 weighted Value retrieval 的正确顺序。',
        ),
        paragraph(
          '调试时先看 q/k/v，再看 scaled scores；若 score 看起来正确但 forbidden future column 仍有正 weight，错误就在 mask insertion 或 Softmax ordering，而不是 Value multiplication。',
        ),
      ],
      [
        '不要在映射表里隐藏 mask；它必须在 score 与 Softmax 之间。',
        'weights @ v 是 weighted retrieval，不是又一次 learned projection。',
      ],
      check(
        'scores 正确但 future position 有非零 weight 时，表中的哪一行错了？',
        [
          paragraph(
            '第 3 行的 mask insertion，或第 4 行把 Softmax 放在 mask 前的顺序，出现了错误。',
          ),
        ],
      ),
    ),
    section(
      'o0278-14-self-attention',
      '14. 为什么叫 Self-Attention',
      '只说 Attention 没有说明 Query 是在同一 sequence 内读，还是从另一数据源读取。',
      [
        '给 self-attention 的数据流命名，不把本课扩展成 cross-attention 实现。',
        '明确 batch 让两个 prompts 并行，而不让它们彼此相互读取。',
      ],
      [
        paragraph(
          'Self 的含义是 Q、K、V 都源自同一条 X：X_A→Q_A,K_A,V_A，X_B→Q_B,K_B,V_B。它不表示 token 只能看自己；GPT 的 causal self-attention 允许它看自己的可见左侧。Cross-attention 则会让 Q 来自一条 sequence，而 K/V 来自另一条 source。',
        ),
        formula(
          String.raw`Q=XW_Q,\qquad K=XW_K,\qquad V=XW_V,\qquad [B,T,C]=[2,2,4]\longrightarrow[B,T,\mathrm{head\_size}]=[2,2,2]`,
          '同一 X 生成三种 head representations，同时保持两个 batch examples 分离。',
        ),
        formula(
          String.raw`S:[B,T,T]=[2,2,2]\neq[B,T,B,T]`,
          'score tensor 为每个 batch item 只包含它自己的 query positions 和 key positions，不含跨 batch 轴。',
        ),
      ],
      [
        'self 不等于只 attend to 自己，而是 Q/K/V 来自同一 sequence。',
        'Attention 的比较本身不提供 absolute order；Week 8 会加入 position embeddings。',
      ],
      check('在这个 B=2 batch 中，A 的“喜欢”能 attend 到 B 的“猫”吗？', [
        paragraph(
          '不能。A 和 B 是独立 batch examples；A 的 score slice 只包含 A 的两个 token positions。',
        ),
      ]),
    ),
    section(
      'o0279-15-multi-head-attention',
      '15. Multi-Head Attention',
      '单个两维 head 只有一组 learned matching/payload subspace 与一套 weights，表达容量有限。',
      [
        '并行运行两个独立 head，并把输出恢复到 model width C=4。',
        '把 head axis 与 [T,T] 的两条 position axes 严格分开。',
      ],
      [
        paragraph(
          'head 1 与 head 2 各有自己的 W_Q、W_K、W_V:[4,2]。它们可以学习不同的有用读取方式，但不保证会变成可命名的语法专家。',
        ),
        chain([
          'x [B,T,C] = [2,2,4]',
          'stacked Q/K/V [B,n_head,T,head_size] = [2,2,2,2]',
          'each head scores / weights [B,T,T] = [2,2,2]',
          'stacked head outputs [2,2,2,2]',
          'transpose + concat heads [2,2,4]',
          'output projection W_O:[4,4] → [2,2,4]',
        ]),
        formula(
          String.raw`\operatorname{MultiHead}(X)=\operatorname{Concat}(O^{(1)},O^{(2)})W_O`,
          '两个 head outputs 在 feature axis 上连接，再由 output projection 混合为 model width。',
        ),
        formula(
          String.raw`O^{(h)}\in\mathbb{R}^{[B,T,2]},\qquad \operatorname{Concat}(O^{(1)},O^{(2)})\in\mathbb{R}^{[2,2,4]},\qquad W_O\in\mathbb{R}^{4\times4}`,
          '每个 head 有两个 features；两个 head 拼接为 C=4，并用四乘四投影保持外部 shape。',
        ),
      ],
      [
        'n_head=2 不会让外部 output 变为 [2,2,8]；两个两维 heads concat 后是 C=4。',
        'head count 是独立 axis，不是 [T,T] 中的 query 或 key/value axis；每个 head 仍须 causal mask。',
      ],
      check('为什么这里要求 C=4 能被 n_head=2 整除？', [
        paragraph(
          '这样每个 head 有整数 head_size=C/n_head=2，两个 outputs 拼接后恰好回到四个 channels。',
        ),
      ]),
    ),
    section(
      'o0281-16-attention',
      '16. Attention 不是什么',
      '搜索的比喻容易让人把一次 forward 的 weights 误读为永久记忆、因果解释或模型的全部推理。',
      [
        '给 Attention 设准确边界，避免将局部权重扩大为关于模型的结论。',
        '保持“可能利用前缀”与“保证理解”的区别。',
      ],
      [
        paragraph(
          'Attention 是对当前 forward-pass 可用表示做 learned weighted information exchange。A 中最终 喜欢→我 的 head-1 weight 0.599 只说明：在这个 head、这个 layer 的线性 Value 汇总中，来自 我 的贡献比来自位置 1 更大。它不是外部数据库查询、永久 memory，也不是完整输出解释。',
        ),
        formula(
          String.raw`o_t^{(h)}=\sum_j\alpha_{t,j}^{(h)}v_j^{(h)}`,
          '这只描述一个 head 和一个 layer 的 local weighted Value aggregation；行仍是 query t，列仍是 key/value j。',
        ),
        callout(
          '仍会影响最终 logits 的其他路径',
          [
            list([
              '另一个 head、concat 与 output projection。',
              'residual path、per-position FFN、后续 Transformer layers。',
              '最终 language-model head 将 C=4 contextual features 映射到 vocabulary logits。',
            ]),
          ],
          'principle',
        ),
      ],
      [
        '不要把 attention heatmap 当作 token 对 final prediction 的因果证明。',
        '一个零 weight 不意味着该 token 没有经其他 head、residual 或 layer 影响结果。',
        'Attention 不会自动编码 position。',
      ],
      check(
        '为什么一张 attention-weight matrix 不足以解释最终 vocabulary prediction？',
        [
          paragraph(
            '其他 heads、projection、residual、FFN、后续 layers 和 language-model head 也都会改变 logits。',
          ),
        ],
      ),
    ),
    section(
      'o0282-17-attention',
      '17. Attention 的计算成本',
      '每个 query position 都与每个 key position 比较；更长的 context 使 score/weight matrices 迅速变大。',
      [
        '识别 [T,T] query-row × key-column 矩阵带来的 T² 项。',
        '以本课的 B、head 数及 T=2 与 T=1000 做可核对的数值比较。',
      ],
      [
        paragraph(
          '每个 head 的 score matrix 有 T² 个 entries。对 B=2、n_head=2，所有 heads 的 scores（weights 另有相同量）共有 B×n_head×T² 个 entries；训练还需要保留额外 activation 与 gradient。',
        ),
        table(
          ['fixed B=2, n_head=2', 'all-head score entries', '比较'],
          [
            ['T=2', '2 × 2 × 2² = 16', '本课可直接看一张 2×2 slice'],
            ['T=1000', '2 × 2 × 1000² = 4,000,000', '相对 T=2 增长 250,000 倍'],
          ],
          '每行都是 query rows × key columns；weights 也需要同样数量的 entries。',
        ),
        formula(
          String.raw`\mathrm{score\ elements}=B\,n_{\mathrm{head}}\,T^2`,
          '所有 batch examples 和 heads 的 score entries 数。',
        ),
        formula(
          String.raw`\mathrm{attention\ pairwise\ cost}=O(B\,n_{\mathrm{head}}\,T^2\,\mathrm{head\_size})=O(B\,T^2\,C)`,
          '在 C 等于 n_head 乘 head_size 时，QK 和 AV 的 pairwise work 含二次 sequence-length 项。',
        ),
      ],
      [
        'O(T²) 不表示 Transformer 的所有成本只有二次；projections 与 FFN 也依赖 C，实际时间和 memory 还受实现影响。',
        'T² 来自所有位置对的比较，不是因为一个 token vector 有 T 个 features。',
      ],
      check('在 B、heads 和 width 固定时，T 翻倍，score entries 增长几倍？', [
        paragraph('四倍，因为 (2T)²=4T²。'),
      ]),
    ),
    section(
      'o0283-18-week-7-7',
      '18. Week 7 最应该理解的 7 件事',
      '术语很多时，学习者可能只记住碎片定义，而忘记它们是一条因果计算链。',
      [
        '用七个固定要点回收 Bigram 局限、Q/K/V、matrix axes、mask、multi-head 和成本。',
        '让同一 A/B 对比与固定 shapes 成为检索线索。',
      ],
      [
        list(
          [
            'Bigram 只查最后 token 的一行；相同 final 喜欢 无法区分 A 与 B。',
            'Query 表达当前位置正在寻找什么。',
            'Key 是每个候选位置可用于匹配的 learned clue。',
            'Value 是被权重带回的 learned content。',
            'scores / weights 的 [T,T] 中，row=t query，column=j key/value；Softmax 在每一行的 columns 上做。',
            'causal mask 在 Softmax 前禁止 j>t 的未来 columns。',
            '两个 head 的 [2,2,2] outputs concat/projection 回 [2,2,4]，但 T² 成本与 Attention 的边界仍在。',
          ],
          true,
        ),
        formula(
          String.raw`X:[2,2,4]\longrightarrow Q,K,V:[2,2,2]\longrightarrow A:[2,2,2]\longrightarrow O:[2,2,2]\longrightarrow\operatorname{Concat}:[2,2,4]`,
          '一个 head 从四维 model representation 得到两维 output；两个 heads 的 outputs 拼接回四维 C。',
        ),
        paragraph(
          '紧凑对比：两个最终 token 都是 喜欢 → position 0 的 Key/Value 不同（我 / 猫）→ weights 或 context 可能不同 → 后续 logits 可能不同。Attention 提供这条信息通路，而不是保证模型理解。',
        ),
      ],
      [
        '总结不能跳过 scaling、mask 或 Values。',
        'attention weights 不是 vocabulary probabilities。',
      ],
      check(
        '请给 pipeline 中每个 tensor 命名，并说出唯一禁止 future columns 的操作。',
        [
          paragraph(
            'X 是输入 representation，Q/K/V 是投影，A 是 row-softmax weights，O 是 weighted Values，Concat 恢复 C；causal masking 在 Softmax 前禁止 future columns。',
          ),
        ],
      ),
    ),
    section(
      'o0284-19-week-7-week-8',
      '19. Week 7 → Week 8',
      'Attention 能跨位置交换信息，却还缺显式 position handling、每位置 nonlinear processing、稳定 residual paths 与 normalization，不能单独构成易堆叠的语言模型 block。',
      [
        '为 Week 8 的 token+position embeddings、pre-norm attention/residual 与 FFN/residual 建立准确接口。',
        '区分跨 position mixing 与 per-position processing，并验证每次 residual addition 的 shape。',
      ],
      [
        paragraph(
          'Week 8 从同一 A/B batch 的 x:[2,2,4] 出发：token embedding 加 position embedding 仍是 [2,2,4]；multi-head concat 加 output projection 后 Attention output 也必须是 [2,2,4]，才能与 x 相加。Attention 负责跨 token positions 混合；FFN 对每个 position 独立使用同一组 weights。',
        ),
        chain([
          'token embedding + position embedding [2,2,4]',
          'pre-norm multi-head attention → [2,2,4]',
          'x + attention(LN₁(x)) → [2,2,4]',
          'per-position FFN → [2,2,4]',
          'x₁ + FFN(LN₂(x₁)) → contextual representation [2,2,4]',
        ]),
        formula(
          String.raw`x_1=x+\operatorname{Attention}(\operatorname{LN}_1(x)),\qquad x_2=x_1+\operatorname{FFN}(\operatorname{LN}_2(x_1))`,
          '每个 residual addition 的两个输入均为 [B,T,C]=[2,2,4]；single-head [2,2,2] 必须先经过 multi-head concat/projection。',
        ),
        paragraph(
          '只比较 Q/K/V 不包含 absolute position；Week 8 的 position embeddings 补上顺序信息。A 与 B 的 position-0 区别会在这条 block pipeline 中继续存在，随后可映射为语言模型 logits。',
        ),
      ],
      [
        '不能把 single-head output [2,2,2] 直接与 x [2,2,4] 做 residual addition。',
        'FFN 不混合 token positions；跨位置混合由 causal Attention 完成。',
      ],
      check(
        'Week 8 哪个组件跨 token positions 混合，哪个组件逐位置独立处理？',
        [
          paragraph(
            'causal multi-head Attention 跨 positions 混合；FFN 在每个 position 独立运行相同的 nonlinear transformation。',
          ),
        ],
      ),
    ),
  ],
};
