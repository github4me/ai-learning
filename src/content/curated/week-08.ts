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

const positionEmbeddingRows = [
  ['0', '[0.05, 0.10, -0.05, 0.00]'],
  ['1', '[-0.10, 0.00, 0.05, 0.10]'],
];

const fixedBatch =
  '固定教学 batch：Vocabulary 为 0=我、1=喜欢、2=AI、3=学习、4=猫，V_vocab=5；prompt A IDs=[[0,1]]（我 喜欢），prompt B IDs=[[4,1]]（猫 喜欢）；B=2、T=2、C=4、n_head=2、head_size=D=2。';

const blockShapeChain = [
  'ids [B,T] = [2,2]',
  'token embeddings [B,T,C] = [2,2,4] + position embeddings [T,C] = [2,4]',
  'x0 [2,2,4]',
  'x0 [2,2,4] + Attention(LN1(x0)) [2,2,4] → x1 [2,2,4]',
  'x1 [2,2,4] + FFN(LN2(x1)) [2,2,4] → x2 [2,2,4]',
  'contextual representation [2,2,4]',
  'final LayerNorm + LM head → logits [B,T,V_vocab] = [2,2,5]',
];

const multiHeadShapeChain = [
  'z = LN1(x) [2,2,4]',
  'Q, K, value_states [2,2,4] each',
  'reshape + transpose each → [B,H,T,D] = [2,2,2,2]',
  'scores = Q @ K.transpose(-2,-1) [B,H,T,T] = [2,2,2,2]',
  'causal mask + Softmax over key axis [2,2,2,2]',
  'head outputs = weights @ value_states [2,2,2,2]',
  'transpose + concatenate heads [B,T,H·D] = [2,2,4]',
  'output projection [B,T,C] = [2,2,4]',
];

export const week08Revision: CuratedWeekRevision = {
  weekSlug: 'week-08',
  title: 'Week 8 - Transformer：把 Attention 组装成可训练的网络',
  keyQuestion:
    '怎样把 token 和位置表示、causal multi-head Attention、FFN、LayerNorm 与 residual paths 组装成可堆叠的 GPT block？',
  objectives: [
    '沿同一批 [我,喜欢] / [猫,喜欢] 的 [2,2,4] tensors 追踪一个 pre-norm Transformer block。',
    '区分跨 token-position mixing 的 Attention 与逐 token channel mixing 的 FFN。',
    '审计每个 residual add、two-head output projection、4→16→4 FFN 与最终 [2,2,5] vocabulary logits。',
    '把 decoder-only 的因果可见性接回 Week 6 的 loss / generation interface，并为 tokenizer/data pipeline 铺垫。',
  ],
  estimatedReadingMinutes: 75,
  sections: [
    section(
      'o0286-week-8',
      'Week 8 核心目标：把 Attention 组装成一个可重复的 Block',
      '单层 causal Attention 可以在允许的位置之间搬运信息，却没有位置向量、逐位置的非线性计算、深层稳定路径，也还没有完整的 logits、训练和生成接口。',
      [
        '把 Transformer block 定义为保持 [B,T,C] 外部接口的更新：Attention 混合允许的 token positions，FFN 只变换单个 token row 的 channels。',
        '让 residual path 保留已有表示、LayerNorm 稳定 branch input；block 本身输出 contextual features，并不直接选择 token。',
      ],
      [
        paragraph(fixedBatch),
        chain(blockShapeChain),
        paragraph(
          '两条 prompt 的 喜欢@1 在 token+position 后起点相同，但 Attention 能读取不同的第 0 行（我@0 或 猫@0），因此 x2[:,1,:] 可以不同；未经训练不能据此承诺某个续写。',
        ),
        formula(
          String.raw`x_0=E_{\mathrm{token}}(\mathrm{ids})+E_{\mathrm{pos}}(0{:}T),\quad x_1=x_0+\operatorname{Attention}(\operatorname{LN}_1(x_0)),\quad x_2=x_1+\operatorname{FFN}(\operatorname{LN}_2(x_1))`,
          'x0 is token embeddings plus position embeddings; x1 adds pre-normalized attention; x2 adds pre-normalized FFN.',
        ),
      ],
      [
        'Attention 不是整个 Transformer；相同 shape 不代表内容相同。',
        'contextual representation 还不是 vocabulary probabilities。',
      ],
      check(
        '哪一步把 我/猫 混入第二位置，哪一步只变换该位置已有的 features？',
        [
          paragraph(
            'causal Attention 跨 positions 混合；FFN 对每个 position 独立、共享参数地变换 channels。',
          ),
        ],
      ),
    ),
    section(
      'o0287-1-attention',
      '1. Attention 还缺什么',
      'Week 7 已回答“当前位置应读取哪些可见位置”，却没有解决 token 顺序、局部非线性计算、跨深度的信息/gradient 路径与 branch activation scale。',
      [
        '从 Attention 的失败点引入 position signal、per-token FFN、residual paths 和 normalization，而不是把它们当作没有关系的零件。',
        '保持 Block:[2,2,4]→[2,2,4]，使下一 block 能接收已有的 contextual states。',
      ],
      [
        table(
          ['缺少的能力', '补上的组件', '喜欢@1 的作用'],
          [
            [
              'token 位置/距离',
              'position embeddings P',
              '让相同 token 的不同 location 有不同输入表示',
            ],
            [
              '跨位置通信',
              'causal multi-head Attention',
              '可读 position 0 的 我 或 猫',
            ],
            [
              '每行的非线性特征计算',
              'FFN + GELU',
              '只处理已 contextualized 的四个 channels',
            ],
            [
              '保留与 gradient route',
              'residual + x',
              '把旧表示与 branch update 相加',
            ],
            [
              '稳定 branch inputs',
              'LayerNorm',
              '逐 token row 归一化后再送入 branch',
            ],
          ],
        ),
        formula(
          String.raw`\operatorname{Block}:\mathbb{R}^{B\times T\times C}\to\mathbb{R}^{B\times T\times C}`,
          'A Transformer block maps a batch of token representations to the same external shape.',
        ),
      ],
      [
        'input/output shape 相等不表示 block 是 identity。',
        '堆更多 Attention 层不会自动补上明确的位置表示。',
      ],
      check('本课为 Attention 补上的四类能力是什么？', [
        paragraph(
          '位置 signal、逐 token 非线性 FFN、residual paths 与 normalization。',
        ),
      ]),
    ),
    section(
      'o0288-2-token-embedding',
      '2. Token Embedding 不包含位置',
      'lookup 只依赖 token ID，所以 喜欢 无论在第 0 还是第 1 个位置，都会先查到同一 E[1]。token identity 不能独自说明序列位置。',
      [
        '分开“这是什么 token”和“它位于哪里”；同一 token lookup 不是 position representation。',
        '说明 causal mask 限制未来位置，但不提供每个位置的 learned absolute/relative coordinate。',
      ],
      [
        paragraph(fixedBatch),
        table(
          ['token', 'E[token]', 'position 0', 'position 1'],
          [
            [
              '喜欢',
              '[0.60, 0.30, -0.20, 0.10]',
              '同一 lookup row',
              '同一 lookup row',
            ],
          ],
        ),
        paragraph(
          '没有 position-dependent input 的 self-attention 对 permutation 是等变的。GPT 的固定 causal mask 让 t=0 与 t=1 的可见前缀不同，因此提供了一点顺序约束；但它没有给模型一个可学习的“这是第 t 个位置”坐标。position embedding（或之后的 RoPE）显式补上这件事。',
        ),
        formula(
          String.raw`E_{\mathrm{token}}(i)=E_{\mathrm{token}}(i)\ \text{at every position},\qquad \operatorname{token\_embedding}(\mathrm{ids}):[B,T,C]=[2,2,4]`,
          'A token lookup depends on the token ID, not on the token position.',
        ),
      ],
      [
        'causal mask 是 autoregression 必需条件，不是位置向量的替代品。',
        '相同 raw embedding 不意味着后续 contextual state 必定相同。',
      ],
      check('为什么 喜欢 的 lookup 本身不能告诉模型它在 position 1？', [
        paragraph('E[1] 的索引只有 token ID=1，没有接收时间或序列位置 t。'),
      ]),
    ),
    section(
      'o0290-3-position-embedding',
      '3. Position Embedding',
      'Attention 需要能反映顺序和距离的输入，但所有后续 blocks 又要求宽度继续是 C=4。',
      [
        '用一个 learned [context_length,C] position table 给每个有效 t 一行 C=4 向量。',
        '采用相加而不是 concatenation，故输入仍为 [B,T,C]，无需改写 Q/K/V、FFN 和 residual interface。',
      ],
      [
        paragraph(
          '下表是本周固定的 didactic initial values，只用于展示 shape 与信息路线；训练从 loss 学习参数，坐标没有人工命名的“第一词意义”。',
        ),
        table(
          ['position t', 'P[t]'],
          positionEmbeddingRows,
          'didactic initial position table [T,C]=[2,4]',
        ),
        table(
          ['prompt / token', 'E[token]', 'P[t]', 'x=E+P'],
          [
            [
              'A: 我@0',
              '[0.20,-0.10,0.70,0.30]',
              '[0.05,0.10,-0.05,0.00]',
              '[0.25,0.00,0.65,0.30]',
            ],
            [
              'A: 喜欢@1',
              '[0.60,0.30,-0.20,0.10]',
              '[-0.10,0.00,0.05,0.10]',
              '[0.50,0.30,-0.15,0.20]',
            ],
            [
              'B: 猫@0',
              '[-0.70,0.40,0.30,0.60]',
              '[0.05,0.10,-0.05,0.00]',
              '[-0.65,0.50,0.25,0.60]',
            ],
            [
              'B: 喜欢@1',
              '[0.60,0.30,-0.20,0.10]',
              '[-0.10,0.00,0.05,0.10]',
              '[0.50,0.30,-0.15,0.20]',
            ],
          ],
        ),
        formula(
          String.raw`x[b,t,:]=E_{\mathrm{token}}[\mathrm{ids}[b,t]]+E_{\mathrm{pos}}[t]`,
          'Each token row adds the token embedding for its ID to the learned position vector for t.',
        ),
        paragraph(
          'position rows [T,C]=[2,4] 在 batch axis 上 broadcast，故 token rows [2,2,4] + position rows [2,4] = x0 [2,2,4]。learned absolute table 只为 configured context length 建行；out-of-range t 没有可查的 row。RoPE 是之后的 relative-position alternative，不是省略基本问题的理由。',
        ),
      ],
      [
        '不要 concatenate；那会变成 [B,T,2C] 并要求所有后续 projection 改尺寸。',
        'position-table row 是可学习参数，不是“第一词”之类的人类标签。',
      ],
      check('为什么 [T,C]=[2,4] 的 P 可以加到 [B,T,C]=[2,2,4]？', [
        paragraph(
          '同一 position vector 对每个 batch item 使用一次，因此它沿 B axis broadcast。',
        ),
      ]),
    ),
    section(
      'o0292-4-transformer-block',
      '4. Transformer Block 的两个主要计算单元',
      '只移动 Values 的模型不能在每个位置独立重组 features；只处理单行的模型又无法读到 earlier rows。',
      [
        '把 block 的两种工作严格分开：Attention 做 token-position mixing，FFN 做每 token 的 channel mixing。',
        '在同一 [2,2,4] contract 内完成两种互补操作。',
      ],
      [
        paragraph(
          'Attention 是 cross-position mixing：query t 的 output 从允许的 j≤t 的 value_states 汇总。FFN 是 per-token channel mixing：同一个 nonlinear function 分别作用于 x[b,t,:]，绝不直接读取 x[b,j,:]（j≠t）。“communication / local feature transformation”只是帮助记忆的比喻，不是 literal thought。',
        ),
        formula(
          String.raw`\operatorname{Attention}(x)_{b,t,:}=\sum_{j\le t}\alpha_{b,t,j}\,\mathrm{value\_states}_{b,j,:},\qquad \operatorname{FFN}(x)_{b,t,:}=f(x_{b,t,:})`,
          'Attention combines allowed token positions; FFN applies a local function to one token row.',
        ),
        chain(multiHeadShapeChain),
      ],
      [
        'FFN sharing one parameter set across positions does not make it cross-position mixing.',
        'Attention output is not a single token’s FFN result. Use value_states to avoid confusing Values with V_vocab=5.',
      ],
      check('FFN 在 喜欢@1 能否直接查看 猫@0？', [
        paragraph(
          '不能；它只能接收 attention/residual stage 已产生的、属于 喜欢@1 的 contextualized row。',
        ),
      ]),
    ),
    section(
      'o0295-5-feed-forward-network',
      '5. Feed-Forward Network',
      'Attention output 是 Values 的加权组合；每个位置仍需要能表达条件式 feature interaction 的非线性计算。',
      [
        '定义一个在所有 positions 共享的两层 FFN：C=4 先扩展到 4C=16，再投影回 4。',
        '使 internal capacity 变大而 external output 留在 [B,T,C]，因此可以做 residual add。',
      ],
      [
        paragraph(
          'attention 已让 A/B 的 喜欢@1 可以带有不同 context；之后同一组 FFN weights 分别处理 batch 中四个 token rows。输入数值不同会得到不同 output，但每个位置没有自己的 FFN 参数，也不会借此直接读另一个 row。',
        ),
        formula(
          String.raw`\operatorname{FFN}(z)=W_2\,\operatorname{GELU}(W_1z+b_1)+b_2`,
          'The FFN expands each C-dimensional row, applies GELU, and projects it back to C.',
        ),
        table(
          [
            'stage',
            'row-vector parameter / tensor shape',
            'visible batch shape',
          ],
          [
            ['first Linear', 'W1:[C,4C]=[4,16]', '[2,2,4] → [2,2,16]'],
            ['GELU', 'no learned shape change', '[2,2,16] → [2,2,16]'],
            ['second Linear', 'W2:[4C,C]=[16,4]', '[2,2,16] → [2,2,4]'],
          ],
        ),
      ],
      [
        '4C 是 hidden width，不是 four attention heads，也不是数学定律。',
        '不能把 [2,2,16] hidden tensor 直接 residual-add 到 [2,2,4]。',
      ],
      check('为什么第二个 Linear 必须从 16 回到 4？', [
        paragraph(
          '它恢复 [B,T,C]=[2,2,4]，使 residual path 和下一 block 仍可接收该 tensor。',
        ),
      ]),
    ),
    section(
      'o0297-6-gelu',
      '6. 为什么需要 GELU',
      '若在 4→16→4 两个 Linear 之间没有 activation，它们整体仍只是一个 affine map，失去 FFN 所需的条件非线性。',
      [
        '把 GELU 放在两个 projections 之间，作为平滑的 nonlinear gating。',
        '说明核心不是背曲线，而是它阻止两层 Linear 代数地折叠成一层。',
      ],
      [
        formula(
          String.raw`W_2(W_1z+b_1)+b_2=(W_2W_1)z+(W_2b_1+b_2)`,
          'Without an activation, two affine transformations compose into one affine transformation.',
        ),
        chain([
          'one token row z [4]',
          'Linear W1 → hidden [16]',
          'GELU → hidden [16]',
          'Linear W2 → output [4]',
          'applied independently to every [B,T] location → [2,2,4]',
        ]),
        paragraph(
          'GELU 的响应是连续、平滑的；它不是二值 if-statement，也不负责 token mixing。不同 architecture 也可能使用 ReLU、SwiGLU 等 choices，本 block 的重点是 nonlinear middle step。',
        ),
      ],
      [
        '两个 Linear 不会因为层数为二就自动非线性。',
        'GELU 不读取 position 0，也不替代 causal Attention。',
      ],
      check('删除 GELU 的精确失败是什么？', [
        paragraph(
          '4→16→4 的两次 affine transformations 可以化为单个 affine transformation。',
        ),
      ]),
    ),
    section(
      'o0299-7-residual-connection',
      '7. Residual Connection',
      '若每个 sublayer 都必须重建全部 useful representation，已有信息容易被覆盖，且深层的 gradient route 会更脆弱。',
      [
        '让 sublayer 学一个 update F(x)，同时保持 x 的 identity path。',
        '在 forward 保存 prior representation；在 backward 让 gradient 经 identity 与 branch 两条路径汇合。',
      ],
      [
        paragraph(
          '对 prompt A，令 a=Attention(LN1(x0))，则 x1=x0+a；对 B，相同规则保留由 猫@0 带来的不同信息，同时加上 contextual update。分支处 gradients 相加，呼应“paths multiply; branches add”，但这不是所有 optimization problems 的保证。',
        ),
        formula(
          String.raw`y=x+F(x),\qquad \frac{\partial y}{\partial x}=I+\frac{\partial F(x)}{\partial x}`,
          'A residual output combines an identity path with a learned update, and gradients have both routes.',
        ),
        table(
          ['term', 'shape in this lesson'],
          [
            ['x0', '[B,T,C]=[2,2,4]'],
            ['Attention(LN1(x0))', '[B,T,C]=[2,2,4]'],
            ['x1 = x0 + attention update', '[B,T,C]=[2,2,4]'],
            ['x1', '[B,T,C]=[2,2,4]'],
            ['FFN(LN2(x1))', '[B,T,C]=[2,2,4]'],
            ['x2 = x1 + FFN update', '[B,T,C]=[2,2,4]'],
          ],
        ),
      ],
      [
        'residual 不表示 F(x) 被丢弃，也不是 concatenation。',
        'identity route 有帮助不等于训练必然稳定。',
      ],
      check('y 的 forward 中有哪两条贡献路径？', [
        paragraph('未修改的 x identity path 与 learned branch update F(x)。'),
      ]),
    ),
    section(
      'o0301-8-residual-shape',
      '8. Residual 对 Shape 的要求',
      '加法逐元素进行；若 branch external shape 与 residual input 不同，就不能安全相加。',
      [
        '把 every residual add 变成 architecture contract：branch 内部可变宽，但输出必须回到 [B,T,C]。',
        '审计 two-head concat/output projection 和 FFN hidden expansion 如何都回到 C=4。',
      ],
      [
        code(
          'text',
          `x0                         [2,2,4]
Attention(LN1(x0))         [2,2,4]
x1 = x0 + attention_update [2,2,4]

x1                         [2,2,4]
FFN(LN2(x1))               [2,2,4]
x2 = x1 + ffn_update       [2,2,4]`,
        ),
        paragraph(
          'causal multi-head Attention 负责 cross-position mixing：每 head 是 [B,T,D]=[2,2,2]，H=2 个 heads concatenate 成 [B,T,H·D]=[2,2,4]，再经 output projection [2,2,4]→[2,2,4]。FFN 只对每个 token row 做 channel mixing，暂时到 [2,2,16]，再由 W2 回到 [2,2,4]。',
        ),
        formula(
          String.raw`\operatorname{shape}(x)=\operatorname{shape}(F(x))=[B,T,C],\qquad H\cdot D=2\cdot2=C=4`,
          'Each residual branch must return the same batch, time, and channel dimensions as its input.',
        ),
      ],
      [
        '把错误 shape broadcast 成可运行不是 architecture fix。',
        'output projection 不是在 concat width 与 residual interface 不同的时候可选的步骤。',
      ],
      check('为什么 [2,2,16] FFN hidden state 不能直接加到 [2,2,4]？', [
        paragraph(
          '最后的 channel axes 是 16 和 4，必须由第二个 Linear 恢复 C=4。',
        ),
      ]),
    ),
    section(
      'o0302-9-layer-normalization',
      '9. Layer Normalization 的直觉',
      '深层网络的 branch 可能接收 mean 或 scale 漂移的 representation，给优化带来不稳定的输入范围。',
      [
        'LayerNorm 对每个 token row 的 C=4 features 计算 statistics，并用 learned γ、β 恢复灵活的 per-feature scale/offset。',
        '说明它在本 GPT block 中不混合 tokens、不依赖 batch peers，并与 BatchNorm 的 train/eval behavior 区分。',
      ],
      [
        paragraph(
          '对于 didactic row [1,2,3,4]，μ=2.5；减去 μ、除以该 row 的 variance+ε 的平方根，再应用 γ、β。A 的 我@0、喜欢@1 和 B 的两个 rows 都分别计算自己的 statistics。',
        ),
        formula(
          String.raw`\mu_{b,t}=\frac{1}{C}\sum_{c=1}^{C}x_{b,t,c},\quad \sigma^2_{b,t}=\frac{1}{C}\sum_{c=1}^{C}(x_{b,t,c}-\mu_{b,t})^2,\quad \operatorname{LN}(x)_{b,t,c}=\gamma_c\frac{x_{b,t,c}-\mu_{b,t}}{\sqrt{\sigma^2_{b,t}+\varepsilon}}+\beta_c`,
          'LayerNorm computes mean and variance across the features of one token row and then applies learned gamma and beta.',
        ),
        table(
          [
            'normalization',
            'statistics are computed over',
            'train / eval behavior',
          ],
          [
            [
              'LayerNorm here',
              'each x[b,t,:] row over its C=4 features',
              'same per-row rule for one generation prompt or a batch',
            ],
            [
              'BatchNorm (typical)',
              'per channel over batch and often spatial/time examples',
              'keeps running statistics for evaluation',
            ],
          ],
        ),
        paragraph(
          'BatchNorm 并非普遍错误；LayerNorm 更贴合 variable-length/autoregressive transformer：它不需要把一个 token row 的 normalization 依赖其他 batch examples。input/output 都是 [2,2,4]，γ、β 是 [4]。',
        ),
      ],
      [
        'LayerNorm 不是 vocabulary Softmax，也不沿 T 或 B axis 统计。',
        'γ、β 说明 normalized output 不必永远是零均值、单位尺度。',
      ],
      check('x[1,0,:] 的 LayerNorm mean 由哪些值决定？', [
        paragraph(
          '只由该 row 的四个 feature values 决定，不读取其他 tokens 或其他 batch examples。',
        ),
      ]),
    ),
    section(
      'o0304-10-pre-norm-transformer-block',
      '10. Pre-Norm Transformer Block',
      '“block 有 LayerNorm”没有说明真实函数：norm、sublayer 与 residual 的顺序会改变 forward 与训练行为。',
      [
        '采用 Pre-Norm：只 normalize branch input，raw residual path 绕过 norm 与 branch。',
        '先 attention update，再用新 x1 的 Pre-Norm FFN update；Post-Norm 是有效变体但不是这里的实现。',
      ],
      [
        chain([
          'x0 [2,2,4] → LN1（per-token）[2,2,4] → causal MHA（cross-position）[2,2,4]',
          'raw x0 [2,2,4] + attention update [2,2,4] → x1 [2,2,4]',
          'x1 [2,2,4] → LN2（per-token）[2,2,4] → FFN（per-token 4→16→4）[2,2,4]',
          'raw x1 [2,2,4] + FFN update [2,2,4] → x2 [2,2,4]',
        ]),
        formula(
          String.raw`x_1=x_0+\operatorname{Attention}(\operatorname{LN}_1(x_0)),\qquad x_2=x_1+\operatorname{FFN}(\operatorname{LN}_2(x_1))`,
          'Pre-Norm sends normalized tensors into branches while retaining the unnormalized residual tensors for both additions.',
        ),
      ],
      [
        'LN(x + Attention(x)) 是 Post-Norm form，不要叫 Pre-Norm。',
        '不要把 LN(x) 错作 direct residual term；它必须是 raw x。',
      ],
      check('x1=x0+Attention(LN1(x0)) 中 direct residual path 传递什么？', [
        paragraph('原始的、pre-LayerNorm x0，shape 仍是 [2,2,4]。'),
      ]),
    ),
    section(
      'o0306-11-transformer-block',
      '11. 完整 Transformer Block',
      '只记住零件名称仍可能无法从 inputs trace 到一个可运行、可检查的 pre-norm block。',
      [
        '把一个完整 block 逐行标出 role、shape 和是否混合 positions。',
        '让 dropout 成为 shape-preserving 的 training regularization，而不污染 identity residual path。',
      ],
      [
        code(
          'python',
          `import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class CausalSelfAttention(nn.Module):
    def __init__(self, model_dim: int, num_heads: int, dropout: float):
        super().__init__()
        if model_dim % num_heads != 0:
            raise ValueError("model_dim must divide evenly into num_heads")
        self.num_heads = num_heads
        self.head_size = model_dim // num_heads
        self.qkv = nn.Linear(model_dim, 3 * model_dim, bias=False)
        self.output = nn.Linear(model_dim, model_dim, bias=False)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, time_steps, model_dim = x.shape
        q, k, value_states = self.qkv(x).chunk(3, dim=-1)
        q = q.view(batch_size, time_steps, self.num_heads, self.head_size).transpose(1, 2)
        k = k.view(batch_size, time_steps, self.num_heads, self.head_size).transpose(1, 2)
        value_states = value_states.view(batch_size, time_steps, self.num_heads, self.head_size).transpose(1, 2)
        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_size)
        causal = torch.ones(time_steps, time_steps, device=x.device, dtype=torch.bool).tril()
        scores = scores.masked_fill(~causal, float("-inf"))
        weights = self.dropout(F.softmax(scores, dim=-1))
        heads = weights @ value_states
        merged = heads.transpose(1, 2).contiguous().view(batch_size, time_steps, model_dim)
        return self.output(merged)


class TransformerBlock(nn.Module):
    def __init__(self, model_dim: int, num_heads: int, dropout: float):
        super().__init__()
        self.ln1 = nn.LayerNorm(model_dim)
        self.attention = CausalSelfAttention(model_dim, num_heads, dropout)
        self.ln2 = nn.LayerNorm(model_dim)
        self.ffn = nn.Sequential(
            nn.Linear(model_dim, 4 * model_dim),
            nn.GELU(),
            nn.Linear(4 * model_dim, model_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.ln1(x))
        x = x + self.ffn(self.ln2(x))
        return x


x = torch.randn(2, 2, 4)
assert TransformerBlock(model_dim=4, num_heads=2, dropout=0.1)(x).shape == (2, 2, 4)`,
        ),
        chain(multiHeadShapeChain),
        paragraph(
          'ln1/ln2 是 per-token [2,2,4] normalization；attention 是 cross-position mixing 后回到 [2,2,4]；FFN 是 per-token 4→16→4。两条 `x = x + ...` 都把两份 [2,2,4] 相加，第二条输出就是 contextual representation [2,2,4]。dropout 在 model.train() 时随机移除/缩放 branch activations而不改 shape；model.eval() 会关闭它，因此 inference（除 sampling）是确定的。',
        ),
      ],
      [
        '不要在 identity residual path 上放这个 outline 的 dropout。',
        'FFN 不是第二个 attention layer；每个组件必须说明跨 position 或只在 row 内工作。',
      ],
      check('哪两行含 residual add，它们输出什么 shape？', [
        paragraph(
          '两条 `x = x + ...`；每一条都把 [2,2,4] 和 [2,2,4] 合并，输出 [B,T,C]=[2,2,4]。',
        ),
      ]),
    ),
    section(
      'o0307-12-blocks',
      '12. 堆叠多个 Blocks',
      '一个 block 只做一次 contextual/nonlinear update；更丰富的 features 通常需要让后续 blocks 再处理已 contextualized states。',
      [
        '把 depth 表示为重复同一 external [B,T,C] interface、但使用不同 learned parameters 的 blocks。',
        '明确 Block 2 读取 Block 1 的 output，不重新 lookup raw IDs。',
      ],
      [
        chain([
          'x0 = token + position embeddings [2,2,4]',
          'Block 1 → x1 contextual states [2,2,4]',
          'Block 2 → x2 richer contextual states [2,2,4]',
          'final LayerNorm → h [2,2,4]',
        ]),
        formula(
          String.raw`x^{(\ell+1)}=\operatorname{Block}^{(\ell)}(x^{(\ell)}),\qquad \ell=0,\ldots,L-1`,
          'Each layer maps the same external representation shape to itself using its own parameters.',
        ),
        paragraph(
          '每个 block 有自己的 LayerNorm、Q/K/V/output projections 和 FFN parameters，除非 architecture 明确 weight sharing。dropout 在 training 中可按 block 配置使用但不改变 shape。n_layer 是 blocks 数量，不是 n_head。',
        ),
      ],
      [
        '更多 blocks 不是复制后得到同一输出，也不会延长 fixed context window。',
        '不要把 n_layer 与 n_head 混淆。',
      ],
      check('Block 2 消费什么输入？', [
        paragraph(
          'Block 1 的 [B,T,C]=[2,2,4] contextual output，不是 raw IDs 或新 token lookup。',
        ),
      ]),
    ),
    section(
      'o0308-13-transformer-output-vocabulary-logits',
      '13. 从 Transformer Output 到 Vocabulary Logits',
      'contextual state 的 C=4 是内部 feature width；语言模型在每个位置都必须给 V_vocab=5 个候选 token 打分。',
      [
        '用 LM head 把 model space [B,T,C] 映射为 vocabulary-choice space [B,T,V_vocab]。',
        '说明 head 是逐位置共享的 Linear，不是 Attention，也不是直接 token choice。',
      ],
      [
        paragraph(
          'final LayerNorm 后，h[b,1,:] 的四个 features 分别映射为 [我,喜欢,AI,学习,猫] 的五个 raw scores。A/B 的 喜欢@1 可因前面 Attention 得到不同 h row，故五-logit row 也可不同。训练读取所有 positions；生成当前轮只读取最后 position。',
        ),
        formula(
          String.raw`\mathrm{logits}=hW_{\mathrm{vocab}}+b_{\mathrm{vocab}}`,
          'The language-model head maps each contextual row to one raw score per vocabulary item.',
        ),
        table(
          ['quantity', 'shape'],
          [
            ['h', '[B,T,C]=[2,2,4]'],
            ['W_vocab', '[C,V_vocab]=[4,5]'],
            ['b_vocab', '[V_vocab]=[5]'],
            ['logits', '[B,T,V_vocab]=[2,2,5]'],
          ],
        ),
      ],
      [
        'logits 不是 probabilities，C 不必等于 V_vocab。',
        'LM head 对每个已有 position 运行，不只对 last position 运行。',
      ],
      check('为什么 [2,2,4] 会成为 [2,2,5]？', [
        paragraph(
          '每个 four-feature row 乘 [4,5] 的 LM-head matrix，得到词表中五个 candidates 的 scores。',
        ),
      ]),
    ),
    section(
      'o0309-14-gpt-forward-pass-shape',
      '14. GPT Forward Pass 的完整 Shape',
      '若不把 block internals 接回 Week 6 的 loss 与 generation interface，维度很容易在最终 logits 或 sequence append 处断裂。',
      [
        '给固定 batch 一条 canonical forward trace，并分开 teacher-forced training 与 autoregressive generation 的消费方式。',
        '保持 logits [B,T,V_vocab] 这一语言模型接口，即使 context module 已由 Bigram 换为 Transformer。',
      ],
      [
        code(
          'text',
          `ids A/B                                      [2,2]
token embeddings                             [2,2,4]
position embeddings                          [2,4] (broadcast across B)
x0 = token + position                        [2,2,4]
one or more Transformer blocks               [2,2,4]
final LayerNorm                              [2,2,4]
LM head                                      [2,2,5]

training: logits.reshape(B*T,V_vocab)        [4,5]
          targets.reshape(B*T)                [4]
          cross entropy                       scalar

generation: logits[:, -1, :]                 [2,5]
            sampled/argmax next_id            [2,1]
            appended ids                       [2,3]`,
        ),
        formula(
          String.raw`\mathcal{L}=\operatorname{CrossEntropy}(\operatorname{reshape}(\mathrm{logits},[BT,V_{\mathrm{vocab}}]),\operatorname{reshape}(\mathrm{targets},[BT]))`,
          'Training flattens batch and time into four classification rows while retaining five logits per row.',
        ),
        paragraph(
          'literal T=2 是教学 window。真实 generation 每轮先将一个 [B,1] ID append 到已保存 sequence，下一次 forward 前再把过长 prompt crop 到 configured context size。',
        ),
      ],
      [
        '不要把 logits flatten 成 [B·T·V]；cross entropy 需要 [BT,V] 与 [BT] targets。',
        '不要从所有 [B,T,V] rows 一次 append；当前轮只用 logits[:, -1, :]。',
      ],
      check('B=2、T=2、V_vocab=5 时，什么 shapes 进入 cross entropy？', [
        paragraph('logits 是 [4,5]，targets 是 [4]，结果是 scalar loss。'),
      ]),
    ),
    section(
      'o0310-15-encoder-decoder-decoder-only',
      '15. Encoder、Decoder 和 Decoder-only',
      'Transformer 是一个 family；不能把 GPT 的 causal self-attention visibility 误认为每种 Transformer 都使用相同 context permissions。',
      [
        '按允许读取的 context 与 output interface 区分 encoder-only、encoder-decoder 与 decoder-only。',
        '确认 course Mini GPT 是 causal decoder-only next-token model。',
      ],
      [
        table(
          ['family', 'permitted context', 'typical role / interface'],
          [
            [
              'encoder-only',
              'token 可读 input sequence 的双向 context',
              'representation / understanding tasks',
            ],
            [
              'encoder-decoder',
              'encoder 双向读 source；decoder 因果读 generated target prefix，并 cross-attend source',
              'input sequence → generated output sequence',
            ],
            [
              'decoder-only GPT',
              'position t 只读 same prompt 的 j≤t',
              '[B,T,V_vocab] next-token logits；last-position generation',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{decoder\text{-}only}:\qquad P(x_{1:T})=\prod_{t=1}^{T}P(x_t\mid x_{<t})`,
          'A decoder-only language model factors a sequence into left-to-right conditional probabilities.',
        ),
        paragraph(
          '对 [我,喜欢]，decoder-only 的第二位置可读 positions 0 和 1，不能读未来。每 head 的 causal score mask 在本课为 [B,H,T,T]=[2,2,2,2]。decoder-only 是 architecture label，不表示它不能形成 prompt representation，也不表示它只是机械 decoding。',
        ),
      ],
      [
        'encoder-only 的 bidirectional visibility 不能直接当成 strict left-to-right generator。',
        'encoder-decoder 不是两个 decoder-only stacks。',
      ],
      check('哪个 family 匹配 Mini GPT，为什么？', [
        paragraph(
          'decoder-only：它用 causal self-attention 做 autoregressive next-token prediction。',
        ),
      ]),
    ),
    section(
      'o0314-16-transformer',
      '16. Transformer 的能力来自哪里',
      '把看似强大的模型归因于单个 Attention 公式，会忽略参数学习、位置、非线性、depth 与训练 objective 的共同作用。',
      [
        '把能力描述为由 data、parameterized components、next-token loss、backpropagation/optimization 与 compute 共同产生的经验结果。',
        '避免把 high probability、attention weight 或 scale 本身误写成 truth、understanding 或 reasoning 的保证。',
      ],
      [
        chain([
          'data / tokenizer produce IDs',
          'embeddings + positions create [B,T,C]',
          'causal Attention exchanges allowed token information',
          'FFN + GELU transform local channels; residual/norm support depth',
          'LM head exposes vocabulary logits',
          'loss + backprop + optimizer update parameters',
        ]),
        formula(
          String.raw`\theta\leftarrow\theta-\eta\nabla_{\theta}\mathcal{L}`,
          'Optimization updates the parameter set theta using the loss gradient and learning rate eta.',
        ),
        paragraph(
          'θ 包括 token/position tables、Q/K/value/output projections、FFN、LayerNorm 与 LM-head parameters。回到 A/B：Attention 给 我/猫 影响 喜欢@1 的 route；positions 标记 locations；FFN/stacking transform state；data、loss 与 optimization 决定参数最终学到什么。',
        ),
      ],
      [
        '高 next-token probability 不保证事实真实。',
        'scale 不会取代数据与 objective；Attention 也不是所有 learned behavior 的解释。',
      ],
      check('为什么 Attention 在本课中是必要但不充分的？', [
        paragraph(
          '它提供 cross-position communication；还需要 positions、FFN、residual/norm、data、loss 和 optimization。',
        ),
      ]),
    ),
    section(
      'o0315-17',
      '17. 需要知道但暂不展开的概念',
      '初学者需要知道哪些名词是基础 block 的延伸，而不应把优化技术或 architecture variants 与本周前提混为一谈。',
      [
        '明确标出高级概念的边界，保留本周 token+position → block → logits 的可追踪核心。',
        '把每个 extension 映射回它改变的组件，而不是当作另一个训练 objective。',
      ],
      [
        table(
          ['advanced concept', '它改变什么，不改变什么'],
          [
            [
              'RoPE / relative positions',
              '改变 position 如何进入 Q/K；不取消 position problem',
            ],
            [
              'weight tying',
              '共享 token embedding 与 LM-head weights；不改变 logits interface',
            ],
            [
              'Flash Attention',
              '改变 efficient implementation/resource usage；不改 attention mathematics',
            ],
            ['KV cache', 'generation 重用 past K/V；不改变 causal permissions'],
            [
              'padding / masking details',
              '处理 variable-length batches；不等于 causal mask 的目的',
            ],
            [
              'gated FFNs / other norms',
              '替换 local branch variant；仍需回到 [B,T,C]',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{cache}_t=\{K_{\le t},V_{\le t}\}`,
          'A KV cache retains keys and values from permitted past positions for later generation steps.',
        ),
        paragraph(
          'cache 下一步是在每 layer 追加一个 position，而不重新算 earlier K/V；逻辑上的 causal attention output 仍只可读取 allowed prefix。RoPE 与 learned absolute table 是 alternative position strategies，不要求同时使用。',
        ),
      ],
      [
        '实现优化不是新的 model objective。',
        '没有高级术语能替代 decoder-only generation 的 causal mask。',
      ],
      check('KV cache 会改变 causal mask 允许哪些 prior tokens 吗？', [
        paragraph(
          '不会；它只复用已经计算好的、原本允许的 keys/values 以加速 repeated generation。',
        ),
      ]),
    ),
    section(
      'o0316-18-week-8-7',
      '18. Week 8 最应该理解的 7 件事',
      '组件名称很多，若没有一个 compact mental model，容易把它们记成不相连的术语。',
      [
        '用恰好七个相连断言复盘固定 A/B example、shape contract 和 language-model interface。',
        '让 learner 能将 Attention、FFN、LayerNorm、residual 与 LM head 对应到不同职责。',
      ],
      [
        list(
          [
            'Token embedding 给 token identity；position embedding 给 location；两者相加后仍是 [B,T,C]。',
            'Causal multi-head Attention 是基础 block 中唯一跨 token positions 混合信息的操作。',
            'H=2、D=2 时，heads 是 [B,H,T,D]，concat 为 [B,T,4]，output projection 保持 [B,T,C]。',
            'FFN 将每个 [4] row 独立做同一 nonlinear [4]→[16]→[4] transformation。',
            '每个 residual add 合并两份 equal [B,T,C] tensors，并保留 identity information/gradient route。',
            'Pre-Norm 是 LN → branch → residual add，做两次；LayerNorm 统计一个 token row 的 features，不统计 batch rows。',
            'Blocks 以 [B,T,C]→[B,T,C] 堆叠；最终 LM head 得到 [B,T,V_vocab]，训练用 all positions，生成用 last position。',
          ],
          true,
        ),
        formula(
          String.raw`\operatorname{Concat}(\mathrm{head}_1,\mathrm{head}_2)\in\mathbb{R}^{B\times T\times(H D)}=\mathbb{R}^{2\times2\times4}`,
          'Concatenating two D=2 head outputs creates the model width C=4 before output projection.',
        ),
      ],
      [
        'recap 不是 disconnected term list；不能遗漏 attention versus FFN 或 training versus generation。',
        'attention weights 不是 vocabulary probabilities。',
      ],
      check(
        '把 Attention、FFN、LayerNorm、residual add 和 LM head 分别归类。',
        [
          paragraph(
            'Attention=cross-position mixing；FFN=per-token transformation；LayerNorm=per-token normalization；residual add=same-shape merge；LM head=vocabulary projection。',
          ),
        ],
      ),
    ),
    section(
      'o0317-19-week-8-week-9',
      '19. Week 8 → Week 9',
      '本周从预先给定 IDs 开始，容易掩盖真实文本必须先由 tokenizer 变成 [B,T] interface 的事实。',
      [
        '把 architecture loop 接回 raw text、tokenization、vocabulary IDs、training examples 与 batches。',
        '为 Week 9 的 character、word、byte、subword、tokenizer training 与 encoding 区分建立问题。',
      ],
      [
        chain([
          'raw text',
          'tokenizer-selected tokens',
          'vocabulary IDs [B,T]',
          'token + position embeddings [B,T,C]',
          'Transformer',
          'logits [B,T,V_vocab]',
        ]),
        formula(
          String.raw`\mathrm{text}\xrightarrow{\mathrm{tokenizer}}\mathrm{ids}\in\{0,\ldots,V_{\mathrm{vocab}}-1\}^{B\times T}`,
          'A tokenizer maps text to integer IDs that index the model vocabulary.',
        ),
        paragraph(
          '本周 [我,喜欢] 与 [猫,喜欢] 假定 tokenizer 已把 我、喜欢、猫 纳入同一 vocabulary。Week 9 会比较不同 segmentation choices，并区分 tokenizer training 与 encoding。保存的 model 与 tokenizer 必须共享 ID-to-token mapping；否则一个数值合法的 ID 也会指向错误 token。',
        ),
      ],
      [
        'token IDs 不跨 tokenizer 通用。',
        'position embeddings 不是 tokenizer 的 segmentation positions；shapes 不能修复缺失或不一致的 tokenization rule。',
      ],
      check('保存的 model 与 tokenizer 必须匹配什么？', [
        paragraph(
          'vocabulary/ID mapping 及其 preprocessing；embedding 和 LM-head rows 都按这些 IDs 索引。',
        ),
      ]),
    ),
  ],
};
