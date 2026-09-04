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

const code = (
  language: string,
  value: string,
  filename?: string,
): CuratedBodyBlock => ({
  type: 'code',
  language,
  code: value,
  ...(filename ? { filename } : {}),
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

const fixedDimensions =
  '本周固定 mini-gpt-v1：B=2 是 batch 行数，T=2 是当前 token 位置数，C=4 是每个位置的表示宽度，H=2 是 attention head 数，d_head=C/H=2 是每个 head 的宽度，V=5 是候选 token 数，n_layer=2 是 Transformer block 数。L 只保留给 token stream 或生成历史长度，绝不用作层数。';

const fixedBatchRows = [
  ['b=0', '[0,1]', '[我, 喜欢]', '[1,2]', '[喜欢, AI]'],
  ['b=1', '[4,1]', '[猫, 喜欢]', '[1,0]', '[喜欢, 我]'],
];

export const week10Revision: CuratedWeekRevision = {
  weekSlug: 'week-10',
  title: 'Week 10 - GPT Architecture：把最小语言模型组装成可训练的 Mini GPT',
  keyQuestion:
    '怎样把 Weeks 6–9 的 token、Attention、Transformer 与 tokenizer 接口组装成一个可训练、可保存、可生成的 MiniGPT？',
  objectives: [
    '用唯一的 GPTConfig 解释 Vocabulary、context、width、head divisibility 与 depth 约束。',
    '沿 [2,2] → [2,2,4] → 两个 pre-norm Blocks → [2,2,5] 追踪完整 forward。',
    '认清每个 parameter、buffer 与 temporary activation 的 owner，并手算 canonical untied 模型的 520 个参数。',
    '实现并检查稳定的 forward、state-dict/checkpoint 与外部 generation 边界，为 Week 11 的训练循环做准备。',
  ],
  estimatedReadingMinutes: 85,
  sections: [
    section(
      'o0351-week-10',
      'Week 10 核心目标：把零件接成一个稳定接口',
      'Weeks 6–9 已分别介绍 next-token loss、Attention、Transformer block 与 tokenizer；如果不知道谁拥有每个对象、哪些 shapes 可以相接，零件仍不能组成一个可靠模型。',
      [
        '把已知组件装进一个注册完整的 nn.Module，同时保持语言模型的 logits 与 loss 接口不变。',
        '从第一节就固定 tokenizer、batch、维度和训练/生成分工，让后续每个 class 都能回到同一条 trace。',
      ],
      [
        paragraph(
          'mini-gpt-v1 按空格切分，ordered tokens 固定为 [我, 喜欢, AI, 学习, 猫]，IDs 固定为 0..4；它没有 BOS、EOS、PAD 或 UNK。Week 9 的 V=11、T=4 教学 artifact 已经结束，不能把那里的整数直接送入本模型。',
        ),
        table(['ID', 'ordered token'], vocabularyRows, 'mini-gpt-v1，V=5'),
        paragraph(fixedDimensions),
        table(
          [
            'batch row',
            'idx IDs',
            'input tokens',
            'target IDs',
            '四道 teacher-forced 题',
          ],
          fixedBatchRows,
          'idx=[[0,1],[4,1]]，targets=[[1,2],[1,0]]；两者都是 torch.long [B,T]=[2,2]',
        ),
        code(
          'python',
          `import torch


idx = torch.tensor([
    [0, 1],  # 我 喜欢
    [4, 1],  # 猫 喜欢
], dtype=torch.long)  # [B,T] = [2,2]

targets = torch.tensor([
    [1, 2],  # 我→喜欢，喜欢→AI
    [1, 0],  # 猫→喜欢，喜欢→我
], dtype=torch.long)  # [B,T] = [2,2]`,
          'mini_gpt_walkthrough.py',
        ),
        chain([
          'mini-gpt-v1 IDs [B,T] = [2,2]',
          'token + position representations [B,T,C] = [2,2,4]',
          'pre-norm Block 1 [2,2,4]',
          'pre-norm Block 2 [2,2,4]',
          'final LayerNorm [2,2,4]',
          'bias-free LM head logits [B,T,V] = [2,2,5]',
          'optional reshape [4,5] with targets [4] → scalar mean cross-entropy',
        ]),
        table(
          ['caller mode', 'forward input', 'forward output', 'caller consumes'],
          [
            [
              'training / evaluation',
              'idx [2,2] + targets [2,2]',
              'logits [2,2,5] + scalar loss',
              'all four aligned positions',
            ],
            [
              'generation',
              'cropped context, no targets',
              'logits [B,T,5] + None',
              'only logits[:,-1,:] for one append',
            ],
          ],
        ),
      ],
      [
        'Architecture 定义 forward map，不等于 optimizer training loop。',
        'Logits 是未归一化分数，不是 probabilities 或事实。',
        '两个 Blocks 都保留 T=2 与 C=4；它们不会自行追加 token。',
        '只有 generation caller 的当前轮读取最后位置，训练仍监督全部 B×T 个位置。',
      ],
      check('idx 是 [2,2] 时，logits 与 flattened targets 分别是什么 shape？', [
        paragraph(
          'logits 是 [B,T,V]=[2,2,5]；targets 按同一顺序展平后是 [B×T]=[4]。',
        ),
      ]),
    ),
    section(
      'o0352-1-configuration',
      '1. 先定义 Configuration：把数字变成架构合同',
      '如果 embeddings、norms、projections 与 heads 到处重复匿名数字 4，就无法判断它们是否表达同一宽度，也无法从 checkpoint 精确重建模型。',
      [
        '用一个 immutable GPTConfig 集中声明全部 shape/depth 决策，而不是把它误当 learned parameters。',
        '把 common imports 放在所有依赖 class 之前，使本周代码按展示顺序组合后可以执行。',
      ],
      [
        paragraph(
          'Configuration 回答“要建什么”；nn.Parameter 回答“训练会改变哪些数”。frozen=True 只阻止意外改写 config fields，并不会冻结模型参数。本最小架构刻意没有 dropout field。',
        ),
        code(
          'python',
          `import hashlib
import json
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass(frozen=True)
class GPTConfig:
    vocab_size: int = 5
    block_size: int = 2
    n_embd: int = 4
    n_head: int = 2
    n_layer: int = 2

    def validate(self) -> None:
        if self.vocab_size <= 0:
            raise ValueError("vocab_size must be positive")
        if self.block_size <= 0:
            raise ValueError("block_size must be positive")
        if self.n_embd <= 0:
            raise ValueError("n_embd must be positive")
        if self.n_head <= 0:
            raise ValueError("n_head must be positive")
        if self.n_layer <= 0:
            raise ValueError("n_layer must be positive")
        if self.n_embd % self.n_head != 0:
            raise ValueError("n_embd must be divisible by n_head")`,
          'mini_gpt_walkthrough.py',
        ),
        table(
          ['field / value', '它防止的失败或歧义', 'concrete owners'],
          [
            [
              'vocab_size=5',
              '输入 ID / 输出 class 没有合法范围',
              'token_embedding rows 与 lm_head outputs',
            ],
            [
              'block_size=2',
              '最大 context、position rows、mask 与 generation crop 不一致',
              'position_embedding、causal_mask、caller crop',
            ],
            [
              'n_embd=4',
              '组件的 representation width 不一致',
              '两种 embeddings、norms、attention、FFN、lm_head input',
            ],
            [
              'n_head=2',
              'multi-head 没有可执行的 width partition',
              'qkv reshape 与 score head axis',
            ],
            [
              'n_layer=2',
              'block depth/order 含糊或重复模块未注册',
              'ModuleList construction 与 forward loop',
            ],
          ],
        ),
        formula(
          String.raw`d_{\mathrm{head}}=\frac{n_{\mathrm{embd}}}{n_{\mathrm{head}}}=\frac{4}{2}=2`,
          '每个 head 得到两个 channels；两个 heads 合并后回到 C=4。',
        ),
        paragraph(
          '这份合同要求 token_embedding.weight 为 [5,4]、position_embedding.weight 为 [2,4]，并让 lm_head 把最后一维 4 映射为 5 个候选 scores。它也会原样进入 checkpoint compatibility metadata。',
        ),
      ],
      [
        'config values 不由 optimizer 更新，也不是 gradients。',
        '总参数数相同的两个 config 仍可能有不同 keys、shapes 或 forward semantics。',
        '不要混回 context_length、model_dim 等旧示意名称；canonical names 是 block_size 与 n_embd。',
        '本配置没有未被使用的 dropout field。',
      ],
      check(
        '哪个 config field 同时决定 position table 行数、causal mask 边长和 generation crop？',
        [
          paragraph(
            'block_size=2；它定义一次 forward 最多接收两个 token positions。',
          ),
        ],
      ),
    ),
    section(
      'o0354-2-configuration',
      '2. Configuration 的关键约束：让错误尽早发生',
      '一组数字看似合理，也可能无法均分 heads，或让空序列、过长序列和非法 IDs 在 embedding/view 深处才以晦涩错误爆炸。',
      [
        '在 construction 与 forward API 边界验证可解释的约束。',
        '区分 block_size 的“最大值”和当前 T 的“实际值”：T=1 或 2 合法，T=3 不合法。',
      ],
      [
        paragraph(
          'C=n_embd=4 是每个 block 的共同宽度，H=n_head=2 是 head 数，所以 4 mod 2=0 且 d_head=2。反例 n_embd=4、n_head=3 没有整数 head width，必须在 config.validate() 阶段拒绝，而不是等 view 失败。',
        ),
        formula(
          String.raw`C\bmod H=0,\qquad d_{\mathrm{head}}=\frac{C}{H},\qquad 1\le T\le \mathrm{block\_size}`,
          'representation width 必须整除 head 数；当前非空 sequence length 最多为 block_size。',
        ),
        table(
          ['input / config', '结果', '尽早报告的原因'],
          [
            [
              'n_embd=4, n_head=2',
              '合法：d_head=2',
              '[B,T,4] 可重组为 [B,H,T,d_head]',
            ],
            [
              'n_embd=4, n_head=3',
              'ValueError',
              '四个 channels 无法均分成三个整数宽度 heads',
            ],
            [
              'idx shape [B,1] 或 [B,2]',
              '合法',
              'block_size 是上限，不要求每次填满',
            ],
            [
              'idx shape [B,0] 或 [B,3]',
              'ValueError',
              '空序列无最后位置；T=3 超出 position/mask capacity',
            ],
            [
              'float IDs 或 ID=5',
              'TypeError / ValueError',
              'embedding 只接受 torch.long 且地址范围为 0..4',
            ],
          ],
        ),
        code(
          'python',
          `config = GPTConfig()
config.validate()
assert config.n_embd // config.n_head == 2

try:
    GPTConfig(n_head=3).validate()
except ValueError as error:
    print(error)  # n_embd must be divisible by n_head`,
        ),
        paragraph(
          '完整 MiniGPT.forward 会先检查 rank 与 dtype，再读取 B、T；在任何 min/max 之前先拒绝 empty tensor，随后检查 ID range。targets 也必须与 idx 同 shape、同为 torch.long 且 IDs 在 0..4。第 7 节会把这些条件写进 canonical class。',
        ),
      ],
      [
        'block_size 不是 Vocabulary size；一个限制 positions，另一个限制 token IDs。',
        '增加 n_layer 不会修复无法整除的 head width。',
        'idx 是 integer addresses [B,T]，不是 embedding vectors [B,T,C] 或 float logits。',
        '对 empty tensor 直接调用 min()/max() 会先产生另一个错误，所以必须先检查 numel()。',
      ],
      check('为什么 [B,2,4] 可拆成两个 heads，却不能拆成三个等宽 heads？', [
        paragraph(
          '因为 C=4、H=2 时 d_head=C/H=2 是整数；H=3 时 4/3 不能形成等宽 integer channels。',
        ),
      ]),
    ),
    section(
      'o0355-3-gpt',
      '3. GPT 的顶层数据流：先定位 Owner，再读 Class',
      '一开始就抄完整 class 容易让 learner 看见很多 lines，却不知道输入、position、blocks、loss 与 generation decision 分别归谁负责。',
      [
        '在 class 之前建立一张 ownership map，并固定 forward(idx, targets=None) 的单一合同。',
        '把 training 与 inference 的分叉放在 targets 是否存在，而不让 forward 自行 backward、step 或 sampling。',
      ],
      [
        paragraph(
          'MiniGPT.forward 总会计算 logits。training/evaluation caller 提供 aligned targets 时，它额外返回 scalar mean cross-entropy；generation caller 不提供 targets，只消费 logits。forward 是神经网络映射，不在内部改变 optimizer，也不挑选 next token。',
        ),
        table(
          ['owner', 'input', 'output / responsibility'],
          [
            [
              'caller',
              'idx [2,2]，可选 targets [2,2]',
              '决定是 training/evaluation 还是 generation use',
            ],
            ['token_embedding', 'IDs 0..4', 'identity representations [2,2,4]'],
            [
              'position_embedding',
              'positions [2]',
              'position rows [2,4]，沿 B broadcast',
            ],
            [
              'blocks[0] 与 blocks[1]',
              '[2,2,4]',
              '依序产生 contextual [2,2,4]',
            ],
            ['final_norm + lm_head', '[2,2,4]', '每个位置的 logits [2,2,5]'],
            [
              'loss branch',
              'logits + aligned targets',
              '仅 targets 存在时得到 scalar mean CE',
            ],
            [
              'generation caller',
              '最后位置 logits [B,5]',
              '在 forward 外选择并 append next_id [B,1]',
            ],
          ],
        ),
        chain([
          'idx [2,2]',
          'token rows [2,2,4] + position rows [2,4] broadcast',
          'blocks[0] [2,2,4]',
          'blocks[1] [2,2,4]',
          'final_norm [2,2,4]',
          'lm_head logits [2,2,5]',
          'targets present? reshape logits [4,5] and targets [4] → mean loss []',
        ]),
        formula(
          String.raw`\mathrm{logits}=f_{\theta}(\mathrm{idx})\in\mathbb{R}^{B\times T\times V}`,
          '无论 caller 是否提供 targets，forward 都返回每个 batch/time 位置的五个 raw scores。',
        ),
        formula(
          String.raw`\mathcal{L}=\operatorname{CE}\!\left(\operatorname{reshape}(\mathrm{logits},[BT,V]),\operatorname{reshape}(\mathrm{targets},[BT])\right)`,
          '只有 targets 存在时，同样的 batch-major/time-major reshape 顺序保留四个 logit row 与四个 target ID 的对齐。',
        ),
      ],
      [
        'targets 可选不表示 supervised training 时 labels 可省略。',
        'forward 不调用 backward()、optimizer.step()、argmax() 或 multinomial()。',
        '不要只返回最后位置 logits；training 需要全部 [B,T,V]。',
        'idx 与 targets 的 [b,t] 必须描述同一个 next-token task。',
      ],
      check(
        'training 和 generation 都一定得到哪个输出？哪个输出只在 targets 存在时得到？',
        [
          paragraph(
            '两者都得到 logits；只有提供 targets 时才额外得到 scalar mean loss。',
          ),
        ],
      ),
    ),
    section(
      'o0357-4-causal-self-attention-class',
      '4. Causal Self-Attention：用 Combined QKV 重实现同一操作',
      '在最终“喜欢”位置，模型需要能读取先前的“我”或“猫”，同时绝不能读取当前 query 右侧尚未生成的 token。',
      [
        '用两 heads 的 causal routing 保持 [B,T,C] 输入输出接口。',
        '明确它是 Week 7 因果操作的 reimplementation / combined-QKV organization，而不是可直接拼接的旧 AttentionHead class。',
      ],
      [
        paragraph(
          'Q 表示当前 query 要找什么，K 表示每个可见位置如何被匹配，Value 表示匹配后带回什么。Week 7 为单个 head 展示三条独立 projections；这里用一个 bias-free qkv Linear 一次产生三份宽度 C 的 tensors，再显式增加 H 轴。数学工作相同，class organization 与 state-dict keys 不同。',
        ),
        code(
          'python',
          `class CausalSelfAttention(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.n_head = config.n_head
        self.head_size = config.n_embd // config.n_head
        self.qkv = nn.Linear(
            config.n_embd,
            3 * config.n_embd,
            bias=False,
        )
        self.output_projection = nn.Linear(
            config.n_embd,
            config.n_embd,
        )
        mask = torch.tril(
            torch.ones(config.block_size, config.block_size)
        )
        self.register_buffer(
            "causal_mask",
            mask.view(1, 1, config.block_size, config.block_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        q, k, value_states = self.qkv(x).chunk(3, dim=-1)
        q = q.view(B, T, self.n_head, self.head_size).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_size).transpose(1, 2)
        value_states = value_states.view(
            B,
            T,
            self.n_head,
            self.head_size,
        ).transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) * (self.head_size ** -0.5)
        visible = self.causal_mask[:, :, :T, :T]
        scores = scores.masked_fill(visible == 0, float("-inf"))
        weights = F.softmax(scores, dim=-1)
        output = weights @ value_states
        output = output.transpose(1, 2).contiguous().view(B, T, C)
        return self.output_projection(output)`,
          'mini_gpt_walkthrough.py',
        ),
        chain([
          'x [B,T,C] = [2,2,4]',
          'qkv(x) [2,2,12]',
          'chunk → q, k, value_states each [2,2,4]',
          'reshape + transpose → each [B,H,T,d_head] = [2,2,2,2]',
          'scores / weights [B,H,T,T] = [2,2,2,2]',
          'weighted Values [2,2,2,2]',
          'transpose + contiguous + view [2,2,4]',
          'biased output_projection [2,2,4]',
        ]),
        table(
          [
            'causal_mask row=query / column=key',
            'j=0: first token',
            'j=1: second token',
          ],
          [
            ['t=0: first query', '1 allow', '0 forbid'],
            ['t=1: final 喜欢 query', '1 allow', '1 allow'],
          ],
          '每个 batch row 与每个 head 共享 [[1,0],[1,1]]；runtime T=1 时 slice 为 [1,1,1,1]',
        ),
        formula(
          String.raw`A=\operatorname{softmax}\!\left(\frac{QK^{\top}}{\sqrt{d_{\mathrm{head}}}}+M\right),\qquad \operatorname{Attention}(X)=A\,\mathrm{ValueStates}`,
          'M 在 future columns 放负无穷；Softmax 沿 key-position 最后一维做，再用 weights 汇总 Values。',
        ),
        paragraph(
          'register_buffer 让 causal_mask 随 model.to(device)、state_dict 与 module traversal 一起管理，却不会被 optimizer 更新。最终 喜欢 的 query 可读取 position 0：第一行读到 我，第二行读到 猫，因此 contextual outputs 可能不同；随机 weights 并不保证某个具体预测。',
        ),
      ],
      [
        '先 mask 再 Softmax；把 forbidden weight 在 Softmax 后置零会破坏 row normalization。',
        'Softmax 沿 key columns dim=-1，不跨 query rows、heads 或 batch。',
        '普通 Tensor attribute 不会自动得到 registered-buffer 的 device/state behavior。',
        '必须按 runtime T 切 causal_mask；T=1 也是合法 context。',
        'Attention 提供信息通路，不保证理解或事实正确。',
      ],
      check('query position 0 的哪些 key columns 可以有非零 weight？为什么？', [
        paragraph(
          '只有 column 0；causal mask 在 Softmax 前把未来 column 1 屏蔽为负无穷。',
        ),
      ]),
    ),
    section(
      'o0358-5-heads-shape',
      '5. 拆分 Heads 时的 Shape：数字相同也要读 Axis',
      '本例 B、T、H 与 d_head 都等于 2，错误的 transpose 可能仍显示一串 2，却已经把 head axis 和 token-position axis 混在一起。',
      [
        '逐步说明 view 只重组 C，而 transpose 把 H 移到独立矩阵乘法所需的位置。',
        '追踪 score 的两个 T axes 与 head outputs 如何重新合并为 C=4。',
      ],
      [
        paragraph(fixedDimensions),
        table(
          ['stage', 'shape with named axes', 'operation meaning'],
          [
            [
              'q after chunk',
              '[B,T,C]=[2,2,4]',
              '每个 token row 有四个 q channels',
            ],
            [
              'q.view',
              '[B,T,H,d_head]=[2,2,2,2]',
              '把 C=4 分组为 2×2，不改变元素数',
            ],
            [
              'q.transpose(1,2)',
              '[B,H,T,d_head]=[2,2,2,2]',
              '每个 head 获得自己的 T×d_head matrix',
            ],
            [
              'q @ kᵀ',
              '[B,H,T,T]=[2,2,2,2]',
              '第三轴为 query t，第四轴为 key j',
            ],
            [
              'weights @ Values',
              '[B,H,T,d_head]=[2,2,2,2]',
              '每个 query 得到两个 head features',
            ],
            [
              'transpose back',
              '[B,T,H,d_head]=[2,2,2,2]',
              '把 token position 放回 head 之前',
            ],
            [
              'contiguous().view',
              '[B,T,C]=[2,2,4]',
              '在 feature axis 合并 H×d_head',
            ],
          ],
          '数值 shape 多次相同，语义 axis order 不同',
        ),
        formula(
          String.raw`Q_{b,h}\in\mathbb{R}^{T\times d_{\mathrm{head}}},\qquad Q_{b,h}K_{b,h}^{\top}\in\mathbb{R}^{T\times T}`,
          '固定一个 batch row b 与 head h 后，每个 query position 与每个 key position 比较。',
        ),
        formula(
          String.raw`H\,d_{\mathrm{head}}=2\cdot2=C=4`,
          '两组各两个 features 在 rejoin 后恢复 residual path 所需的 C=4。',
        ),
        paragraph(
          'transpose 改变 stride/layout，不复制数学元素；随后若用 view 假定 features 在内存中相邻，就先调用 contiguous()。reshape 有时会自行复制，但这里显式 contiguous().view 让 rejoin 意图可见。',
        ),
      ],
      [
        'view 必须保持总元素数，不能凭空创建或删除 channels。',
        '不要因 T=H=2 就把 [B,T,H,d_head] 与 [B,H,T,d_head] 当作同一语义。',
        '每个 head 只得到 d_head=2，不是完整 C=4。',
        '遗漏 transpose 或 rejoin 可能仍运行，却让错误 axes 参与矩阵乘法。',
      ],
      check('计算 scores 前 q 的语义 axis order 是什么？', [
        paragraph(
          '[B,H,T,d_head]；不是 [B,T,H,d_head]，第三轴必须是 query positions。',
        ),
      ]),
    ),
    section(
      'o0360-6-feedforward-block',
      '6. FeedForward 与 Block：通信之后逐位置计算',
      'Attention 能跨可见 positions 搬运信息，却没有独自提供逐 token 的 nonlinear transformation，也没有让深层网络保留旧表示的直接路径。',
      [
        '把 causal Attention、per-token FFN、两次 LayerNorm 与两条 residual paths 组成一个 pre-norm block。',
        '保持每个 branch 的外部 shape 都是 [B,T,C]，使两个独立参数的 blocks 可以顺序堆叠。',
      ],
      [
        paragraph(
          'Attention 是 cross-position communication：喜欢@1 可以读取 我@0 或 猫@0。FFN 则对每个 x[b,t,:] 单独应用同一函数，不直接读取另一行。Pre-Norm 先规范 branch input，再把 branch update 加回未经该 norm 替换的 residual state。',
        ),
        code(
          'python',
          `class FeedForward(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(config.n_embd, 4 * config.n_embd),
            nn.GELU(),
            nn.Linear(4 * config.n_embd, config.n_embd),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class TransformerBlock(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(config.n_embd)
        self.attention = CausalSelfAttention(config)
        self.ln2 = nn.LayerNorm(config.n_embd)
        self.feed_forward = FeedForward(config)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.ln1(x))
        x = x + self.feed_forward(self.ln2(x))
        return x`,
          'mini_gpt_walkthrough.py',
        ),
        chain([
          'x0 [2,2,4]',
          'ln1(x0) [2,2,4] → attention [2,2,4]',
          'x1 = x0 + attention update [2,2,4]',
          'ln2(x1) [2,2,4] → FFN [2,2,4] through 4→16→4',
          'x2 = x1 + FFN update [2,2,4]',
          '第二个独立 TransformerBlock 重复同一 shape contract',
        ]),
        formula(
          String.raw`x' = x+\operatorname{Attention}(\operatorname{LN}_1(x)),\qquad x_{\mathrm{out}}=x'+\operatorname{FFN}(\operatorname{LN}_2(x'))`,
          '这是两次 pre-norm branch update；每次 residual add 的两侧 shape 都是 [B,T,C]。',
        ),
        formula(
          String.raw`\operatorname{FFN}(u)=W_2\,\operatorname{GELU}(W_1u+b_1)+b_2`,
          '按 nn.Linear 的存储方向，第一层 weight 是 [4C,C]=[16,4]、bias [16]；第二层 weight 是 [C,4C]=[4,16]、bias [4]。',
        ),
        table(
          ['sublayer', 'mixes positions?', 'input → internal → output'],
          [
            [
              'causal attention',
              '是，只读 j≤t',
              '[2,2,4] → scores [2,2,2,2] → [2,2,4]',
            ],
            [
              'feed_forward',
              '否，每个 [b,t] 独立',
              '[2,2,4] → [2,2,16] → [2,2,4]',
            ],
            ['residual add', '否，逐元素相加', '[2,2,4] + [2,2,4] → [2,2,4]'],
          ],
        ),
      ],
      [
        'FFN 不会直接把 position 0 混入 position 1；这条通路属于 attention。',
        '本实现是 pre-norm，不要把 norm 放到 residual add 之后再称作同一结构。',
        'Residual 是 addition，不是 concatenation。',
        '两个 blocks 的 shape 相同，但各自拥有独立 learned weights。',
        'nn.Linear 默认 bias=True，因此 attention output_projection 与两个 FFN linears 都有 bias。',
      ],
      check(
        '哪个 sublayer 能让 喜欢@1 使用 position 0，哪个只处理 喜欢@1 已有的 row？',
        [
          paragraph(
            'causal attention 可以跨可见 positions 读取；feed_forward 只对该位置的四个 channels 做 4→16→4 nonlinear transformation。',
          ),
        ],
      ),
    ),
    section(
      'o0361-7-gpt-model',
      '7. 完整 MiniGPT：稳定 Names、Validation 与 Forward',
      '组件已经各自成立，但若顶层 class 没有统一 registration、initialization、input validation 与 optional-loss contract，checkpoint 和 caller 仍无法可靠依赖它。',
      [
        '用稳定 member names 组装 token_embedding、position_embedding、blocks、final_norm 与 lm_head。',
        '在任何 embedding/min/max 之前完整验证 idx 与 targets，并保留 _init_weights。',
      ],
      [
        paragraph(
          '以下代码继续使用前面已定义的 imports、GPTConfig、CausalSelfAttention、FeedForward 与 TransformerBlock。__init__ 注册持久架构；forward 执行一次计算。canonical mini-gpt-v1 是两个 pre-norm blocks、untied token embedding/LM head，且没有 dropout。',
        ),
        code(
          'python',
          `class MiniGPT(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        config.validate()
        self.config = config
        self.token_embedding = nn.Embedding(
            config.vocab_size,
            config.n_embd,
        )
        self.position_embedding = nn.Embedding(
            config.block_size,
            config.n_embd,
        )
        self.blocks = nn.ModuleList(
            [TransformerBlock(config) for _ in range(config.n_layer)]
        )
        self.final_norm = nn.LayerNorm(config.n_embd)
        self.lm_head = nn.Linear(
            config.n_embd,
            config.vocab_size,
            bias=False,
        )
        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    @staticmethod
    def _validate_token_ids(
        token_ids: torch.Tensor,
        *,
        name: str,
        vocab_size: int,
    ) -> None:
        if token_ids.dtype != torch.long:
            raise TypeError(f"{name} must have dtype torch.long")
        if token_ids.numel() == 0:
            raise ValueError(f"{name} must contain at least one token ID")
        minimum_id = int(token_ids.min().item())
        maximum_id = int(token_ids.max().item())
        if minimum_id < 0 or maximum_id >= vocab_size:
            raise ValueError(
                f"{name} IDs must be in [0, {vocab_size - 1}]"
            )

    def forward(
        self,
        idx: torch.Tensor,
        targets: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        if idx.ndim != 2:
            raise ValueError("idx must have rank 2 with shape [B,T]")
        if idx.dtype != torch.long:
            raise TypeError("idx must have dtype torch.long")

        B, T = idx.shape
        if T < 1 or T > self.config.block_size:
            raise ValueError(
                f"sequence length must be in [1, {self.config.block_size}]"
            )
        self._validate_token_ids(
            idx,
            name="idx",
            vocab_size=self.config.vocab_size,
        )

        if targets is not None:
            if targets.shape != idx.shape:
                raise ValueError("targets must have the same shape as idx")
            if targets.dtype != torch.long:
                raise TypeError("targets must have dtype torch.long")
            self._validate_token_ids(
                targets,
                name="targets",
                vocab_size=self.config.vocab_size,
            )

        positions = torch.arange(T, device=idx.device)  # [T]
        token_rows = self.token_embedding(idx)  # [B,T,C]
        position_rows = self.position_embedding(positions)  # [T,C]
        x = token_rows + position_rows  # broadcast to [B,T,C]
        for block in self.blocks:
            x = block(x)  # [B,T,C]
        x = self.final_norm(x)  # [B,T,C]
        logits = self.lm_head(x)  # [B,T,V]

        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.reshape(B * T, self.config.vocab_size),
                targets.reshape(B * T),
            )
        return logits, loss`,
          'mini_gpt_walkthrough.py',
        ),
        table(
          ['stable owner', 'canonical shape / children'],
          [
            ['token_embedding.weight', '[V,C]=[5,4]'],
            ['position_embedding.weight', '[block_size,C]=[2,4]'],
            [
              'blocks',
              'ModuleList 长度 n_layer=2；每项含 ln1, attention, ln2, feed_forward',
            ],
            ['attention', 'qkv, output_projection, causal_mask'],
            ['final_norm', 'weight [4] + bias [4]'],
            [
              'lm_head.weight',
              '[V,C]=[5,4]，bias-free 且与 token_embedding untied',
            ],
          ],
          '这些 names 从 Week 10 到 Week 12 保持不变，state-dict keys 才能稳定',
        ),
        formula(
          String.raw`x_{b,t}=E_{\mathrm{token}}[\mathrm{idx}_{b,t}]+E_{\mathrm{position}}[t]\in\mathbb{R}^{C}`,
          'token rows [B,T,C] 与 shared position rows [T,C] 相加；每个 batch row 都使用 positions 0 和 1。',
        ),
        chain([
          'idx [2,2] passes rank / long / nonempty / T / ID checks',
          'positions [2]',
          'token_rows [2,2,4] + position_rows [2,4] → x [2,2,4]',
          'blocks[0] [2,2,4] → blocks[1] [2,2,4]',
          'final_norm [2,2,4] → lm_head logits [2,2,5]',
          'targets [2,2] → logits [4,5] plus targets [4] → scalar mean CE',
        ]),
        callout(
          '为什么先处理 empty，再做 min/max',
          [
            paragraph(
              'T=0 会先被 sequence-length guard 拒绝；B=0、T=1 仍会让 numel() 为 0，所以 _validate_token_ids 再显式拒绝。只有确认至少有一个 ID 后才调用 min() 与 max()。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'positions 是 [T]，因为全部 batch rows 共享 within-context positions；不要用 token IDs 查询 position_embedding。',
        '不要先对 logits Softmax 再传给 F.cross_entropy。',
        'apply(_init_weights) 是初始化所有 registered children，不是 optimizer update。',
        '同 shape 不等于同 device；caller 必须让 model、idx 与 targets 共处一个 device。',
        'forward 不采样，也不偷偷 crop；过长 training/generation input 由边界规则明确处理。',
      ],
      check('为什么 positions 是 [T]，而 idx 是 [B,T]？', [
        paragraph(
          '每个 batch row 都使用相同的位置编号 0..T−1；position rows [T,C] 沿 B axis broadcast 后与 token rows [B,T,C] 相加。',
        ),
      ]),
    ),
    section(
      'o0363-8-modulelist',
      '8. ModuleList 为什么重要：能执行不等于被 Model 拥有',
      '普通 Python list 可以在 forward 中循环 child modules，却不会让 nn.Module 的 parameter、buffer、device、mode 与 state traversal 自动发现它们。',
      [
        '把 registration 解释为可观察的 ownership rule，而不是容器名称。',
        '证明两个 blocks 的外部 shape 不因容器改变，但训练与保存行为会彻底不同。',
      ],
      [
        paragraph(
          '把 nn.Module 赋给另一个 nn.Module 的 attribute 会注册它；可变数量的 children 应放进 nn.ModuleList。于是 blocks.0.attention.qkv.weight 与 blocks.1.attention.qkv.weight 成为独立、可命名的 parameters，两个 causal_mask 也成为 buffers。',
        ),
        code(
          'python',
          `class IncorrectStack(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.blocks = [
            TransformerBlock(config) for _ in range(config.n_layer)
        ]


class RegisteredStack(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.blocks = nn.ModuleList(
            [TransformerBlock(config) for _ in range(config.n_layer)]
        )


config = GPTConfig()
incorrect = IncorrectStack(config)
registered = RegisteredStack(config)

assert len(list(incorrect.parameters())) == 0
assert len(list(registered.parameters())) > 0
assert "blocks.0.attention.qkv.weight" in registered.state_dict()`,
        ),
        table(
          ['operation', 'plain list children', 'ModuleList children'],
          [
            ['forward 手动 loop', '可以', '可以'],
            ['model.parameters() / optimizer', '遗漏', '包含'],
            [
              'state_dict()',
              '遗漏 child state',
              '包含 named parameters 与 persistent buffers',
            ],
            ['model.to(device)', '不递归移动', '递归移动'],
            ['train() / eval()', '不递归切换', '递归切换'],
          ],
        ),
        formula(
          String.raw`\operatorname{Block}_i:\mathbb{R}^{B\times T\times C}\to\mathbb{R}^{B\times T\times C},\qquad i\in\{0,1\}`,
          'registration 不改变两个 blocks 各自的 [2,2,4]→[2,2,4] shape；它改变 state ownership。',
        ),
      ],
      [
        'ModuleList 只是 registered container，不会自动执行 children；forward 仍要显式循环。',
        'register_buffer 用于 causal_mask 等非优化 state，不是重复模块的容器。',
        '事后调用 model.parameters() 不会修复普通 list 中未注册的 children。',
        '两个 ModuleList entries 不共享 weights，除非代码明确复用同一个 module object。',
      ],
      check('普通 list 最少会造成哪两类实际遗漏？', [
        paragraph(
          '例如 optimizer 看不到 child parameters，state_dict 不保存它们；device 与 train/eval recursion 也会遗漏这些 children。',
        ),
      ]),
    ),
    section(
      'o0364-9-parameter',
      '9. Parameter 到底在哪里：把长期 State 与临时 Tensor 分开',
      '看到一个 model object 时，初学者容易把每个 Tensor 都当成可训练权重，或不知道一次 optimizer update 实际落到哪些 named owners。',
      [
        '区分 learned parameters、registered buffers、temporary activations、gradients、config values 与 optimizer state。',
        '把固定模型的每组 shape 对应到稳定 member name。',
      ],
      [
        paragraph(
          'Parameter 是注册且通常 requires_grad=True 的持久 Tensor；backward 把 gradient 写到 parameter.grad，optimizer 再更新 parameter。Buffer 会随 model 移动和保存，却不由 optimizer 学习。idx、positions、scores、weights、logits 与 loss 只是当前计算的 inputs/activations。',
        ),
        table(
          ['owner / object', 'shape in canonical model', 'kind'],
          [
            ['token_embedding.weight', '[5,4]', 'learned parameter'],
            ['position_embedding.weight', '[2,4]', 'learned parameter'],
            [
              'blocks.i.attention.qkv.weight',
              '[12,4]，无 bias',
              'learned parameter',
            ],
            [
              'blocks.i.attention.output_projection',
              'weight [4,4] + bias [4]',
              'learned parameters',
            ],
            [
              'blocks.i.ln1 / ln2',
              '各 weight [4] + bias [4]',
              'learned parameters',
            ],
            [
              'blocks.i.feed_forward.net.0',
              'weight [16,4] + bias [16]',
              'learned parameters',
            ],
            [
              'blocks.i.feed_forward.net.2',
              'weight [4,16] + bias [4]',
              'learned parameters',
            ],
            [
              'blocks.i.attention.causal_mask',
              '[1,1,2,2]',
              'registered buffer，not trained',
            ],
            ['final_norm', 'weight [4] + bias [4]', 'learned parameters'],
            ['lm_head.weight', '[5,4]，无 bias 且 untied', 'learned parameter'],
            [
              'idx / positions / scores / logits / loss',
              '随 call 改变',
              'inputs or temporary activations',
            ],
          ],
        ),
        formula(
          String.raw`\theta=\{\theta_i\}_{i=1}^{m},\qquad \theta_i\leftarrow\theta_i-\eta\frac{\partial\mathcal{L}}{\partial\theta_i}`,
          'theta 表示全部 learned parameters；eta 是 learning rate。Week 11 才让 optimizer 执行这个 state change。',
        ),
        callout(
          '三种容易混淆的 state',
          [
            list([
              'config.n_embd=4 是 Python architecture metadata，不是 Tensor parameter。',
              'parameter.grad 是 backward 产生的 gradient storage，不是 parameter 本身。',
              'AdamW 的 moments 属于 optimizer state；只保存 model.state_dict() 不会保存它们。',
            ]),
          ],
          'concept',
        ),
      ],
      [
        'loss 是 scalar Tensor，但不是下一次启动时要加载的 weight。',
        'causal_mask 出现在 state_dict 中不表示它有 gradient 或会被 optimizer 更新。',
        'gradients 通常位于各 parameter 的 .grad，而不是覆盖 parameter values。',
        'Parameters 共享相同 shape 也仍可能属于不同 block 与不同 state-dict key。',
      ],
      check('causal_mask 会训练吗？它会随模型保存和移动吗？', [
        paragraph(
          '不会训练；会，因为它由 register_buffer 注册为 persistent model state。',
        ),
      ]),
    ),
    section(
      'o0365-10-parameter-count',
      '10. 手算 Parameter Count：Canonical Untied Total = 520',
      '“更宽”或“更多层”太抽象；不逐项数 learned tensor，就难以发现漏注册、错误 bias 或意外 weight sharing。',
      [
        '按 owner 数元素，排除 activations 与 causal-mask buffer。',
        '在明确 bias 与 untied 假设后，先用表手算，再用一个 compact formula 核对 520。',
      ],
      [
        paragraph(
          '这里 V=5、block_size=2、C=4、n_layer=2。QKV 与 LM head 无 bias；attention output_projection 和两个 FFN linears 有 bias；每个 block 有两个带 scale/bias 的 LayerNorm；token_embedding 与 lm_head 是两份独立 parameters。',
        ),
        table(
          ['owner', 'calculation', 'parameters'],
          [
            ['token embedding', 'V×C = 5×4', '20'],
            ['position embedding', 'block_size×C = 2×4', '8'],
            [
              'one attention',
              'qkv 3C×C = 12×4；output C×C+C = 4×4+4',
              '48+20=68',
            ],
            ['one FFN', '(4C×C+4C) + (C×4C+C)', '80+68=148'],
            ['two block LayerNorms', '2×(C+C)', '16'],
            ['one whole block', '68+148+16', '232'],
            ['two independent blocks', 'n_layer×232 = 2×232', '464'],
            ['final LayerNorm', 'C+C', '8'],
            ['independent bias-free LM head', 'V×C = 5×4', '20'],
            ['canonical untied total', '20+8+464+8+20', '520'],
          ],
          'nn.Linear(in_features,out_features) stores weight [out_features,in_features]',
        ),
        formula(
          String.raw`N_{\mathrm{params}}=VC+\mathrm{block\_size}\,C+n_{\mathrm{layer}}(12C^2+10C)+2C+VC=520`,
          '每 block 的 12C² 来自 QKV、attention output 与两层 FFN weights；10C 来自 biased output/FFN 与两组 LayerNorm scale/bias。',
        ),
        code(
          'python',
          `canonical_model = MiniGPT(GPTConfig())
parameter_count = sum(
    parameter.numel() for parameter in canonical_model.parameters()
)
assert parameter_count == 520`,
        ),
        paragraph(
          'causal_mask [1,1,2,2] 是 buffer，所以贡献零个 trainable parameters。两个 blocks 只共享 class definition 与 shapes，不共享 tensor storage，因此必须算两次。',
        ),
      ],
      [
        '不能把两个 blocks 当成同一组 weights 重复运行。',
        '不能把 causal_mask、logits 或 gradients 算作 learned parameters。',
        '520 依赖这里明确的 bias 与 untied policy；换一个 policy 就必须重算并 version checkpoint。',
        'Parameter count 能帮助审计 storage，却不单独决定 compute、能力或质量。',
      ],
      check('为什么一个 block 的两个 LayerNorm 一共有 16 个 parameters？', [
        paragraph(
          '每个 LayerNorm 有长度 C=4 的 learned scale 与 bias，共 8；两个 norms 是 2×(4+4)=16。',
        ),
      ]),
    ),
    section(
      'o0371-11-weight-tying',
      '11. Weight Tying：理解 Optional Variant，不改 Canonical Policy',
      'token_embedding 与 lm_head 的 weights 都是 [V,C]=[5,4]，容易误以为相同 shape 就会自动共享，或把教学 tying 实验偷偷混入 canonical checkpoint。',
      [
        '说明 tying 是两个 names 引用同一 Parameter 的显式 architecture choice。',
        '计算独立 520 与 tied 500 的差异，同时保持 mini-gpt-v1 主模型 untied。',
      ],
      [
        paragraph(
          'Canonical MiniGPT 保持 token_embedding.weight 与 lm_head.weight 独立，所以是 520 parameters。可选实验把 output weight 指向 input table；lookup 与 output scoring 随后从两条路径向同一 tensor 累积 gradients。它是另一个明确标注的 architecture variant，不是默认修补。',
        ),
        code(
          'python',
          `# Optional teaching variant only; canonical mini-gpt-v1 stays untied.
tied_variant = MiniGPT(GPTConfig())
tied_variant.lm_head.weight = tied_variant.token_embedding.weight

assert tied_variant.lm_head.weight is tied_variant.token_embedding.weight
assert sum(p.numel() for p in tied_variant.parameters()) == 500`,
        ),
        formula(
          String.raw`W_{\mathrm{out}}=E_{\mathrm{token}}\in\mathbb{R}^{V\times C},\qquad [B,T,C]\,W_{\mathrm{out}}^{\top}\to[B,T,V]`,
          'Tied variant 仍输出 [B,T,5]；改变的是两张 [5,4] tables 的 ownership，不是 logits shape。',
        ),
        table(
          [
            'policy',
            'two [5,4] names contribute',
            'whole-model total',
            'checkpoint identity',
          ],
          [
            [
              'canonical untied',
              '20+20 distinct parameters',
              '520',
              'weight_policy=untied',
            ],
            [
              'optional tied variant',
              '20 unique parameters',
              '500',
              '必须明确记录 tied policy 并在 construction 时重建 alias',
            ],
          ],
        ),
        callout(
          'State dict 数值不自动重建 sharing',
          [
            paragraph(
              '即使 tied model 的 state_dict 暴露两个同值 keys，把它加载进新建的 untied MiniGPT 也不会凭数值相等恢复 Parameter identity。因此 tied/untied 必须是可验证的 architecture policy，不能只靠 tensor shapes 猜。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '相同 shape 不会自动 tying；需要显式共享同一个 Parameter object。',
        '不要把 520 的 canonical checkpoint 加载到 500 的 tied architecture 后仍声称完全兼容。',
        '不要把同一 tensor 当两份独立 parameters 更新或计数。',
        'lm_head 无 bias；若另加 bias，还要单独计 V 个 parameters。',
      ],
      check(
        '可选 tied variant 中，两张 [5,4] names 合计贡献多少 unique parameters？',
        [
          paragraph(
            '20，因为两者引用同一个 [5,4] Parameter；canonical untied model 仍贡献 40 并保持总数 520。',
          ),
        ],
      ),
    ),
    section(
      'o0372-12-shape',
      '12. 正确性首先检查 Shape 与 API Boundary',
      '模型可能在某次输入上运行，却仍把 axes、labels 或 return contract 接错；若先观察训练结果，错误会被随机 logits 与 optimizer dynamics 掩盖。',
      [
        '先用有效 batch 检查完整 pipeline 的 outputs，再主动触发 rank、dtype、length、range 与 target-alignment guards。',
        '把 shape correctness 定位为第一道检查，而不是把它误当因果性或学习能力的证明。',
      ],
      [
        paragraph(
          '固定 idx 与 targets 经过同一个 canonical model：两行、每行两个 token positions、每个位置五个 logits；四个 target IDs 与四个 logit rows 对齐。loss 的 shape [] 表示 rank-0 scalar，不是长度一 vector。',
        ),
        code(
          'python',
          `config = GPTConfig()
model = MiniGPT(config)
logits, loss = model(idx, targets)

assert logits.shape == (2, 2, 5)
assert loss is not None and loss.ndim == 0
assert torch.isfinite(loss)

logits_without_targets, no_loss = model(idx)
assert logits_without_targets.shape == (2, 2, 5)
assert no_loss is None

# Boundary failures are deliberate and readable.
invalid_cases = [
    torch.tensor([0, 1], dtype=torch.long),  # rank 1
    torch.empty((2, 0), dtype=torch.long),  # T=0
    torch.tensor([[0, 1, 2]], dtype=torch.long),  # T=3
    torch.tensor([[0.0, 1.0]]),  # wrong dtype
    torch.tensor([[0, 5]], dtype=torch.long),  # ID out of 0..4
]
for invalid_idx in invalid_cases:
    try:
        model(invalid_idx)
    except (TypeError, ValueError):
        pass
    else:
        raise AssertionError("invalid idx was accepted")

invalid_target_cases = [
    torch.tensor([[1, 2]], dtype=torch.long),  # shape mismatch
    torch.tensor([[1.0, 2.0], [1.0, 0.0]]),  # wrong dtype
    torch.tensor([[1, 5], [1, 0]], dtype=torch.long),  # ID out of 0..4
]
for invalid_targets in invalid_target_cases:
    try:
        model(idx, invalid_targets)
    except (TypeError, ValueError):
        pass
    else:
        raise AssertionError("invalid targets were accepted")`,
        ),
        chain([
          'idx [2,2]',
          'embeddings [2,2,4]',
          'block 1 [2,2,4]',
          'block 2 [2,2,4]',
          'logits [2,2,5]',
          'reshape logits [4,5] + targets [4]',
          'mean cross-entropy loss []',
        ]),
        formula(
          String.raw`[2,2]\to[2,2,4]\to[2,2,4]\to[2,2,4]\to[2,2,5]\to[4,5]+[4]\to[]`,
          '每个箭头都来自已说明的 embedding、shape-preserving blocks、vocabulary projection 或 aligned reshape。',
        ),
        table(
          ['successful assertion', '它证明什么', '它还没证明什么'],
          [
            [
              'logits.shape==(2,2,5)',
              'top-level output interface',
              'causal mask 方向或 labels 语义',
            ],
            [
              'loss.ndim==0 and finite',
              'mean CE 返回可用 scalar',
              '模型已经学会语料',
            ],
            [
              'no targets → no_loss is None',
              'inference branch contract',
              'generation append 正确',
            ],
            [
              'invalid inputs raise',
              'API boundary 拒绝已知坏数据',
              '所有可能错误都被覆盖',
            ],
          ],
        ),
      ],
      [
        'Shape 正确不证明 causality、registration、target alignment 或 learning behavior。',
        '没有 targets 时 loss 必须是 None；不要制造假的 zero loss。',
        '不要断言随机 initialization 下某个精确 logit 值。',
        '任意 transpose 后的 tensor 不应盲目用 view；canonical attention rejoin 已先 contiguous()。',
        'API 必须先拒绝 empty tensor，再调用 min/max。',
      ],
      check(
        '成功完成 shape/API assertions 后，还需哪项检查才能确认 future token 没有泄漏？',
        [
          paragraph(
            '需要第 13 节的 causal behavioral check：只改变未来 position，并比较 earlier-position logits。',
          ),
        ],
      ),
    ),
    section(
      'o0373-13-causal',
      '13. 必须检查 Causal 性：比较可观察行为',
      '即使 causal_mask 看起来是下三角，也可能因 slice、broadcast 或 axis 用错而让 earlier query 偷看 future token；训练便会获得生成时不存在的答案线索。',
      [
        '用两个共享相同 prefix、只在未来位置不同的序列检查 position-0 logits。',
        '比较 observable promise，而不是只检查内部 mask 的外观。',
      ],
      [
        paragraph(
          '两行都以 我（ID 0）开始；第二个 token 分别是 喜欢（ID 1）与 猫（ID 4）。query position 0 只允许读取 key column 0，所以它的五个 vocabulary logits 必须一致。position 1 可以变化，因为它允许读取自己。',
        ),
        code(
          'python',
          `model.eval()
past_same_future_changed = torch.tensor([
    [0, 1],  # 我 喜欢
    [0, 4],  # 我 猫
], dtype=torch.long)

with torch.no_grad():
    causal_logits, _ = model(past_same_future_changed)

assert causal_logits.shape == (2, 2, 5)
assert torch.allclose(
    causal_logits[0, 0, :],
    causal_logits[1, 0, :],
)`,
        ),
        table(
          ['slice', 'meaning', 'expected comparison'],
          [
            [
              'causal_logits[0,0,:]',
              'row 0，earlier query t=0，五个 candidate logits',
              '与 row 1 的 t=0 相同',
            ],
            [
              'causal_logits[1,0,:]',
              'row 1，same 我 prefix at t=0',
              '与 row 0 的 t=0 相同',
            ],
            [
              'causal_logits[:,1,:]',
              '两行 final positions',
              '允许不同，不用于 future-leak assertion',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{logits}_{t}(x_{\le t},x_{>t})=\mathrm{logits}_{t}(x_{\le t},x'_{>t})`,
          '当两个 sequences 到 t 为止完全相同，改变 t 右侧内容不应改变该位置 logits。',
        ),
        formula(
          String.raw`M_{t,j}=-\infty\quad\text{for}\quad j>t`,
          'future key columns 在 Softmax 前被移除，因而不向 query t 的 output 传递信息。',
        ),
        paragraph(
          '本 canonical model 没有 Dropout，所以同一次 eval forward 的比较是确定的；model.eval() 仍是正确习惯，因为将来的 Dropout 或 BatchNorm model 会让 mode 改变行为。',
        ),
      ],
      [
        '比较 final position 不能证明没有 future leakage；那里已经没有右侧输入。',
        '应比较 logits，而不是先各自 sampling 后比较随机 token。',
        '若模型含 stochastic layers，两个独立 train-mode forwards 可能因随机性不同。',
        'Earlier logits 不同首先指向 mask/axis leakage，但仍应排除不同 prefix、position 或 stochastic state。',
      ],
      check(
        '这里若 causal_logits[0,0,:] 与 causal_logits[1,0,:] 不同，最可能是哪类错误？',
        [
          paragraph(
            '在确认 prefix、position 与 deterministic mode 相同后，最可能是 causal mask、slice、broadcast 或 attention axis 造成的 future-information leak。',
          ),
        ],
      ),
    ),
    section(
      'o0374-14-architecture-state-dict',
      '14. Architecture 与 State Dict：Checkpoint 是一份兼容性合同',
      'state_dict 只是一组 named tensors；它不知道怎样执行 forward，也不知道 ID 1 是“喜欢”、weights 是否应 tying，或 AdamW 已完成多少次 update。',
      [
        '把 code/config、tokenizer identity、untied policy、model state、optimizer state 与 completed_updates 一起明确保存。',
        '区分 inference-only restore 与 faithful training resume，并让 checkpoint function 只依赖显式参数。',
      ],
      [
        paragraph(
          'mini-gpt-v1 的 tokenizer artifact 只含 version=mini-gpt-v1、ordered tokens [我,喜欢,AI,学习,猫] 与 policy=whitespace-delimited;no-specials;no-pad;no-unk。canonical bytes 用 JSON 的 sorted keys、无多余空格 separators、原样 Unicode 和 UTF-8 编码得到，再计算 SHA-256；因此同一 artifact 在不同进程中产生同一 digest。相同 V=5 绝不等于相同 ID semantics。',
        ),
        code(
          'python',
          `def make_tokenizer_artifact(
    *,
    version: str,
    ordered_tokens: tuple[str, ...],
    policy: str,
) -> dict[str, object]:
    return {
        "version": version,
        "ordered_tokens": list(ordered_tokens),
        "policy": policy,
    }


def tokenizer_artifact_sha256(artifact: dict[str, object]) -> str:
    canonical_bytes = json.dumps(
        artifact,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def canonical_mini_gpt_tokenizer_artifact() -> dict[str, object]:
    return make_tokenizer_artifact(
        version="mini-gpt-v1",
        ordered_tokens=("我", "喜欢", "AI", "学习", "猫"),
        policy="whitespace-delimited;no-specials;no-pad;no-unk",
    )


def validate_checkpoint_tokenizer_identity(
    checkpoint: dict[str, object],
    *,
    expected_ordered_tokens: tuple[str, ...],
    expected_tokenizer_policy: str,
    expected_tokenizer_version: str,
) -> None:
    stored_tokenizer = checkpoint.get("tokenizer")
    if not isinstance(stored_tokenizer, dict):
        raise ValueError("checkpoint tokenizer metadata is missing")
    required_keys = {"version", "ordered_tokens", "policy", "sha256"}
    if set(stored_tokenizer) != required_keys:
        raise ValueError("checkpoint tokenizer metadata has unexpected keys")

    stored_artifact = {
        "version": stored_tokenizer["version"],
        "ordered_tokens": stored_tokenizer["ordered_tokens"],
        "policy": stored_tokenizer["policy"],
    }
    stored_digest = stored_tokenizer["sha256"]
    if not isinstance(stored_digest, str):
        raise ValueError("checkpoint tokenizer SHA-256 must be text")
    try:
        recomputed_digest = tokenizer_artifact_sha256(stored_artifact)
    except (TypeError, ValueError) as error:
        raise ValueError(
            "checkpoint tokenizer artifact is not canonical JSON data"
        ) from error
    if recomputed_digest != stored_digest:
        raise ValueError("checkpoint tokenizer artifact failed SHA-256 check")

    expected_artifact = make_tokenizer_artifact(
        version=expected_tokenizer_version,
        ordered_tokens=expected_ordered_tokens,
        policy=expected_tokenizer_policy,
    )
    canonical_artifact = canonical_mini_gpt_tokenizer_artifact()
    if expected_artifact != canonical_artifact:
        raise ValueError("caller tokenizer identity is not mini-gpt-v1")
    expected_digest = tokenizer_artifact_sha256(expected_artifact)
    if stored_artifact != expected_artifact:
        raise ValueError("stored tokenizer artifact does not match caller")
    if stored_digest != expected_digest:
        raise ValueError("stored tokenizer digest does not match caller")


def save_mini_gpt_training_checkpoint(
    path: str,
    *,
    model: MiniGPT,
    optimizer: torch.optim.Optimizer,
    completed_updates: int,
    ordered_tokens: tuple[str, ...],
    tokenizer_policy: str,
    tokenizer_version: str,
) -> None:
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    tokenizer_artifact = make_tokenizer_artifact(
        version=tokenizer_version,
        ordered_tokens=ordered_tokens,
        policy=tokenizer_policy,
    )
    if tokenizer_artifact != canonical_mini_gpt_tokenizer_artifact():
        raise ValueError("tokenizer artifact does not match mini-gpt-v1")
    tokenizer_digest = tokenizer_artifact_sha256(tokenizer_artifact)
    if model.config != GPTConfig():
        raise ValueError("model config is not the canonical GPTConfig")
    if model.lm_head.weight is model.token_embedding.weight:
        raise ValueError("canonical checkpoint requires untied weights")

    checkpoint = {
        "schema": {
            "name": "mini-gpt-training-checkpoint",
            "version": 1,
        },
        "tokenizer": {
            **tokenizer_artifact,
            "sha256": tokenizer_digest,
        },
        "config": {
            "vocab_size": model.config.vocab_size,
            "block_size": model.config.block_size,
            "n_embd": model.config.n_embd,
            "n_head": model.config.n_head,
            "n_layer": model.config.n_layer,
        },
        "weight_policy": {
            "token_embedding_lm_head": "untied",
        },
        "model_state": model.state_dict(),
        "optimizer": {
            "class": (
                f"{optimizer.__class__.__module__}."
                f"{optimizer.__class__.__qualname__}"
            ),
            "state": optimizer.state_dict(),
        },
        "completed_updates": completed_updates,
    }
    torch.save(checkpoint, path)


def load_mini_gpt_for_inference(
    path: str,
    *,
    expected_ordered_tokens: tuple[str, ...],
    expected_tokenizer_policy: str,
    expected_tokenizer_version: str,
    map_location: str | torch.device,
) -> MiniGPT:
    checkpoint = torch.load(
        path,
        map_location=map_location,
        weights_only=False,
    )
    if not isinstance(checkpoint, dict):
        raise ValueError("checkpoint must be a dictionary")
    if checkpoint.get("schema") != {
        "name": "mini-gpt-training-checkpoint",
        "version": 1,
    }:
        raise ValueError("checkpoint schema/version mismatch")

    validate_checkpoint_tokenizer_identity(
        checkpoint,
        expected_ordered_tokens=expected_ordered_tokens,
        expected_tokenizer_policy=expected_tokenizer_policy,
        expected_tokenizer_version=expected_tokenizer_version,
    )

    expected_config = GPTConfig()
    expected_config_fields = {
        "vocab_size": expected_config.vocab_size,
        "block_size": expected_config.block_size,
        "n_embd": expected_config.n_embd,
        "n_head": expected_config.n_head,
        "n_layer": expected_config.n_layer,
    }
    if checkpoint.get("config") != expected_config_fields:
        raise ValueError("checkpoint config mismatch")
    if checkpoint.get("weight_policy") != {
        "token_embedding_lm_head": "untied",
    }:
        raise ValueError("checkpoint weight policy mismatch")

    model = MiniGPT(expected_config).to(map_location)
    model.load_state_dict(checkpoint["model_state"], strict=True)
    return model`,
          'mini_gpt_walkthrough.py',
        ),
        table(
          ['canonical identity representation', 'exact value'],
          [
            [
              'UTF-8 JSON text',
              '{"ordered_tokens":["我","喜欢","AI","学习","猫"],"policy":"whitespace-delimited;no-specials;no-pad;no-unk","version":"mini-gpt-v1"}',
            ],
            [
              'SHA-256 hex digest',
              '38d630f4c589664c9bef567457d48764cbe2307734777e80f7d5d5c63ac88dd6',
            ],
          ],
          'sort_keys=True、separators=(",", ":")、ensure_ascii=False，再以 UTF-8 编码',
        ),
        paragraph(
          '保存端不再接受任意 hash 字符串：它从 exact artifact 直接计算 digest。加载端先从 stored fields 重建同样的 canonical bytes，验证 stored digest，再把 stored artifact 与 digest 同 caller 明确提供的 expected identity 比较；这些检查全部发生在构造和使用模型之前。SHA-256 能绑定这里记录的 bytes 并发现意外损坏或 identity mismatch，但它不是签名：它不证明来源可信，也不证明未记录的 tokenizer code、Unicode normalization 或 split behavior 等实现细节相同。',
        ),
        table(
          ['restore goal', 'required fields', 'what may be omitted'],
          [
            [
              'inference only',
              'schema/version、tokenizer identity、exact config、untied policy、model_state',
              'optimizer state 与 completed_updates',
            ],
            [
              'faithful optimizer resume',
              'inference fields + optimizer class/state + unambiguous completed_updates',
              '不能省略 optimizer moments 或把 update index 猜成 count',
            ],
            [
              'bit-for-bit resume claim',
              '还需相同 data order 与所用 CPU/CUDA/Python RNG state',
              '本最小函数不宣称保存这些额外状态',
            ],
          ],
        ),
        table(
          ['saved key example', 'compatibility consequence'],
          [
            [
              'tokenizer.sha256',
              '先对 stored version/tokens/policy 重新 canonicalize 并验 digest，再与 caller expected identity 比较',
            ],
            [
              'token_embedding.weight [5,4]',
              '无法 strict-load 到 [6,4] 或 [5,8]',
            ],
            [
              'blocks.1.attention.qkv.weight [12,4]',
              '一层 model 没有 blocks.1；renamed member 也会 key mismatch',
            ],
            [
              'blocks.i.attention.causal_mask [1,1,2,2]',
              'registered buffer 也在 state management 中',
            ],
            ['weight_policy=untied', '不能静默恢复为 tied alias'],
          ],
        ),
        formula(
          String.raw`\operatorname{load}_{\mathrm{strict}}:\{\mathrm{name}\mapsto\mathrm{shape}\}_{\mathrm{saved}}=\{\mathrm{name}\mapsto\mathrm{shape}\}_{\mathrm{constructed}}`,
          'strict state loading 要求已构造 architecture 的 expected keys/shapes 与 checkpoint 对齐；相同 shape 仍不能替代 tokenizer/policy check。',
        ),
        callout(
          '安全加载顺序',
          [
            list(
              [
                '用 map_location 把 checkpoint tensors 映射到目标 CPU/CUDA/MPS device。',
                '验证 schema/version，再从 stored version、ordered tokens 与 policy 重建 canonical UTF-8 JSON，重新计算并比较 SHA-256。',
                '用 caller 提供的 expected tokenizer artifact 再算 digest，并同时比较 stored artifact 与 digest。',
                '验证 exact config 与 untied policy；全部 identity checks 通过后才构造 MiniGPT 并 strict load model_state。',
                '只有 resume training 时，才按保存的 optimizer class 构造并加载 optimizer state，从 completed_updates 之后继续。',
              ],
              true,
            ),
          ],
          'principle',
        ),
      ],
      [
        'state_dict 不保存 Python forward logic、tokenizer semantics 或 tying intent。',
        '同为 V=5 但 token 顺序不同，会静默改变 input rows 与 output columns 的含义。',
        '只保存 model_state 足够做已验证的 inference，不足以声称 faithful optimizer resume。',
        'completed_updates 是已经执行的 update 数，不是含糊的零起始 loop index。',
        'SHA-256 digest 与 artifact 存在同一 checkpoint 中，不能认证来源；不要把 digest 通过当成加载不可信文件的许可。',
        'torch.save 不会把 live model 自动移动到另一个 device。',
      ],
      check('为什么两个 tokenizer 都是 V=5，checkpoint 仍可能不可用？', [
        paragraph(
          '因为同一个 ID 可能映射到不同 ordered token 或 preprocessing policy，导致 embedding row 与 LM-head output column 的语义全部错位。',
        ),
      ]),
    ),
    section(
      'o0375-15-week-2-gpt',
      '15. 从 Week 2 的公式到 GPT：仍是 Affine Maps 与 Gradient Updates',
      'GPT 的 class nesting 与四维 attention tensors 看起来像全新数学，容易让 learner 忘记其中大部分 learned transformations 仍是 Week 2 的 Linear。',
      [
        '把 qkv、output projection、FFN 与 LM head 映射回 PyTorch 的 affine convention。',
        '说明新能力来自 causality、composition、nonlinearity、residuals 与 shared token-wise application，而不是改变基本优化原则。',
      ],
      [
        paragraph(
          'PyTorch nn.Linear(in_features,out_features) 保存 weight [out_features,in_features]，对 row-vector input 计算 XWᵀ+b。Combined qkv 把每个四维 row 变成十二维并切成三份；LM head 再把最终四维 row 变成五个 categorical next-token scores。',
        ),
        table(
          ['component', 'input / stored weight', 'output', 'bias policy'],
          [
            [
              'combined qkv',
              'X[...,4]，W_qkv [12,4]',
              'QKV[...,12]',
              '无 bias',
            ],
            [
              'attention output_projection',
              'X[...,4]，W_o [4,4]',
              'X[...,4]',
              'bias [4]',
            ],
            [
              'FFN first / second',
              '[...,4]→[...,16]→[...,4]',
              'per-token nonlinear update',
              'bias [16] 与 [4]',
            ],
            [
              'bias-free lm_head',
              'H[...,4]，W_head [5,4]',
              'logits[...,5]',
              '无 bias',
            ],
          ],
        ),
        formula(
          String.raw`Y=XW^{\top}+b,\qquad X:[\ldots,4],\quad W:[12,4],\quad Y:[\ldots,12]`,
          '这是带 bias Linear 的一般 PyTorch orientation；canonical qkv 特例明确省略 b。',
        ),
        formula(
          String.raw`Z=H\,W_{\mathrm{head}}^{\top},\qquad H:[B,T,4],\quad W_{\mathrm{head}}:[5,4],\quad Z:[B,T,5]`,
          'Canonical LM head bias=False，所以该式没有额外 b_head；五维 Z 是五个 unnormalized class scores。',
        ),
        formula(
          String.raw`\mathcal{L}=-\frac{1}{BT}\sum_{b=1}^{B}\sum_{t=1}^{T}\log p_{\theta}(y_{b,t}\mid x_{b,\le t})`,
          'Cross-entropy 平均 B×T 个 categorical next-token tasks；targets 是 class IDs，不是连续回归值。',
        ),
        paragraph(
          'Backward 仍按 chain rule 把 loss gradient 传到每个参与的 parameter，optimizer 再更新 theta。Attention 让 earlier positions 进入 current representation，GELU 提供非线性，两条 residual paths 与 norms 支持组合深度。',
        ),
      ],
      [
        'Token ID 不是连续数值 target，不能用 MSE 让预测接近 ID 号码。',
        'Affine maps 单独堆叠而没有 Attention/nonlinearity/residual structure，不等于本 GPT。',
        'F.cross_entropy 接收 raw logits，不要先做 Softmax。',
        'LM-head 五维 output 表示五个候选的分数，不是一个五维 embedding。',
      ],
      check('LM head 在一个 position 输出的五个数表示什么？', [
        paragraph(
          '它们按 [我,喜欢,AI,学习,猫] 顺序表示五个可能 next tokens 的未归一化 logits。',
        ),
      ]),
    ),
    section(
      'o0376-16-week-10-7',
      '16. Week 10 最应该理解的 7 件事',
      '长 architecture chapter 容易留下孤立的 API 记忆；遇到 failure 时，learner 仍不知道应先查 config、shape、registration、causality 还是 checkpoint identity。',
      [
        '用恰好七条相连断言复盘 canonical mini-gpt-v1。',
        '把两个 prompt 的完整 trace 与 generation context/history 区别放回同一 mental model。',
      ],
      [
        list(
          [
            'Config 是 shared shape/checkpoint contract；C=4 可被 H=2 整除，所以 d_head=2。',
            'mini-gpt-v1 的 token identity [B,T] 加 position rows [T] 后得到 [B,T,4]；它与 Week 9 的 V=11 artifact 不兼容。',
            '两个独立 pre-norm blocks 都保持 [B,T,4]：attention 因果混合可见 positions，feed_forward 逐位置处理 channels。',
            'final_norm 与 bias-free lm_head 把 [B,T,4] 变为 [B,T,5] raw logits，而不是 probabilities。',
            '有 targets 时，[2,2,5]→[4,5] 与 [2,2]→[4] 得 scalar mean CE；没有 targets 时 loss=None。',
            'registered modules 持有的 parameters 会被 model.parameters() 枚举，并在 caller 把它们传给 optimizer 后成为可优化对象；registered parameters 与 persistent registered buffers 会进入 state_dict 并随 module 移动；train()/eval() 的 mode 递归作用于 modules；buffers 不是 optimizer parameters。canonical token table/head untied，总参数 520。',
            '可用 checkpoint 需要 matching code、exact config、untied policy 与 tokenizer identity；generation 只 crop forward context、只读 last logits，却保留完整 history。',
          ],
          true,
        ),
        chain([
          '[我,喜欢] / [猫,喜欢] → idx [2,2]',
          'token + position [2,2,4]',
          'two causal pre-norm blocks [2,2,4]',
          'final norm + head → logits [2,2,5]',
          'generation context = history[:,-2:]',
          'next_logits = logits[:,-1,:] [B,5]',
          'next_id [B,1] append to uncropped history',
        ]),
        paragraph(
          '这里把生成总记录的长度称为 L_history；它可以大于 2。每轮真正进入 model 的 T_context 至多为 block_size=2，避免把 L 错当 layer count。',
        ),
        formula(
          String.raw`T_{\mathrm{context}}=\min(L_{\mathrm{history}},\mathrm{block\_size}),\qquad \mathrm{block\_size}=2`,
          'Caller 保留完整 history，但 model 每轮只接收其最后一个或两个 token positions。',
        ),
      ],
      [
        '两个 blocks 不等于两个 attention calls；每个还含两次 norm、两条 residual 与一个 FFN。',
        '返回 [B,T,5] 只证明 interface，不证明已经 learning 或 generalizing。',
        '保存 weights 不能修复 changed tokenizer、renamed members 或 changed tying policy。',
        '相同 final token 不保证相同 final logits；causal context 可以不同。',
      ],
      check('为何两个 prompt 都以“喜欢”结尾，最后 logits 仍可能不同？', [
        paragraph(
          '每个 causal block 允许 position 1 读取不同的 position 0（我或猫），再由同一个 final_norm 与 lm_head 投影不同 contextual rows。',
        ),
      ]),
    ),
    section(
      'o0377-17-week-10-week-11',
      '17. Week 10 → Week 11：Model 负责 Forward，Caller 负责 State Change',
      '刚组装的 520 个 parameters 都是初始化值；shape 与 causality checks 不会自动训练 weights，也不会替 caller 管理 device、mode、gradients、optimizer 或 generation history。',
      [
        '给 Week 11 一条最小、明确的 one-update boundary，而不提前展开完整 training/evaluation protocol。',
        '把 generation crop、last-position choice 与 append 放在 forward 外，并保留 uncropped history。',
      ],
      [
        paragraph(
          '所有 interacting tensors 必须与 model 在同一 device。model.train() 与 model.eval() 标记 mode；本 Week 10 架构没有 Dropout 或 BatchNorm，所以两种 mode 的数值 forward 相同，但未来含这些 modules 时会改变行为。eval() 本身不关闭 gradients，仍要配合 torch.no_grad()。',
        ),
        code(
          'python',
          `device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)
model = MiniGPT(GPTConfig()).to(device)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)

idx_on_device = idx.to(device)
targets_on_device = targets.to(device)

model.train()
logits, loss = model(idx_on_device, targets_on_device)
assert logits.shape == (2, 2, 5)
assert loss is not None
optimizer.zero_grad(set_to_none=True)
loss.backward()
optimizer.step()  # exactly one completed update

model.eval()
with torch.no_grad():
    evaluation_logits, no_loss = model(idx_on_device)
assert evaluation_logits.shape == (2, 2, 5)
assert no_loss is None`,
          'mini_gpt_walkthrough.py',
        ),
        table(
          ['line / phase', 'state change or observation'],
          [
            [
              'model.train()',
              '递归设置 module training flags；本 no-dropout model 数值不变',
            ],
            [
              'forward with targets',
              '构建 logits 与 scalar mean-loss computation graph',
            ],
            [
              'zero_grad(set_to_none=True)',
              '清除上一次 parameter.grad storage',
            ],
            [
              'loss.backward()',
              '计算并累积 gradients，不直接改 parameter values',
            ],
            [
              'optimizer.step()',
              '使用 gradients/moments 改变 parameters；completed_updates 增加 1',
            ],
            [
              'eval() + no_grad()',
              '设置 evaluation mode 并避免构建 gradient graph',
            ],
          ],
        ),
        code(
          'python',
          `@torch.no_grad()
def generate_mini_gpt(
    model: MiniGPT,
    history: torch.Tensor,
    max_new_tokens: int,
) -> torch.Tensor:
    if max_new_tokens < 0:
        raise ValueError("max_new_tokens cannot be negative")

    was_training = model.training
    model.eval()
    for _ in range(max_new_tokens):
        context = history[:, -model.config.block_size:]
        logits, _ = model(context)
        next_logits = logits[:, -1, :]
        next_id = torch.argmax(
            next_logits,
            dim=-1,
            keepdim=True,
        )
        history = torch.cat((history, next_id), dim=1)

    if was_training:
        model.train()
    return history`,
          'mini_gpt_walkthrough.py',
        ),
        chain([
          'uncropped history [B,L_history]',
          'context = history[:,-block_size:] → [B,min(L_history,2)]',
          'forward(context) → logits [B,T_context,5]',
          'next_logits = logits[:,-1,:] → [B,5]',
          'choose next_id outside forward → [B,1]',
          'append to uncropped history → [B,L_history+1]',
        ]),
        formula(
          String.raw`\mathbb{E}[\mathcal{L}_{\mathrm{uniform}}]=\ln(V)=\ln(5)\approx1.609`,
          '若五个候选初始近似均匀，mean next-token NLL 的参照约为 1.609；实际随机 initialization 不保证恰好等于它。',
        ),
        formula(
          String.raw`[B,L_{\mathrm{history}}]\to[B,\min(L_{\mathrm{history}},2)]\to[B,5]\to[B,1]\to[B,L_{\mathrm{history}}+1]`,
          '只 crop 送进 forward 的 context；next_id 始终 append 到 caller 保留的完整 history。',
        ),
        callout(
          'Week 11 接下来会增加什么',
          [
            paragraph(
              'Week 11 会区分 training 与 validation loaders、token-weighted evaluation、checkpoint timing，以及在 next_logits 上逐步加入 sampling temperature τ 和 top-k。无论选择规则怎样变化，sampling 都留在 forward 外。',
            ),
          ],
          'concept',
        ),
      ],
      [
        '不要静默 crop training targets；training batch 必须本来就满足 [B,block_size] contract。',
        '不要在 backward 前调用 optimizer.step()，也不要忘记先清理旧 gradients。',
        'Generation 当前轮只能使用 logits[:,-1,:]，不能从 earlier rows 追加 token。',
        'CPU tensor 不能直接与 CUDA model 计算。',
        'eval() 不会自动关闭 autograd；no_grad() 也不会自动切换 module mode。',
        '不要把 cropped context 当作完整生成记录覆盖掉 history。',
      ],
      check(
        '为什么 generation 只 crop forward input，却把 next_id append 到完整 history？',
        [
          paragraph(
            'MiniGPT 一次最多看最后 block_size=2 个 positions；caller 仍需保存全部已生成 tokens 作为最终结果和下一轮的 uncropped record。',
          ),
        ],
      ),
    ),
  ],
};
