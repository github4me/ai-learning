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

const positionEmbeddingRows = [
  ['0', '[0.05, 0.10, -0.05, 0.00]'],
  ['1', '[-0.10, 0.00, 0.05, 0.10]'],
];

const fixedBatch =
  '固定教学 batch：Vocabulary 为 0=我、1=喜欢、2=AI、3=学习、4=猫，V_vocab=5；prompt A IDs=[[0,1]]（我 喜欢），prompt B IDs=[[4,1]]（猫 喜欢）；B=2、T=2、C=4、n_head=2、head_size=D=2。';

const blockShapeChain = [
  'ids [B,T] = [2,2]',
  'token embeddings [B,T,C] = [2,2,4] + position embeddings [T,C] = [2,4]',
  'residual_0 [2,2,4]',
  'residual_0 + Attention(LN1(residual_0)) → residual_after_attention [2,2,4]',
  'residual_after_attention + FFN(LN2(residual_after_attention)) → residual_after_ffn [2,2,4]',
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
  estimatedReadingMinutes: 135,
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
          '两条 Prompt 的 喜欢@1 在 Token+Position 后起点相同，但 Attention 能读取不同的第 0 行（我@0 或 猫@0），因此 residual_after_ffn[:,1,:] 可以不同；未经训练不能据此承诺某个续写。',
        ),
        formula(
          String.raw`r_0=E_{\mathrm{token}}(\mathrm{ids})+E_{\mathrm{pos}}(0{:}T),\quad r_A=r_0+\operatorname{Attention}(\operatorname{LN}_1(r_0)),\quad r_F=r_A+\operatorname{FFN}(\operatorname{LN}_2(r_A))`,
          'r0 is the initial residual stream; rA adds the pre-normalized attention update; rF adds the pre-normalized FFN update.',
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
          '没有 positional input 的 unmasked self-attention 对 permutation 是等变的。GPT 的固定 causal mask 绑定了 sequence indices，让 t=0 与 t=1 的可见前缀不同，因此不会对任意 token permutation 保持等变；它仍没有给模型一个可学习的“这是第 t 个位置”坐标。position embedding（或之后的 RoPE）显式补上这件事。',
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
        callout(
          '同一个 Token 放在不同位置会怎样？',
          [
            formula(
              String.raw`E_{\mathrm{token}}[\text{喜欢}]+P[0]=[0.60,0.30,-0.20,0.10]+[0.05,0.10,-0.05,0]=[0.65,0.40,-0.25,0.10]`,
              'The token 喜欢 at position zero receives the position-zero vector.',
            ),
            formula(
              String.raw`E_{\mathrm{token}}[\text{喜欢}]+P[1]=[0.60,0.30,-0.20,0.10]+[-0.10,0,0.05,0.10]=[0.50,0.30,-0.15,0.20]`,
              'The same token 喜欢 at position one receives a different position vector.',
            ),
            paragraph(
              'Token Embedding 仍负责“它是喜欢”，Position Embedding 则让进入第一个 Block 的向量同时携带“它位于哪里”。两者相加后不要求模型把它们重新拆开；训练只需要学会利用组合后的 Features。',
            ),
          ],
          'example',
        ),
        formula(
          String.raw`x[b,t,:]=E_{\mathrm{token}}[\mathrm{ids}[b,t]]+E_{\mathrm{pos}}[t]`,
          'Each token row adds the token embedding for its ID to the learned position vector for t.',
        ),
        paragraph(
          'position rows [T,C]=[2,4] 在 Batch Axis 上 Broadcast，故 Token Rows [2,2,4] + Position Rows [2,4] = residual_0 [2,2,4]。Learned Absolute Table 只为 configured context length 建行；out-of-range t 没有可查的 Row。RoPE 是之后的 relative-position alternative，不是省略基本问题的理由。',
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
          String.raw`\operatorname{FFN}(z)=\operatorname{GELU}(zW_1+b_1)W_2+b_2`,
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
        callout(
          '本周可手算的 4→16→4 教学参数',
          [
            paragraph(
              '为了让 16 个 Hidden Units 不遮住计算，本周只启用前四个 Units，其余十二个权重设为 0。真实 FFN 会学习全部稠密参数。',
            ),
            formula(
              String.raw`W_1=[I_4\;\;0_{4\times12}],\qquad W_2=\begin{bmatrix}0.25I_4\\0_{12\times4}\end{bmatrix},\qquad b_1=b_2=0`,
              'The sparse teaching matrices still perform a real four-to-sixteen-to-four FFN while keeping the arithmetic visible.',
            ),
            formula(
              String.raw`\operatorname{FFN}_{\mathrm{toy}}(z)=0.25\,\operatorname{GELU}(z)`,
              'Only the first four hidden units contribute under the teaching parameters.',
            ),
          ],
          'example',
        ),
        callout('只改一个权重，观察“混合特征”究竟是什么', [
          paragraph(
            '恒等矩阵让每个通道独立通过，适合核对数值，却看不出通道之间怎样组合。现在单独给 FFN 输入 z=[1,2,0,0]，其余设计不变，只把 W1[1,0] 从 0 改为 1。第一隐藏单元便从 z0 变成 z0+z1=3。',
          ),
          table(
            ['量', '原来 W1[1,0]=0', '改成 1 后'],
            [
              ['第一隐藏值（激活前）', '1', '1+2=3'],
              ['GELU 后', '约 0.841345', '约 2.995950'],
              ['第二层乘以 0.25 后的首个输出', '约 0.210336', '约 0.748988'],
            ],
          ),
          paragraph(
            '输出仍有四个数，但首个输出现在依赖两个输入特征了。这就是通道混合，不是 shape 变大本身带来的魔法。其他通道保持相同。这是独立控制变量实验，不替换后面完整 block 的固定权重。',
          ),
        ]),
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
          String.raw`(zW_1+b_1)W_2+b_2=z(W_1W_2)+(b_1W_2+b_2)`,
          'Without an activation, two affine transformations compose into one affine transformation.',
        ),
        formula(
          String.raw`\operatorname{GELU}(x)=x\Phi(x)=\frac{x}{2}\left(1+\operatorname{erf}\!\left(\frac{x}{\sqrt2}\right)\right)`,
          'GELU multiplies x by the standard-normal cumulative probability Phi of x.',
        ),
        table(
          ['输入 x', 'GELU(x) 约等于', '与 ReLU 的直观差别'],
          [
            ['−1', '−0.159', '负值没有被强制归零'],
            ['0', '0', '原点仍映射到零'],
            ['1', '0.841', '正值被平滑保留'],
            ['2', '1.955', '较大的正值接近原值'],
          ],
          'GELU 是连续的平滑非线性函数，不是一个二值开关。',
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
        code(
          'text',
          `Prompt A 最终位置在第二个 LayerNorm 后：
z = [1.2476, 0.2644, -1.5404, 0.0284]

教学 W1 的前四个 Hidden Pre-activations：
[1.2476, 0.2644, -1.5404, 0.0284]

GELU 后：
[1.1152, 0.1596, -0.0952, 0.0144]

再经教学 W2=0.25I：
FFN update = [0.2788, 0.0399, -0.0238, 0.0036]`,
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
          '对 Prompt A，令 a=Attention(LN1(residual_0))，则 residual_after_attention=residual_0+a；对 B，相同规则保留由 猫@0 带来的不同信息，同时加上 Contextual Update。分支处 Gradients 相加，呼应“paths multiply; branches add”，但这不是所有 Optimization Problems 的保证。',
        ),
        formula(
          String.raw`y=x+F(x),\qquad \frac{\partial y}{\partial x}=I+\frac{\partial F(x)}{\partial x}`,
          'A residual output combines an identity path with a learned update, and gradients have both routes.',
        ),
        table(
          ['term', 'shape in this lesson'],
          [
            ['residual_0', '[B,T,C]=[2,2,4]'],
            ['Attention(LN1(residual_0))', '[B,T,C]=[2,2,4]'],
            ['residual_after_attention', '[B,T,C]=[2,2,4]'],
            ['FFN(LN2(residual_after_attention))', '[B,T,C]=[2,2,4]'],
            ['residual_after_ffn', '[B,T,C]=[2,2,4]'],
          ],
        ),
        code(
          'text',
          `Prompt A 的最终“喜欢”位置：
residual_0      = [ 0.5000, 0.3000, -0.1500,  0.2000]
attention_update = [ 0.9944, 0.1092, -1.4326, -0.0512]

逐元素相加：
residual_after_attention
= [1.4944, 0.4092, -1.5826, 0.1488]`,
        ),
        paragraph(
          '这里的 Attention Update 将在第 10 节从 LN1、两个 Heads、Softmax Weights 和 Values 完整推导。Residual 不是覆盖旧向量，也不是 Concatenation；它把旧状态与分支提出的修改逐元素合并。',
        ),
      ],
      [
        'residual 不表示 F(x) 被丢弃，也不是 concatenation。',
        'identity route 有帮助不等于训练必然稳定。',
      ],
      check('Residual Output 的 Forward 中有哪两条贡献路径？', [
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
          `residual_0                                      [2,2,4]
Attention(LN1(residual_0))                    [2,2,4]
residual_after_attention                      [2,2,4]

FFN(LN2(residual_after_attention))            [2,2,4]
residual_after_ffn                            [2,2,4]`,
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
        code(
          'text',
          `先令 gamma=[1,1,1,1]、beta=[0,0,0,0]，忽略极小 epsilon 的显示误差：

x        = [1, 2, 3, 4]
mean     = (1+2+3+4) / 4 = 2.5
deviation = [-1.5, -0.5, 0.5, 1.5]
variance = (2.25+0.25+0.25+2.25) / 4 = 1.25
std      = sqrt(1.25) ≈ 1.118

normalized
= deviation / std
≈ [-1.342, -0.447, 0.447, 1.342]`,
        ),
        callout(
          '应用到本周真正的“喜欢@1”',
          [
            formula(
              String.raw`r_0=[0.50,0.30,-0.15,0.20],\qquad \mu=0.2125,\qquad \sigma^2=0.05546875`,
              'The actual final-token row has its own mean and population variance.',
            ),
            formula(
              String.raw`\operatorname{LN}_1(r_0)\approx[1.221,0.371,-1.539,-0.053]\quad(\gamma=1,\beta=0,\varepsilon=10^{-5})`,
              'The normalized final-token row used by the deterministic teaching attention.',
            ),
            paragraph(
              'Gamma 与 Beta 的常见初始化分别为 1 和 0，因此 LayerNorm 一开始接近纯标准化；训练后它们可以分别缩放和移动四个 Features，所以最终输出不必保持严格零均值或单位方差。',
            ),
          ],
          'example',
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
        callout('为什么要做这一步：先把尺度差异看见', [
          paragraph(
            '比较 x=[1,2,3,4] 和 100x+1000=[1100,1200,1300,1400]。它们相对高低的排列一样，但原始数值尺度不同。LayerNorm 让子层主要看到本行各特征相对均值的偏离，减少整体平移与放大的影响。',
          ),
          table(
            ['量', 'x', '100x+1000'],
            [
              ['均值', '2.5', '1250'],
              ['总体方差', '1.25', '12500'],
              [
                '标准化后（近似）',
                '[−1.342,−0.447,0.447,1.342]',
                '[−1.342,−0.447,0.447,1.342]',
              ],
            ],
          ),
          paragraph(
            '因为有 epsilon，两者不是逐位完全相等。标准化也不对每个任务都无损：整体偏移或尺度可能包含信息。Pre-Norm 的残差旁路仍传递原始 x，gamma/beta 允许训练调整归一化分支。控制输入尺度不是保证训练总会更快或 Loss 总下降。',
          ),
        ]),
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
        '采用 Pre-Norm：只 Normalize Branch Input，Raw Residual Stream 绕过 Norm 与 Branch。',
        '先计算 Attention Update，再用新的 Residual Stream 计算 Pre-Norm FFN Update。',
        '用同一组确定性教学参数把 Prompt A/B 从 residual_0 算到 Final LayerNorm。',
      ],
      [
        chain([
          'residual_0 [2,2,4] → LN1 → normalized_for_attention [2,2,4]',
          'causal MHA → attention_update [2,2,4]',
          'residual_0 + attention_update → residual_after_attention [2,2,4]',
          'LN2 → normalized_for_ffn [2,2,4]',
          'FFN 4→16→4 → ffn_update [2,2,4]',
          'residual_after_attention + ffn_update → residual_after_ffn [2,2,4]',
          'Final LayerNorm → h [2,2,4]',
        ]),
        formula(
          String.raw`r_A=r_0+\operatorname{Attention}(\operatorname{LN}_1(r_0)),\qquad r_F=r_A+\operatorname{FFN}(\operatorname{LN}_2(r_A))`,
          'Pre-Norm sends normalized tensors into each branch while the direct residual route carries the corresponding raw residual stream.',
        ),
        callout('先承接上一周，再看下面的两头手算', [
          paragraph(
            '运行 course_examples/week08_bridge.py。它导入 Week 7 的同一输入与 Q/K/V，先复现单头输出，再用明确的 [2,4] 投影恢复四通道。随后依次观察 LayerNorm 输入、Attention 分支、原始 x 的残差相加，以及 FFN 分支。',
          ),
          paragraph(
            '这个过渡实验用于看清同一变量在哪里保留、在哪里重算。下方两头 block 的数值表使用本节明确给出的另一组简化投影；不要把不同实验的数字接成同一次计算。它们共用同一条 Pre-Norm 顺序。',
          ),
        ]),
        paragraph(
          '教学 Attention 使用最容易审计的参数：Head 1 选择 normalized row 的 Channels 0–1，Head 2 选择 Channels 2–3；每个 Head 内 Q=K=V；W_O 使用 Identity。它仍执行真实的 QKᵀ、Scale、Mask、Softmax 与 Weighted Values，只是把 Projection 简化为 Channel Selection。',
        ),
        formula(
          String.raw`q^{(1)}=k^{(1)}=v^{(1)}=[z_0,z_1],\qquad q^{(2)}=k^{(2)}=v^{(2)}=[z_2,z_3],\qquad W_O=I_4`,
          'The two teaching heads select disjoint channel pairs from z=LN1(residual_0).',
        ),
        table(
          ['LN1 Row', 'Prompt A', 'Prompt B'],
          [
            [
              'Position 0',
              '[-0.2156,-1.2939,1.5095,0.0000]',
              '[-1.6731,0.6591,0.1521,0.8619]',
            ],
            [
              'Position 1: 喜欢',
              '[1.2206,0.3715,-1.5390,-0.0531]',
              '[1.2206,0.3715,-1.5390,-0.0531]',
            ],
          ],
          '最终“喜欢”的 LN1 Row 相同；两个 Prompt 的 Position 0 不同。',
        ),
        code(
          'text',
          `Prompt A、Head 1、最终 Query 的两次打分：
q = [1.2206, 0.3715]
k_我 = [-0.2156, -1.2939]
k_喜欢 = [1.2206, 0.3715]

score_我
= (1.2206×-0.2156 + 0.3715×-1.2939) / sqrt(2)
≈ -0.5260

score_喜欢
= (1.2206×1.2206 + 0.3715×0.3715) / sqrt(2)
≈ 1.1511

Softmax([-0.5260, 1.1511])
≈ [0.1575, 0.8425]`,
        ),
        table(
          [
            'Final Query',
            'Scaled Scores Head 1',
            'Weights Head 1',
            'Scaled Scores Head 2',
            'Weights Head 2',
          ],
          [
            [
              'Prompt A',
              '[-0.5260,1.1511]',
              '[0.1575,0.8425]',
              '[-1.6427,1.6768]',
              '[0.0349,0.9651]',
            ],
            [
              'Prompt B',
              '[-1.2709,1.1511]',
              '[0.0815,0.9185]',
              '[-0.1979,1.6768]',
              '[0.1330,0.8670]',
            ],
          ],
          '每个 Head 对两条可见 Positions 分别做 Row Softmax。不同 Position-0 Rows 使最终 Attention Weights 不同。',
        ),
        code(
          'text',
          `Prompt A 的 Values 就是各 Head 选出的 LN1 Channels：

Head 1 output
= 0.1575×[-0.2156,-1.2939] + 0.8425×[1.2206,0.3715]
≈ [0.9944, 0.1092]

Head 2 output
= 0.0349×[1.5095,0.0000] + 0.9651×[-1.5390,-0.0531]
≈ [-1.4326, -0.0512]

Concat 两个 Heads；教学 W_O=I_4：
attention_update ≈ [0.9944,0.1092,-1.4326,-0.0512]`,
        ),
        code(
          'text',
          `Prompt A final row
attention_update         = [ 0.9944, 0.1092, -1.4326, -0.0512]
residual_0               = [ 0.5000, 0.3000, -0.1500,  0.2000]
residual_after_attention = [ 1.4944, 0.4092, -1.5826,  0.1488]
LN2                      = [ 1.2476, 0.2644, -1.5404,  0.0284]
FFN update               = [ 0.2788, 0.0399, -0.0238,  0.0036]
residual_after_ffn       = [ 1.7732, 0.4492, -1.6064,  0.1524]
final LayerNorm h        = [ 1.3128, 0.2134, -1.4933, -0.0330]

Prompt B final row
attention_update         = [ 0.9847, 0.3949, -1.3141,  0.0686]
residual_0               = [ 0.5000, 0.3000, -0.1500,  0.2000]
residual_after_attention = [ 1.4847, 0.6949, -1.4641,  0.2686]
LN2                      = [ 1.1475, 0.4158, -1.5843,  0.0209]
FFN update               = [ 0.2508, 0.0687, -0.0224,  0.0027]
residual_after_ffn       = [ 1.7356, 0.7637, -1.4865,  0.2713]
final LayerNorm h        = [ 1.2100, 0.3787, -1.5462, -0.0425]`,
        ),
        paragraph(
          '两条 Prompt 的 residual_0 final row 起点完全相同；差异第一次出现在 Attention 读取不同 Position 0 之后，并继续穿过 Residual、LN2、FFN 与 Final LayerNorm。Pre-Norm 的直觉是 Branch 总能接收按 Row 校准的输入，而 Direct Residual Route 仍保留未被本次 LayerNorm 改写的状态和 Identity Gradient Path。',
        ),
      ],
      [
        'LN(x + Attention(x)) 是 Post-Norm form，不要叫 Pre-Norm。',
        '不要把 LN(x) 错作 direct residual term；它必须是 raw x。',
      ],
      check('r_A=r_0+Attention(LN1(r_0)) 中 Direct Residual Path 传递什么？', [
        paragraph(
          '原始的、Pre-LayerNorm residual_0，Shape 仍是 [B,T,C]=[2,2,4]。',
        ),
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
        callout(
          '先运行确定性教学版本，再看可训练版本',
          [
            paragraph(
              '第一段代码固定所有教学参数并复现第 10 节的数值；第二段代码才使用 nn.Linear、nn.LayerNorm 与随机初始化。两者承担不同任务，不能期待随机模型自动打印同一组结果。',
            ),
          ],
          'principle',
        ),
        code(
          'python',
          `import math

import torch
import torch.nn.functional as F


torch.set_printoptions(precision=4, sci_mode=False)

ids = torch.tensor([
    [0, 1],  # 我 喜欢
    [4, 1],  # 猫 喜欢
])

token_table = torch.tensor([
    [ 0.20, -0.10,  0.70,  0.30],  # 我
    [ 0.60,  0.30, -0.20,  0.10],  # 喜欢
    [-0.40,  0.80,  0.50, -0.30],  # AI
    [ 0.10,  0.20,  0.90,  0.40],  # 学习
    [-0.70,  0.40,  0.30,  0.60],  # 猫
])

position_table = torch.tensor([
    [ 0.05, 0.10, -0.05, 0.00],
    [-0.10, 0.00,  0.05, 0.10],
])

B, T = ids.shape
C, num_heads = 4, 2
head_size = C // num_heads

residual_0 = F.embedding(ids, token_table) + position_table[:T]

# Teaching LayerNorm: gamma=1, beta=0, epsilon=1e-5.
normalized_for_attention = F.layer_norm(
    residual_0,
    normalized_shape=(C,),
    eps=1e-5,
)

# Teaching Q/K/V projections:
# Head 1 selects channels 0:2; Head 2 selects channels 2:4.
heads = normalized_for_attention.view(B, T, num_heads, head_size)
heads = heads.transpose(1, 2)  # [B,H,T,D]
q = heads
k = heads
value_states = heads

scores = (q @ k.transpose(-2, -1)) / math.sqrt(head_size)
causal_mask = torch.tril(torch.ones(T, T, dtype=torch.bool))
masked_scores = scores.masked_fill(~causal_mask, float("-inf"))
attention_probs = F.softmax(masked_scores, dim=-1)

head_outputs = attention_probs @ value_states
attention_update = head_outputs.transpose(1, 2).contiguous().view(B, T, C)
# Teaching W_O is I_4, so the projection leaves attention_update unchanged.

residual_after_attention = residual_0 + attention_update
normalized_for_ffn = F.layer_norm(
    residual_after_attention,
    normalized_shape=(C,),
    eps=1e-5,
)

# Sparse teaching FFN:
# W1 copies four channels into the first four of sixteen hidden units.
hidden = torch.zeros(B, T, 4 * C)
hidden[..., :C] = normalized_for_ffn
hidden = F.gelu(hidden, approximate="none")

# W2 selects those four units and multiplies them by 0.25.
ffn_update = 0.25 * hidden[..., :C]
residual_after_ffn = residual_after_attention + ffn_update

final_hidden = F.layer_norm(
    residual_after_ffn,
    normalized_shape=(C,),
    eps=1e-5,
)

# Reuse Week 6's five candidate scoring rules.
W_out = torch.tensor([
    [1.0, 0.0,  0.0, 0.0],
    [0.0, 1.0,  2.0, 2.0],
    [0.0, 0.0,  1.0, 1.0],
    [0.0, 3.0, -1.0, 0.0],
    [1.0, 2.0,  0.0, 0.0],
])
bias = torch.tensor([-0.2, 0.1, 0.0, 0.0, 0.0])

logits = final_hidden @ W_out.T + bias
vocabulary_probs = F.softmax(logits, dim=-1)

print("final attention probabilities:", attention_probs[:, :, -1, :])
print("attention update:", attention_update[:, -1, :])
print("residual after attention:", residual_after_attention[:, -1, :])
print("FFN update:", ffn_update[:, -1, :])
print("final hidden:", final_hidden[:, -1, :])
print("final logits:", logits[:, -1, :])
print("final vocabulary probabilities:", vocabulary_probs[:, -1, :])`,
        ),
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
            raise ValueError("model_dim must be evenly divisible by num_heads")
        self.num_heads = num_heads
        self.head_size = model_dim // num_heads
        self.qkv = nn.Linear(model_dim, 3 * model_dim, bias=False)
        self.output = nn.Linear(model_dim, model_dim, bias=False)
        self.attention_dropout = nn.Dropout(dropout)
        self.output_dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        batch_size, time_steps, model_dim = x.shape
        q, k, value_states = self.qkv(x).chunk(3, dim=-1)
        q = q.view(
            batch_size, time_steps, self.num_heads, self.head_size
        ).transpose(1, 2)
        k = k.view(
            batch_size, time_steps, self.num_heads, self.head_size
        ).transpose(1, 2)
        value_states = value_states.view(
            batch_size, time_steps, self.num_heads, self.head_size
        ).transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_size)
        causal = torch.ones(time_steps, time_steps, device=x.device, dtype=torch.bool).tril()
        scores = scores.masked_fill(~causal, float("-inf"))

        attention_probs = F.softmax(scores, dim=-1)
        dropped_probs = self.attention_dropout(attention_probs)
        heads = dropped_probs @ value_states

        merged = heads.transpose(1, 2).contiguous().view(batch_size, time_steps, model_dim)
        return self.output_dropout(self.output(merged))


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

    def forward(self, residual: torch.Tensor) -> torch.Tensor:
        attention_update = self.attention(self.ln1(residual))
        residual_after_attention = residual + attention_update

        ffn_update = self.ffn(self.ln2(residual_after_attention))
        residual_after_ffn = residual_after_attention + ffn_update
        return residual_after_ffn


sample = torch.randn(2, 2, 4)
block = TransformerBlock(model_dim=4, num_heads=2, dropout=0.1)
block.eval()
output = block(sample)
print(output.shape)  # torch.Size([2, 2, 4])`,
        ),
        chain(multiHeadShapeChain),
        paragraph(
          'ln1/ln2 是 Per-Token [2,2,4] Normalization；Attention 跨 Positions Mixing 后回到 [2,2,4]；FFN 是 Per-Token 4→16→4。两个 Residual Add 都合并两份 [2,2,4]，第二次结果就是 Block Output。model.eval() 会关闭 Dropout，因此除 Sampling 外，同一输入的 Inference 是确定的。',
        ),
        callout(
          'Softmax Probability 与 Dropout 后计算权重必须分开命名',
          [
            paragraph(
              'attention_probs 是 Softmax 直接输出，每个 Query Row 加总为 1。训练时 dropped_probs 会随机将部分项归零，并按 1/(1-p) 缩放保留项，因此一次 Forward 中不再保证每行加总为 1；它只是用于训练正则化的计算权重。model.eval() 时两者相同。',
            ),
          ],
          'concept',
        ),
      ],
      [
        '不要在 identity residual path 上放这个 outline 的 dropout。',
        'FFN 不是第二个 attention layer；每个组件必须说明跨 position 或只在 row 内工作。',
        '只有 attention_probs 保证 Row Sum=1；训练模式下 dropped_probs 不保证。',
      ],
      check('哪两行含 residual add，它们输出什么 shape？', [
        paragraph(
          'residual + attention_update，以及 residual_after_attention + ffn_update；每一条都把两份 [2,2,4] 合并并输出 [B,T,C]=[2,2,4]。',
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
          'x^(0) = token + position embeddings [2,2,4]',
          'Block^(0)(x^(0)) → x^(1) contextual states [2,2,4]',
          'Block^(1)(x^(1)) → x^(2) richer contextual states [2,2,4]',
          'Final LayerNorm(x^(2)) → h [2,2,4]',
        ]),
        formula(
          String.raw`x^{(\ell+1)}=\operatorname{Block}^{(\ell)}(x^{(\ell)}),\qquad \ell=0,\ldots,L-1`,
          'Each layer maps the same external representation shape to itself using its own parameters.',
        ),
        paragraph(
          '每个 block 有自己的 LayerNorm、Q/K/V/output projections 和 FFN parameters，除非 architecture 明确 weight sharing。dropout 在 training 中可按 block 配置使用但不改变 shape。n_layer 是 blocks 数量，不是 n_head。',
        ),
        paragraph(
          'Pre-Norm Block 的每个 Branch Input 都被归一化，但两条 Direct Residual Routes 保留 Raw Residual Stream；堆叠结束后通常再使用 Final LayerNorm，为共享 LM Head 提供按 Row 校准的最终输入。Final LayerNorm 不是第三个 Residual Branch。',
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
          'Final LayerNorm 后，每个 Vocabulary Candidate 都有自己的一组四维 Scoring Weights。一个 Logit 使用当前 h Row 的全部四个 Features 做 Dot Product，再加该候选的 Bias；不是“四个 Features 分别对应五个 Scores”。',
        ),
        formula(
          String.raw`z_v=w_v\cdot h+b_v=\sum_{c=1}^{C}w_{v,c}h_c+b_v`,
          'Candidate v combines all C contextual features using its own scoring weights and bias.',
        ),
        table(
          ['候选 v', 'Week 6 沿用的 w_v', 'b_v'],
          [
            ['我', '[1,0,0,0]', '−0.2'],
            ['喜欢', '[0,1,2,2]', '0.1'],
            ['AI', '[0,0,1,1]', '0'],
            ['学习', '[0,3,−1,0]', '0'],
            ['猫', '[1,2,0,0]', '0'],
          ],
          '同一组教学 Output Head 同时处理 Prompt A 与 Prompt B 的每个位置。',
        ),
        code(
          'text',
          `Prompt A final hidden
h_A = [1.3128, 0.2134, -1.4933, -0.0330]

例如“学习”的 Logit：
z_学习 = [0,3,-1,0] · h_A + 0
       = 3(0.2134) - (-1.4933)
       ≈ 2.1336

全部 Logits [我,喜欢,AI,学习,猫]
z_A = [1.1128, -2.7390, -1.5262, 2.1336, 1.7397]

Prompt B final hidden
h_B = [1.2100, 0.3787, -1.5462, -0.0425]
z_B = [1.0100, -2.6987, -1.5887, 2.6821, 1.9674]`,
        ),
        formula(
          String.raw`W_{\mathrm{out}}\in\mathbb{R}^{V_{\mathrm{vocab}}\times C}=[5,4],\qquad \mathrm{logits}=H W_{\mathrm{out}}^{\mathsf T}+b`,
          'The shared output head maps every [C] contextual row to [V_vocab] raw scores.',
        ),
        table(
          [
            'Prompt final row',
            'Vocabulary Probabilities [我,喜欢,AI,学习,猫]',
            '最高候选',
          ],
          [
            ['A', '[0.1742,0.0037,0.0124,0.4835,0.3261]', '学习'],
            ['B', '[0.1108,0.0027,0.0082,0.5897,0.2886]', '学习'],
          ],
          '不同 Context 可以产生不同分布，即使这一次 Argmax 碰巧仍是同一个 Token。',
        ),
        table(
          ['quantity', 'shape'],
          [
            ['h', '[B,T,C]=[2,2,4]'],
            ['W_out', '[V_vocab,C]=[5,4]'],
            ['b_vocab', '[V_vocab]=[5]'],
            ['logits', '[B,T,V_vocab]=[2,2,5]'],
          ],
        ),
        paragraph(
          '训练时 LM Head 对所有 Positions 运行，以便同时形成 B×T 道下一词分类题；生成当前轮只消费 logits[:,−1,:]。Logits 是 Raw Scores，Vocabulary Softmax 才把它们转成概率。',
        ),
      ],
      [
        'logits 不是 probabilities，C 不必等于 V_vocab。',
        'LM head 对每个已有 position 运行，不只对 last position 运行。',
      ],
      check('为什么 [2,2,4] 会成为 [2,2,5]？', [
        paragraph(
          '每个四维 h Row 与五行候选 Scoring Weights 分别做 Dot Product，等价于 H@[5,4]ᵀ，得到五个 Raw Scores。',
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
residual_0 = token + position                 [2,2,4]
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
        code(
          'python',
          `class MiniGPT(nn.Module):
    def __init__(
        self,
        vocab_size: int,
        context_length: int,
        model_dim: int,
        num_heads: int,
        num_layers: int,
        dropout: float,
    ):
        super().__init__()
        self.context_length = context_length
        self.token_embedding = nn.Embedding(vocab_size, model_dim)
        self.position_embedding = nn.Embedding(context_length, model_dim)
        self.blocks = nn.ModuleList([
            TransformerBlock(model_dim, num_heads, dropout)
            for _ in range(num_layers)
        ])
        self.final_norm = nn.LayerNorm(model_dim)
        self.lm_head = nn.Linear(model_dim, vocab_size)

    def forward(
        self,
        token_ids: torch.Tensor,
        targets: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        B, T = token_ids.shape
        if T > self.context_length:
            raise ValueError("Sequence length exceeds context_length")

        positions = torch.arange(T, device=token_ids.device)
        residual = (
            self.token_embedding(token_ids)
            + self.position_embedding(positions)
        )

        for block in self.blocks:
            residual = block(residual)

        final_hidden = self.final_norm(residual)
        logits = self.lm_head(final_hidden)

        if targets is None:
            return logits, None

        loss = F.cross_entropy(
            logits.reshape(B * T, logits.size(-1)),
            targets.reshape(B * T),
        )
        return logits, loss


model = MiniGPT(
    vocab_size=5,
    context_length=8,
    model_dim=4,
    num_heads=2,
    num_layers=2,
    dropout=0.1,
)

inputs = torch.tensor([
    [0, 1],  # 我 喜欢
    [4, 1],  # 猫 喜欢
])
targets = torch.tensor([
    [1, 2],  # 喜欢 AI
    [1, 3],  # 喜欢 学习
])

logits, loss = model(inputs, targets)
print(logits.shape)  # torch.Size([2, 2, 5])
print(loss.shape)    # torch.Size([])`,
        ),
        callout(
          '为什么这段代码不会打印教学示例的固定 Logits？',
          [
            paragraph(
              'MiniGPT 使用随机初始化的可学习参数，职责是展示真实训练接口；第 11 节第一段代码使用固定稀疏参数，职责是精确复现数学。随机模型必须经 Loss、Backpropagation 与 Optimizer 训练后，参数才会形成有用路由。',
            ),
          ],
          'concept',
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
