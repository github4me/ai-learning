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

const batchSignalRows = [
  ['b=0, t=0', '我', '喜欢', 'logits[0,0,:]'],
  ['b=0, t=1', '我 喜欢', 'AI', 'logits[0,1,:]'],
  ['b=1, t=0', '猫', '喜欢', 'logits[1,0,:]'],
  ['b=1, t=1', '猫 喜欢', '我', 'logits[1,1,:]'],
  ['b=2, t=0', '我', '学习', 'logits[2,0,:]'],
  ['b=2, t=1', '我 学习', 'AI', 'logits[2,1,:]'],
];

const trainingShapeSpine =
  'inputs [B,T]=[3,2] → token/position representation [B,T,C]=[3,2,4] → logits [B,T,V]=[3,2,5] → logits.reshape(B×T,V)=[6,5] 与 targets.reshape(B×T)=[6] → scalar mean cross-entropy loss []。';

const canonicalIdentity =
  'mini-gpt-v1 按空格切分，ordered tokens 固定为 [我, 喜欢, AI, 学习, 猫]，IDs 固定为 0..4，没有 special、padding 或 unknown token；canonical GPTConfig 是 vocab_size=5、block_size=2、n_embd=4、n_head=2、n_layer=2，token embedding 与 LM head 保持 untied。';

export const week11Revision: CuratedWeekRevision = {
  weekSlug: 'week-11',
  title:
    'Week 11 - Training 与 Inference：让同一个 MiniGPT 正确学习、测量、保存与生成',
  keyQuestion:
    '怎样围绕 Week 10 的同一个 MiniGPT 安排训练、验证、checkpoint 与生成，并准确说出每一行改变了什么 state？',
  objectives: [
    '沿固定六个监督信号解释 forward、loss、backward、gradient clipping 与 AdamW step 的状态变化和先后顺序。',
    '用 ln(5)≈1.609 建立均匀预测基线，并用 token-weighted held-out loss 区分训练效果与泛化测量。',
    '识别重复上下文 [我] 的冲突，推导 one-batch mean NLL 只能趋近 ln(2)/3≈0.231 而不能趋近 0。',
    '复用 Week 10 的精确模型、tokenizer 与 checkpoint identity，在最后位置 logits 上依次应用 τ、top-k、Softmax 与 multinomial。',
  ],
  estimatedReadingMinutes: 100,
  sections: [
    section(
      'o0379-week-11',
      'Week 11 核心目标：同一 MiniGPT 的四种工作',
      'Week 10 的 MiniGPT 已能把 IDs 映射为 logits，却不会自行决定何时学习、怎样测量泛化、保存哪些长期状态，或怎样把一个分布变成续写 token；把这些动作塞进 forward 会混淆 state owner。',
      [
        '先划清 training、validation、checkpointing 与 inference 四条边界。',
        '让 learner 能从一次操作判断它是否允许改变 parameters、gradients、optimizer state 或 generation history。',
      ],
      [
        paragraph(
          `直白地说，模型只负责计算；外层 Week 11 training/generation module 决定怎样使用计算结果。Training 用 labels 并且是唯一会故意更新 θ 的 phase；validation 用真正 held-out labels 测量当前 θ；checkpointing 把兼容的长期 state 写出或读回；inference 没有 targets，只选择并追加 token。${canonicalIdentity}`,
        ),
        callout(
          '先把 Week 10 文件作为无副作用的 Module',
          [
            paragraph(
              'Week 10 把 canonical definitions 统一标为 mini_gpt_walkthrough.py；其中确实定义了下方导入的 GPTConfig、MiniGPT、save_mini_gpt_training_checkpoint、load_mini_gpt_for_inference 与 validate_checkpoint_tokenizer_identity。作为标准 Python packaging 步骤，应把 Week 10 的顶层演示 statements 移入 main() 并只在 if __name__ == "__main__": 分支调用，definitions 仍留在 module scope。这样 import 只发布 frozen API，不会训练、保存 checkpoint 或执行 walkthrough；这不改变任何 class/function signature、member name 或 state-dict key。本章以下代码假定已完成这个无 API 变化的整理。',
            ),
          ],
          'principle',
        ),
        code(
          'python',
          `# week11_training_and_generation.py
# This Week 11 caller imports the frozen Week 10 implementation.
import math

import torch
import torch.nn.functional as F

from mini_gpt_walkthrough import (
    GPTConfig,
    MiniGPT,
    load_mini_gpt_for_inference,
    save_mini_gpt_training_checkpoint,
    validate_checkpoint_tokenizer_identity,
)


CANONICAL_ORDERED_TOKENS = ("我", "喜欢", "AI", "学习", "猫")
CANONICAL_TOKENIZER_POLICY = (
    "whitespace-delimited;no-specials;no-pad;no-unk"
)
CANONICAL_TOKENIZER_VERSION = "mini-gpt-v1"`,
          'week11_training_and_generation.py',
        ),
        table(
          ['phase', '输入与用途', '允许改变的 state', '明确禁止'],
          [
            [
              'training',
              'inputs [3,2] + targets [3,2]；拟合训练 split',
              'backward 改 .grad；step 改 θ 与 AdamW state',
              '不能只评分最后位置',
            ],
            [
              'validation',
              'held-out inputs/targets；读取 current θ 并测量',
              '暂时改变 module mode，再恢复；不改 θ/optimizer',
              '不能 backward 或 step',
            ],
            [
              'checkpointing',
              'save 读取并持久化 parameters、optimizer、config、tokenizer、progress；load 验证后恢复',
              'model/optimizer load_state_dict 明确替换长期 values；不是 learning update',
              '不能用相同 shape 代替 identity validation',
            ],
            [
              'inference',
              'target-free prompt；逐轮追加一个 ID',
              'caller 的 uncropped history 增长',
              '不创建 loss、backward 或 step',
            ],
          ],
        ),
        table(
          ['state', 'owner', '何时改变', '谁读取或持久化'],
          [
            [
              'parameters θ',
              'model',
              'optimizer.step() 学习更新；model.load_state_dict() 显式恢复',
              'training、validation、inference 读取；checkpoint save 持久化',
            ],
            [
              'parameter.grad',
              '各 parameter',
              'backward 累加；zero_grad 清除',
              'optimizer.step() 读取；canonical checkpoint 不保存 transient .grad',
            ],
            [
              'AdamW moments / counters',
              'optimizer',
              'optimizer.step() 学习更新；optimizer.load_state_dict() 显式恢复',
              'training step 读取/更新；checkpoint save 持久化供 faithful resume',
            ],
            [
              'completed_updates',
              'training caller',
              '每次成功 optimizer.step() 后加 1；checkpoint load 恢复',
              'logging/checkpoint save；resume 再与 AdamW step state 核对',
            ],
            [
              'GPTConfig / tokenizer identity',
              'model / data caller',
              '本 run 内冻结；load 先验证 canonical values，再构造 matching objects',
              '所有 phase 依赖；checkpoint save 明确持久化',
            ],
            [
              'activations / loss value / training graph',
              '当前 forward',
              'forward 建立 values；只有 grad-enabled training 建 graph',
              'training/validation 当前计算；checkpoint 不持久化',
            ],
          ],
        ),
        paragraph(
          '“只有 optimizer.step() 执行 learning update”仍然成立：load_state_dict() 也会替换 model/optimizer values，但那是显式 restoration，不是从当前 batch error 学习。Checkpoint save 读取并持久化 parameters、optimizer、config、tokenizer 与 progress；faithful load 先验证 config/tokenizer identity，再用已保存值替换 parameters、optimizer state 与 progress。',
        ),
        chain([
          'training：forward [3,2] → logits [3,2,5] + loss [] → backward → step',
          'validation：held-out forward → token-loss sum / valid-token count；没有 update',
          'checkpointing：验证并保存/恢复同一套 identity 与 long-lived state',
          'inference：prompt → last logits [B,5] → next_id [B,1] → append history',
        ]),
        formula(
          String.raw`f_{\theta}:\mathbb{N}^{B\times T}\to\mathbb{R}^{B\times T\times5},\qquad B\ge1,\quad1\le T\le2`,
          'General canonical forward 接受可变正 batch size B 与一到两个 context positions，并为每个位置输出五个 logits。',
        ),
        paragraph(
          '固定 Week 6/11 training batch 才取 B=3、T=2，因此其一次 forward 是 [3,2]→[3,2,5]，也就是 30 个 raw scores，而不是一句自动生成的文字。Inference 可以是 [1,2]→[1,2,5]，validation 则是 [B_i,T_i]→[B_i,T_i,5]。Validation 与 inference 都应使用 no-grad，但前者有 held-out targets 并聚合 loss，后者没有 targets 且只消费当前最后位置的分布。',
        ),
        formula(
          String.raw`\theta\leftarrow\operatorname{AdamW}(\theta,\nabla_{\theta}\mathcal L)\quad\text{is the only learning update}`,
          'Checkpoint load 可以恢复参数值，但只有 training 的 optimizer step 从 batch gradient 执行学习更新。',
        ),
      ],
      [
        'model.eval() 只切换 module behaviour，不会关闭 Autograd。',
        'torch.no_grad() 不会替你把 Dropout 或 BatchNorm 切到 evaluation mode。',
        '保存一份 model tensor 文件不等于能延续 AdamW；faithful resume 还需要 optimizer state 与 completed_updates。',
        'Checkpointing 本身不会让模型变好；load 只是有意恢复已保存的 state。',
      ],
      check('四种工作里，哪一种可以调用 optimizer.step() 来学习？', [
        paragraph(
          '只有 training。Validation 和 inference 只读取当前参数；checkpoint save 不更新，checkpoint load 只恢复明确保存且验证过的长期 state。',
        ),
      ]),
    ),
    section(
      'o0380-1-batch',
      '1. 一个 Batch 提供六个训练信号',
      '把 inputs [3,2] 口头叫作“三个样本”会漏掉语言模型在每个有效位置都有 target，也容易误把一次并行 forward 想成六次独立调用。',
      [
        '连接 batch、teacher forcing、位置级分类与 flattening。',
        '固定 B、T、C、V 的 axis 含义，并展示六个 logit rows 与六个 target IDs 怎样一一对齐。',
      ],
      [
        paragraph(
          '直白地说，一个 batch 把多行 independent sequences 同时交给模型；teacher forcing 在每个位置使用真实左侧 token，所以一次 forward 同时回答六道 next-token 题。这里 B=3 是 batch rows，N=3 是 shift 前每行 raw IDs 数，T=2 是每行 teacher-forced positions，C=4 是每个位置的 representation width，V=5 是每道题的 candidate 数。',
        ),
        table(
          ['ID', 'token'],
          vocabularyRows,
          '唯一 vocabulary：mini-gpt-v1，V=5',
        ),
        code(
          'python',
          `raw_ids = torch.tensor([
    [0, 1, 2],  # 我 喜欢 AI
    [4, 1, 0],  # 猫 喜欢 我
    [0, 3, 2],  # 我 学习 AI
], dtype=torch.long)  # [B,N] = [3,3]

inputs = raw_ids[:, :-1]   # [[0,1],[4,1],[0,3]]，shape [3,2]
targets = raw_ids[:, 1:]   # [[1,2],[1,0],[3,2]]，shape [3,2]

assert inputs.shape == targets.shape == (3, 2)
assert inputs.dtype == targets.dtype == torch.long`,
          'week11_training_and_generation.py',
        ),
        table(
          ['位置', '可见 causal context', 'target', '对应五个 scores'],
          batchSignalRows,
          'row-major flatten 顺序：先 b=0 的两个位置，再 b=1，最后 b=2',
        ),
        paragraph(
          '实际用途是让 accelerator 并行计算，并让一次 gradient estimate 汇总六个监督信号。logits[b,t,:] 始终按 [我, 喜欢, AI, 学习, 猫] 排列五个 raw scores；targets[b,t] 是其中正确 class 的一个 long ID，不是 one-hot vector。',
        ),
        chain([
          'raw IDs [B,N] = [3,3]',
          'shift → inputs [3,2] 与 targets [3,2]',
          'MiniGPT token + position representations [3,2,4]',
          'two pre-norm Blocks + final_norm + lm_head → logits [3,2,5]',
          'row-major reshape → logits [6,5] 与 targets [6]',
          '六个 per-position NLL 的 mean → scalar loss []',
        ]),
        formula(
          String.raw`\mathcal L=-\frac{1}{BT}\sum_{b=1}^{B}\sum_{t=1}^{T}\log p_{\theta}(y_{b,t}\mid x_{b,\le t}),\qquad B T=3\cdot2=6`,
          '平均六道 next-token 分类题；每道题都使用对应位置的 causal left context。',
        ),
        paragraph(trainingShapeSpine),
        callout(
          '一个重要伏笔',
          [
            paragraph(
              '六个 labels 不等于六个彼此可区分的 contexts：b=0,t=0 与 b=2,t=0 都只有 [我]，targets 却分别是 喜欢 和 学习。第 11 节会因此得到非零的 irreducible one-batch loss。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'F.cross_entropy 的 target 应是 torch.long class IDs，不是 one-hot vectors。',
        'Training 要评分全部六个有效位置；logits[:,-1,:] 是 generation 当前轮的选择规则。',
        'reshape 必须让 logits 与 targets 保持相同 row-major 顺序。',
        'Batch rows 彼此独立；不要让 attention 跨 B axis 混合。',
      ],
      check('这个 batch 为什么提供六个 target labels，而不是三个？', [
        paragraph(
          '因为 B=3 行且每行 T=2 个 shifted next-token positions，所以 B×T=6；它们在一次 forward 中并行得到六个五分类 logits rows。',
        ),
      ]),
    ),
    section(
      'o0381-2-step-epoch',
      '2. Step、Microbatch 与 Epoch：先给训练进度单位',
      '“训练 100 次”没有说明是看过 100 个 batches、完成 100 次 parameter updates，还是遍历数据 100 轮，日志与 checkpoint progress 因而可能产生 off-by-one 或误读。',
      [
        '把 microbatch、optimizer step、epoch 与 completed_updates 分开命名。',
        '说明 gradient accumulation 为什么会让 forward/backward 次数多于 parameter update 次数。',
      ],
      [
        paragraph(
          '直白地说，microbatch 是一次装得进 memory 的数据切片；optimizer step 是一次实际参数更新；epoch 是完整走过 training loader 一遍。本周固定三句语料若作为一个 batch 且 accumulation_steps=1，一轮 epoch 恰好有一个 step，但这只是极小示例，不是定义。',
        ),
        table(
          ['单位', '发生什么', 'Week 11 如何计数'],
          [
            [
              'microbatch',
              '一次 forward + backward contribution',
              '不自动等于 update',
            ],
            [
              'optimizer step',
              '读取当前 accumulated gradients 并更新 state',
              'completed_updates 加 1',
            ],
            ['epoch', 'training batches 完整遍历一次', '可能含许多 updates'],
            [
              'generation iteration',
              'sample 并 append 一个 ID',
              '不是 training step',
            ],
          ],
        ),
        callout(
          '数字例子',
          [
            paragraph(
              '真实 training loader 若有 120 个同权 microbatches：accumulation_steps=1 时一轮有 120 updates，3 epochs 有 360 updates；accumulation_steps=4 且 120 可整除 4 时，一轮仍看完 120 batches，却只有 30 updates。',
            ),
          ],
          'example',
        ),
        formula(
          String.raw`N_{\mathrm{updates/epoch}}=\frac{N_{\mathrm{microbatches}}}{N_{\mathrm{accumulation}}}=\frac{120}{4}=30`,
          '本周实现预先要求 microbatch 数可被 accumulation_steps 整除，因此没有含糊的 partial window。',
        ),
        paragraph(
          'Shape 仍是每个固定 microbatch 的 [3,2]→[3,2,4]→[3,2,5]→[6,5]+[6]→[]；epoch 只改变这条计算被重复多少次，不改变 tensor rank。Checkpoint 的 completed_updates 记录已经执行完的 optimizer.step() 次数，而不是零起始 loop index 或下一步编号。',
        ),
      ],
      [
        '每次 forward/backward 不一定是一个 step；accumulation 可让四次 backward 共用一次 step。',
        '没有新 backward 的 step 没有本轮新 gradient 可读。',
        'Epoch 只是数据遍历单位，不保证 loss 改善。',
        '不要用含糊的 step=99 表示究竟完成了 99 还是 100 次 updates。',
      ],
      check(
        '120 个 microbatches 以每四个完整累积窗口更新一次，一轮 epoch 有多少 optimizer steps？',
        [
          paragraph(
            '30 次；120 次 forward/backward contributions 被分成 30 个 update windows。',
          ),
        ],
      ),
    ),
    section(
      'o0384-3-adamw',
      '3. 为什么常用 AdamW：Optimizer 也拥有长期 State',
      '如果把 optimizer 当作“parameter 减去 learning rate 乘 gradient”的无状态按钮，就会漏掉 AdamW 为每个参数元素保存的历史，也会误以为只加载 model weights 就能原样续训。',
      [
        '从 plain gradient descent 过渡到 AdamW 的 first/second moments 与 decoupled weight decay。',
        '把 optimizer state 的 owner、shape、创建时机和 checkpoint 需求说清楚。',
      ],
      [
        paragraph(
          '直白地说，AdamW 不只看当前 gradient g_t；它为每个 parameter coordinate 维护一阶 moving average m_t 与平方 gradient 的 moving average v_t，再用它们调节 update scale。weight decay 另行轻微收缩 weights。它适合 noisy、scale 差异大的 language-model gradients，但仍需要选择 learning rate。',
        ),
        code(
          'python',
          `device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)
model = MiniGPT(GPTConfig()).to(device)
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-2,
)`,
          'week11_training_and_generation.py',
        ),
        paragraph(
          '先把 model 移到目标 device，再把这些 parameter objects 交给 AdamW。构造 optimizer 时 param groups 已存在；第一次有 gradient 的 optimizer.step() 才建立并更新相应 moment tensors 与 counters。optimizer.zero_grad() 只处理 parameter.grad，不会清空 m、v 或 step history。',
        ),
        formula(
          String.raw`m_t=\beta_1m_{t-1}+(1-\beta_1)g_t`,
          '一阶 moment 平滑近期 gradient direction。',
        ),
        formula(
          String.raw`v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2`,
          '二阶 moment 平滑逐元素平方 gradient magnitude。',
        ),
        formula(
          String.raw`\theta_t=(1-\eta\lambda)\theta_{t-1}-\eta\frac{\widehat m_t}{\sqrt{\widehat v_t}+\varepsilon}`,
          'eta 是 learning rate，lambda 是 decoupled weight decay；省略了实现细节但保留两种 state change。',
        ),
        table(
          ['对象', '示例 shape', '谁改变它'],
          [
            ['token_embedding.weight', '[5,4]', 'optimizer.step()'],
            [
              'token_embedding.weight.grad',
              '[5,4]',
              'backward 累加；zero_grad 清除',
            ],
            ['对应 AdamW m 与 v', '各 [5,4]', 'optimizer.step()'],
            ['当前 logits / loss', '[3,2,5] / []', 'forward 重新计算'],
          ],
          'parameter、gradient 与 AdamW moments 对同一 weight tensor 具有相同 element-wise shape',
        ),
      ],
      [
        'AdamW 不是 loss function，也不会在 gradients 不存在时自己学习。',
        'zero_grad 不会重置 optimizer moments；要开始一条全新 optimizer trajectory 必须明确重建 optimizer。',
        '改变 learning rate 不会直接 reshape logits，它通过未来 parameter updates 间接改变 logits values。',
        '只恢复 model_state 而丢失 optimizer state 只能开始新的 optimizer history，不能叫 faithful resume。',
      ],
      check('为什么 faithful resume 必须恢复 AdamW state？', [
        paragraph(
          '因为 m、v 与 step counters 参与下一次 update；丢掉它们后即使 parameters 相同，后续 trajectory 也不再是原训练过程的连续延伸。',
        ),
      ]),
    ),
    section(
      'o0387-4-training-step',
      '4. 一个标准 Training Step：逐行追踪 State',
      '背诵“zero、forward、backward、step”无法解释少一行或换顺序为何出错，也无法判断 loss、gradient、parameter 与 AdamW history 在某一刻分别是什么状态。',
      [
        '给出驱动 Week 10 MiniGPT 的可执行 one-update function。',
        '按执行顺序说明 train mode、device、zeroing、forward、loss、backward、clipping、step 与 detached logging。',
      ],
      [
        paragraph(
          '直白地说，一个 training step 把一个 batch 的监督误差变成一次 parameter update。以下函数属于 week11_training_and_generation.py，并直接使用导入的 canonical MiniGPT；它没有重定义 config、attention、blocks、initializer 或 state-dict names。',
        ),
        code(
          'python',
          `def train_mini_gpt_step(
    model: MiniGPT,
    optimizer: torch.optim.Optimizer,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    max_grad_norm: float = 1.0,
    completed_updates: int = 0,
) -> tuple[torch.Tensor, torch.Tensor, int]:
    if not math.isfinite(max_grad_norm) or max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be positive")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")

    model.train()
    inputs = inputs.to(device)
    targets = targets.to(device)
    optimizer.zero_grad(set_to_none=True)
    logits, loss = model(inputs, targets)
    assert logits.shape == (3, 2, 5)
    assert loss is not None
    loss.backward()
    grad_norm = torch.nn.utils.clip_grad_norm_(
        model.parameters(),
        max_norm=max_grad_norm,
    )
    optimizer.step()
    completed_updates += 1  # only after optimizer.step succeeds
    return loss.detach(), grad_norm.detach(), completed_updates`,
          'week11_training_and_generation.py',
        ),
        table(
          ['line', '立即改变或创建什么', '为什么必须在这里'],
          [
            [
              'model.train()',
              '递归设置 module training flags',
              '在 forward 前选择 training behaviour；不更新 weights',
            ],
            [
              'inputs/targets.to(device)',
              '创建或返回共置的 batch tensors',
              'CPU batch 不能直接乘 CUDA parameters',
            ],
            [
              'optimizer.zero_grad(set_to_none=True)',
              '清除旧 .grad references',
              '防止本 step 与上个 window 的 gradients 意外相加',
            ],
            [
              'model(inputs, targets)',
              '创建 activations/graph、logits [3,2,5]、loss []',
              'parameters 与 AdamW state 仍未改变',
            ],
            [
              'loss.backward()',
              '把 ∂L/∂θ 累加到 parameter.grad',
              'step 必须先拥有当前 gradients',
            ],
            [
              'clip_grad_norm_',
              '必要时原地缩放全部 gradient tensors',
              '在所有 intended backward 后、step 前限制 norm',
            ],
            [
              'optimizer.step()',
              '改变 parameter values、AdamW moments/counters；成功返回后 caller count 加 1',
              '这是唯一真正学习的一行',
            ],
            [
              'loss.detach()',
              '返回与 graph 分离的 logging tensor',
              '避免日志留住已经用完的 graph',
            ],
          ],
        ),
        chain([
          'inputs/targets [3,2] on model device',
          'forward → representations [3,2,4] → raw logits [3,2,5]',
          'reshape [6,5] + [6] → scalar loss []',
          'backward → one .grad tensor per participating parameter',
          'clip complete gradient set → optimizer.step()',
          'same parameter shapes, new parameter values and AdamW state',
        ]),
        formula(
          String.raw`\mathcal L=\operatorname{CE}(\mathrm{logits.reshape}(6,5),\mathrm{targets.reshape}(6))\in\mathbb{R}`,
          'loss 是 rank-0 scalar；backward 由它产生与各 parameter 自身 shape 一致的 gradients。',
        ),
        paragraph(
          '参数更新可概念化为 θ←θ+Δθ，但这不会 retroactively 改写刚才 forward 的 inputs、targets 或 logits。下一次 forward 才会使用新 θ 计算新 logits。',
        ),
      ],
      [
        '把 zero_grad 放到 backward 之后、step 之前会擦掉刚算好的 gradients。',
        '把 step 放在 backward 前会读到 None、zero 或 stale gradients。',
        'model.train() 不会启用一次 update，也不会清除 gradients。',
        'F.cross_entropy 接收 raw logits；不要在 model loss path 前先 Softmax。',
        'Clipping 必须发生在完整 gradient 已累积之后、optimizer 读取之前。',
      ],
      check(
        'loss.backward() 已执行而 optimizer.step() 尚未执行时，什么 state 是新的？',
        [
          paragraph(
            '各 participating parameters 的 .grad 已被写入或累加；parameter values 与 AdamW moments 仍是 step 之前的旧 state。',
          ),
        ],
      ),
    ),
    section(
      'o0389-5-training-loop',
      '5. 完整 Training Loop：安全地累积完整窗口',
      '一个 step 还不是训练过程；重复 batches 时，如果没有先决定 accumulation window、loss scaling、zeroing、clipping、update counting 与空 loader 行为，循环可能在报错前留下半窗口 gradients。',
      [
        '把 backward 默认累加变成有意设计的 gradient accumulation。',
        '在任何 model/gradient/optimizer mutation 之前验证空输入与窗口整除性，并准确返回 completed update 数。',
      ],
      [
        paragraph(
          '直白地说，backward 会把新 gradient contribution 加进现有 .grad；这既支持一个 parameter 在 graph 中多次贡献，也允许若干 microbatches 共同形成一个 effective batch。只有当 loss scaling、zeroing 与 step boundary 全部配套时，这种累加才是故意的。',
        ),
        code(
          'python',
          `def train_mini_gpt_epoch(
    model: MiniGPT,
    optimizer: torch.optim.Optimizer,
    train_batches,
    device: torch.device,
    accumulation_steps: int = 1,
    completed_updates: int = 0,
) -> tuple[int, float]:
    if type(accumulation_steps) is not int or accumulation_steps < 1:
        raise ValueError("accumulation_steps must be a positive integer")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")

    # Validate all batches before touching model mode, gradients, or optimizer.
    batches = list(train_batches)
    if not batches:
        raise ValueError("train_batches must not be empty")
    if len(batches) % accumulation_steps != 0:
        raise ValueError(
            "train_batches must form complete accumulation windows"
        )

    reference_shape = None
    reference_target_count = None
    for batch_number, batch in enumerate(batches, start=1):
        if not isinstance(batch, (tuple, list)) or len(batch) != 2:
            raise TypeError(f"batch {batch_number} must be (inputs, targets)")
        inputs, targets = batch
        if not isinstance(inputs, torch.Tensor) or not isinstance(
            targets,
            torch.Tensor,
        ):
            raise TypeError(f"batch {batch_number} values must be tensors")
        if inputs.ndim != 2 or targets.shape != inputs.shape:
            raise ValueError(
                f"batch {batch_number} inputs/targets must share [B,T]"
            )
        if inputs.dtype != torch.long or targets.dtype != torch.long:
            raise TypeError(
                f"batch {batch_number} inputs/targets must be torch.long"
            )
        target_count = targets.numel()
        if target_count <= 0:
            raise ValueError(f"batch {batch_number} has no target tokens")
        if not 1 <= inputs.size(1) <= model.config.block_size:
            raise ValueError(f"batch {batch_number} has invalid T")
        for name, token_ids in (("inputs", inputs), ("targets", targets)):
            if (
                int(token_ids.min().item()) < 0
                or int(token_ids.max().item()) >= model.config.vocab_size
            ):
                raise ValueError(
                    f"batch {batch_number} {name} IDs are outside vocabulary"
                )

        if reference_shape is None:
            reference_shape = inputs.shape
            reference_target_count = target_count
        elif (
            inputs.shape != reference_shape
            or target_count != reference_target_count
        ):
            raise ValueError(
                "this teaching helper requires equal-token microbatches"
            )

    model.train()
    optimizer.zero_grad(set_to_none=True)
    detached_loss_sum = 0.0

    for window_start in range(0, len(batches), accumulation_steps):
        window = batches[
            window_start : window_start + accumulation_steps
        ]
        for inputs, targets in window:
            inputs = inputs.to(device)
            targets = targets.to(device)
            logits, loss = model(inputs, targets)
            assert logits.shape[-1] == model.config.vocab_size
            assert loss is not None
            (loss / accumulation_steps).backward()
            detached_loss_sum += loss.detach().item()

        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            max_norm=1.0,
        )
        optimizer.step()
        completed_updates += 1  # only after optimizer.step succeeds
        optimizer.zero_grad(set_to_none=True)

    mean_microbatch_loss = detached_loss_sum / len(batches)
    return completed_updates, mean_microbatch_loss`,
          'week11_training_and_generation.py',
        ),
        paragraph(
          '这个教学 helper 明确只支持 equal-token microbatches。它先 materialize 全部输入，并在 model.train() 或 zero_grad() 之前验证：非空、完整 accumulation windows、每项确实是 input/target tensors、两者 shape 相同且所有 batches 共享同一 [B,T] shape、dtype 都是 torch.long、target count 相同且大于零、T 与 IDs 合法。于是 loss/accumulation_steps 的 gradient 与 mean_microbatch_loss 都恰好是按 tokens 等权的结果。',
        ),
        paragraph(
          '空 iterator 会得到清晰错误；7 个 microbatches 配 accumulation_steps=4，或混入较短/较小 batch，也会在任何 model/mode/gradient/optimizer mutation 前拒绝，不会残留 partial gradients。大型、无限或 variable-token stream 不适合这个教学 helper；production code 应按 window 的 token-loss sum 除以 valid-token 总数，或使用已知长度且等大小的 sampler/drop_last。',
        ),
        callout(
          '固定例子：四个等大小 microbatches',
          [
            paragraph(
              '每个 microbatch 都复用同一 shape contract [3,2,5]→[6,5]+[6]→[]，各 loss 都是六个 labels 的 mean。除以 4 后做四次 backward，它们的 contributions 相加；随后只 clip 一次、step 一次。Week 6 单 batch 配 accumulation_steps=1 则六个 labels 产生一个 update。',
            ),
          ],
          'example',
        ),
        formula(
          String.raw`g_{\mathrm{window}}=\sum_{i=1}^{4}\nabla_{\theta}\!\left(\frac{\mathcal L_i}{4}\right)=\frac{1}{4}\sum_{i=1}^{4}\nabla_{\theta}\mathcal L_i`,
          '四个同样含六个有效 targets 的 microbatch means 被等权平均，形成一个 24-position effective batch 的 mean-gradient。',
        ),
        table(
          ['window 时刻', '.grad', 'parameters / AdamW state'],
          [
            ['zero_grad 后', 'None', '不变'],
            ['第 1–3 次 backward 后', '逐次累加 partial window', '不变'],
            ['第 4 次 backward + clip 后', '完整且可能已缩放', '仍不变'],
            ['optimizer.step 后', '仍存在，直到下一行清除', '两者更新一次'],
            [
              'step 成功返回后',
              '同一完整 window 已消费',
              'completed_updates 才加 1',
            ],
            [
              '随后 zero_grad 后',
              'None，下一窗口干净开始',
              '保留刚更新的长期 state',
            ],
          ],
        ),
      ],
      [
        '漏掉 /accumulation_steps 会把四个等权 mean losses 的 gradient scale 放大约四倍。',
        '每个 microbatch 内 zero_grad 会抹掉前面的 contributions，完全破坏 accumulation。',
        '在最后一次 intended backward 之前 clipping 只限制了不完整 gradients。',
        '不能在循环之后读取可能从未赋值的 micro_step；空 iterator 必须有显式 guard。',
        '不能先积累 partial window 再 raise；本实现先检查整除性，尚未触碰 model 或 optimizer。',
        '不能把 unequal-token microbatch means 等权累加；本 helper 会在任何 mutation 前拒绝这种输入。',
      ],
      check('为什么 accumulation loop 在 optimizer.step() 后才 zero_grad？', [
        paragraph(
          '窗口内所有 equal-token microbatches 必须共享并累加 gradients；step 读完完整窗口后，completed_updates 才加 1，再清除 .grad，使下一窗口干净开始。',
        ),
      ]),
    ),
    section(
      'o0390-6-loss',
      '6. 初始 Loss 的参照：从均匀五选一推导 ln(5)',
      '没有基线时，看到 random model 的 loss≈1.6 容易误判为训练失败，也容易把一个理论参照当成每次初始化都必须精确命中的断言。',
      [
        '从正确 token 的均匀概率 1/5 推导 natural-log cross-entropy。',
        '把理论 baseline、实际随机初始化与后续 one-batch 可达下界分开。',
      ],
      [
        paragraph(
          '直白地说，cross-entropy 衡量模型给真实 target 留了多少 probability。若每道五分类题的 logits 都是 [0,0,0,0,0]，Softmax 在候选顺序 [我, 喜欢, AI, 学习, 猫] 上就是 [0.2,0.2,0.2,0.2,0.2]；无论 target 是 喜欢 还是 AI，正确项都只拿到 0.2。',
        ),
        formula(
          String.raw`p_{\mathrm{uniform}}(y)=\frac{1}{V}=\frac{1}{5}=0.2`,
          '五个候选等概率时，任一真实 target 的 probability 都是 0.2。',
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{uniform}}=-\ln\!\left(\frac{1}{V}\right)=\ln(V)=\ln(5)\approx1.609`,
          'PyTorch cross-entropy 使用 natural logarithm，因此均匀五分类的每位置 NLL 约为 1.609。',
        ),
        formula(
          String.raw`-\sum_{i=1}^{5}q_i\ln\!\left(\frac{1}{5}\right)=\ln(5)`,
          'one-hot target distribution q 只有正确 class 一项为 1，所以总和仍是 ln(5)。',
        ),
        table(
          ['量', '固定 batch 中的含义', 'shape / value'],
          [
            ['raw equal logits', '六道题各一行 [0,0,0,0,0]', '[6,5]'],
            ['uniform probabilities', '每行五项都是 0.2', '[6,5]'],
            ['per-position NLL', '六项各约 1.609', '[6]'],
            ['mean CE', '六项 mean', 'scalar []，约 1.609'],
          ],
        ),
        paragraph(
          `实际用途是为 loss 曲线提供数量级参照，而不是 pass/fail threshold。随机 initialization 的 logits 不会恰好全零，所以第一次 loss 可略高或略低于 1.609。${trainingShapeSpine}`,
        ),
        callout(
          '别把 20% 误当所有情形的准确率基线',
          [
            paragraph(
              '均匀抽样单次命中任一指定 target 的概率是 1/5=20%；但 dataset labels 不平衡时，固定预测多数类的 accuracy baseline 会不同。训练直接优化的是 mean NLL。',
            ),
          ],
          'concept',
        ),
      ],
      [
        '1.609 是 exact uniform distribution 的值，不保证 random initializer 第一次恰好得到它。',
        'PyTorch CE 使用 ln，不是 base-10 logarithm。',
        '只有使用相同 vocabulary、valid-token reduction 与 split，两个 loss 数字才可公平比较。',
        '低于 ln(5) 表示训练题上正确 labels 获得了更多 probability，不自动证明 held-out text 有用。',
      ],
      check(
        '五 token vocabulary 中，模型给真实 target 概率 0.2 时 per-position CE 是多少？',
        [paragraph('-ln(0.2)=ln(5)≈1.609。')],
      ),
    ),
    section(
      'o0391-7-validation',
      '7. Validation 为什么必要：测量没有参与 Update 的数据',
      'Training loss 会因为模型反复看到同一批 labels 而下降；只看它无法判断模型是否学到能迁移到未见 examples 的规律。',
      [
        '把 held-out measurement 与 gradient-producing training 分开。',
        '用 train/validation 曲线组合给出下一步诊断，而不是把一条曲线当结论。',
      ],
      [
        paragraph(
          '直白地说，training split 用来选择 gradients，validation split 只用来观察当前 parameters。它们使用相同 tokenizer、input/target alignment 与 CE 定义，但数据来源不同；validation 结果可帮助选择 checkpoint、停止点、learning rate 或容量，却绝不能对这个 batch backward。',
        ),
        callout(
          '固定三句只用于 shape 演示',
          [
            paragraph(
              '我 喜欢 AI / 猫 喜欢 我 / 我 学习 AI 总共只有三行，太小而无法建立可信 held-out estimate。可以把其 [3,2]→[3,2,5] shape 放进 validation 函数讲 API，但如果已经用这三行训练，就必须称其为 same-corpus scoring，绝不能称 held-out validation。真实 workflow 应先按原始 documents/examples 分 split，再分别创建 windows，避免近重复窗口泄漏。',
            ),
          ],
          'principle',
        ),
        table(
          [
            'train loss',
            'held-out validation loss',
            '较合理的解读',
            '下一项直接检查',
          ],
          [
            [
              '下降且两者保持接近',
              '也下降',
              '该 split 上的 generalization 在改善',
              '继续看 samples 与 checkpoints',
            ],
            [
              '持续下降',
              '持续上升',
              '开始过拟合 training data',
              '较早 checkpoint、更多数据/regularization 或较小模型',
            ],
            [
              '长期近 ln(5)',
              '也近 ln(5)',
              'underfit 或 signal/update broken',
              'one-batch diagnostic、targets、gradients、LR',
            ],
            [
              '剧烈波动或非有限',
              '同样不稳',
              'data/numerical/update instability',
              '定位第一处 non-finite，检查 LR 与 grad norm',
            ],
          ],
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{train}}=\frac{\sum_{i\in\mathcal D_{\mathrm{train}}}\ell_i}{N_{\mathrm{train}}},\qquad \mathcal L_{\mathrm{val}}=\frac{\sum_{j\in\mathcal D_{\mathrm{val}}}\ell_j}{N_{\mathrm{val}}}`,
          '两个 split 都按有效 target tokens 加权；只有 training loss 对参数求 gradient。',
        ),
        paragraph(
          '每个 validation batch 仍从 inputs [B_i,T_i] 产生 logits [B_i,T_i,5]，再对有效 targets 求 loss；B_i 可以不同，T_i 必须在 1..block_size=2。跨 batch 汇总时要把 token-level loss sums 相加后除以有效 target 总数，不能把大小不同的 batch means 等权平均。',
        ),
      ],
      [
        'Validation loss 绝不能 backward 或 optimizer.step。',
        '训练过的固定三句再评分只能叫 training/same-corpus score。',
        '先生成高度重叠 windows 再随机 split 会造成 information leakage。',
        '一个很小的 validation split 波动大，单点变化不足以下结论。',
        '阅读生成 sample 有帮助，但不能代替 token-weighted held-out loss。',
      ],
      check(
        'Training loss 继续下降而 held-out validation loss 持续上升，最直接的担忧是什么？',
        [
          paragraph(
            '过fit：模型越来越贴合 training examples，但在未参与更新的 validation data 上变差。',
          ),
        ],
      ),
    ),
    section(
      'o0393-8-validation',
      '8. 正确的 Validation：Mode、No-Grad 与 Token Weighting',
      'Validation 很容易同时犯三类错误：仍使用 stochastic training behaviour、仍建立 Autograd graph，以及把不同有效 token 数的 batch means 等权平均。',
      [
        '独立控制 model.eval() 与 torch.no_grad()，并在任何退出路径恢复先前 mode。',
        '用 reduction=sum 累加有效 token loss，再除以有效 target 总数；安全处理 empty 与 all-masked input。',
      ],
      [
        paragraph(
          '直白地说，eval() 决定 layers 怎样运行，no_grad() 决定是否记录 backward graph；两者解决不同问题。Token-weighted aggregation 则确保含 6 个 targets 的 batch 对总 loss 的贡献是含 2 个 targets batch 的三倍，而不是两者各占一半。',
        ),
        code(
          'python',
          `def evaluate_mini_gpt_loss(
    model: MiniGPT,
    validation_batches,
    device: torch.device,
    ignore_index: int = -100,
) -> float:
    if 0 <= ignore_index < model.config.vocab_size:
        raise ValueError("ignore_index must not be a vocabulary ID")

    was_training = model.training
    batch_count = 0
    valid_target_count = 0
    loss_sum = 0.0
    model.eval()
    try:
        with torch.no_grad():
            for inputs, targets in validation_batches:
                batch_count += 1
                if targets.shape != inputs.shape:
                    raise ValueError("targets must match inputs shape")
                if targets.dtype != torch.long:
                    raise TypeError("targets must have dtype torch.long")

                inputs = inputs.to(device)
                targets = targets.to(device)
                valid_mask = targets.ne(ignore_index)
                batch_valid_count = int(valid_mask.sum().item())
                if batch_valid_count == 0:
                    continue

                valid_targets = targets[valid_mask]
                if (
                    int(valid_targets.min().item()) < 0
                    or int(valid_targets.max().item())
                    >= model.config.vocab_size
                ):
                    raise ValueError("valid target IDs are outside vocabulary")

                # Do not pass -100 targets into canonical MiniGPT.forward.
                logits, no_loss = model(inputs)
                assert no_loss is None
                batch_loss_sum = F.cross_entropy(
                    logits.reshape(-1, model.config.vocab_size),
                    targets.reshape(-1),
                    ignore_index=ignore_index,
                    reduction="sum",
                )
                loss_sum += batch_loss_sum.item()
                valid_target_count += batch_valid_count
    finally:
        model.train(was_training)

    if batch_count == 0:
        raise ValueError("validation_batches must not be empty")
    if valid_target_count == 0:
        raise ValueError("validation has no valid target tokens")
    return loss_sum / valid_target_count`,
          'week11_training_and_generation.py',
        ),
        paragraph(
          'Canonical MiniGPT 会拒绝 target ID -100，因此 masked validation 不能调用 model(inputs, targets)。这里先调用 model(inputs) 取得 raw logits，再在外部用 ignore_index 计算 summed CE。没有 padding 的普通 batch 也走同一 token-weighted path。try/finally 保证函数原来处于 train mode 就恢复 train，原来处于 eval mode 就保持 eval，即使 iterator 或 shape validation 抛错也不遗留 mode change。',
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{val}}=\frac{\sum_{m=1}^{M}\sum_{i\in\mathcal V_m}\ell_{m,i}}{\sum_{m=1}^{M}|\mathcal V_m|}`,
          'V_m 是第 m 个 batch 中 targets 不等于 ignore_index 的有效位置集合；分母是有效 token 总数。',
        ),
        table(
          [
            'batch',
            '有效 targets',
            'loss sum',
            '错误的 batch mean 权重',
            '正确 token 权重',
          ],
          [
            ['A', '6', '6.0', '1/2', '6/8'],
            ['B', '2', '6.0', '1/2', '2/8'],
            ['聚合', '8', '12.0', '(1.0+3.0)/2=2.0', '12.0/8=1.5'],
          ],
          'batch means 等权平均会在有效 token 数不同时产生偏差',
        ),
        chain([
          'remember was_training',
          'model.eval() + torch.no_grad()',
          'inputs [B_i,T_i] → logits [B_i,T_i,5]，不传 masked targets 给 model',
          'external CE reduction=sum over valid target IDs',
          'accumulate loss_sum and valid_target_count',
          'finally restore exact prior mode',
          'guard empty/all-masked → return token-weighted Python float',
        ]),
      ],
      [
        'eval() 本身仍可能建立 gradient graph；no_grad() 本身也不切换 Dropout/BatchNorm behaviour。',
        '不能平均 batch means，除非每个 batch 的有效 target 数完全相同且你明确依赖这一事实。',
        '不能把 -100 直接交给 canonical MiniGPT targets guard；masked loss 必须在外部计算。',
        'Empty iterator 与 all-masked batches 都没有可定义的 validation mean，必须明确报错。',
        '忘记恢复先前 mode 会让后续 training 悄悄以 evaluation behaviour 运行。',
      ],
      check(
        '哪一步防止 validation forward 建立 backward graph？eval() 是否能替代它？',
        [
          paragraph(
            'with torch.no_grad() 防止 graph recording；eval() 不能替代它，eval() 只切换注册 layers 的 train/eval behaviour。',
          ),
        ],
      ),
    ),
    section(
      'o0394-9-gradient-clipping',
      '9. Gradient Clipping：在 Update 前限制完整 Gradient',
      '某个 batch 产生的 gradient norm 可能突然很大，让实际 update 远超 learning-rate 直觉并造成 loss spike 或 non-finite values。',
      [
        '解释 global norm clipping 测量和缩放的是 gradients，不是 parameters。',
        '把 clipping 放在所有 intended backward 之后、唯一 optimizer.step() 之前。',
      ],
      [
        paragraph(
          '直白地说，把所有 parameter gradients 想成一个很长向量 g；若它的 L2 norm 超过 cap c，就把所有分量乘同一个比例，保留 direction 而限制 magnitude。实际用途是给异常大 update 加一道 guardrail，同时保留 grad_norm 日志帮助定位根因。',
        ),
        formula(
          String.raw`g=\operatorname{concat}(g_1,\ldots,g_n),\qquad g'=g\min\!\left(1,\frac{c}{\lVert g\rVert_2+\varepsilon}\right)`,
          'g_i 是第 i 个 parameter 的 gradient；每个 tensor clipping 后仍保持其原 shape。',
        ),
        table(
          ['raw global norm', 'cap c', '共同 scale', '结果'],
          [
            ['5.0', '1.0', '约 1/5', 'norm 降到约 1.0，direction 不变'],
            ['0.6', '1.0', '1', 'gradients 不变'],
          ],
        ),
        paragraph(
          '固定模型中 token_embedding.weight.grad 仍是 [5,4]，每个 block 的 qkv.weight.grad 仍是 [12,4]；clipping 没有 [B,T] activation shape。train_mini_gpt_step 中 clip_grad_norm_ 返回 pre-clip norm，可与 scalar loss 一起 detached logging。Accumulation 时必须等完整 window 的 contributions 都进入 .grad 后再 clip 一次。',
        ),
        code(
          'python',
          `def backward_and_clip_mini_gpt(
    model: MiniGPT,
    loss: torch.Tensor,
    max_grad_norm: float = 1.0,
) -> torch.Tensor:
    if loss.ndim != 0:
        raise ValueError("loss must be a scalar tensor")
    if not math.isfinite(max_grad_norm) or max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be finite and positive")

    loss.backward()
    grad_norm = torch.nn.utils.clip_grad_norm_(
        model.parameters(),
        max_norm=max_grad_norm,
    )
    return grad_norm.detach()


# Caller order inside one update window:
# optimizer.zero_grad(...) -> forward creates loss -> helper above
# -> optimizer.step() -> increment completed_updates`,
          'week11_training_and_generation.py',
        ),
      ],
      [
        'Clipping parameter values 与 clipping parameter.grad 是两种完全不同的操作。',
        'optimizer.step() 之后才 clipping 已经太晚。',
        '每一步都强烈 clipping 可能掩盖过高 LR、bad data 或 architecture error。',
        'Clipping 不能把已经为 NaN 的 gradients 修好；应定位第一处 non-finite value。',
      ],
      check('Gradient accumulation 时 clipping 应在哪一刻执行？', [
        paragraph(
          '完整窗口的最后一次 backward 之后、唯一一次 optimizer.step() 之前。',
        ),
      ]),
    ),
    section(
      'o0395-10-learning-rate',
      '10. Learning Rate：AdamW 仍需要全局步幅',
      'AdamW 会逐元素适配 gradient scale，但它仍需一个全局 learning rate；太小会像没有学习，太大可能把正确 gradient 变成破坏性 update。',
      [
        '把 LR 定位为 optimizer update 的 scale，而不是 epochs、sampling temperature 或目标 probability。',
        '用可观察症状引导诊断，同时要求先排除 target、gradient 与 data 问题。',
      ],
      [
        paragraph(
          '直白地说，lr 决定每次 optimizer.step() 大致走多远。它不直接修改当前 logits [3,2,5]，而是改变 θ，因而只在下一次 forward 间接改变 logits values。实际使用时应记录当前 lr、completed_updates、loss 与 grad norm，并一次只改变一个实验变量。',
        ),
        formula(
          String.raw`\theta_{u+1}=\theta_u+\Delta\theta_u(\eta,m_u,v_u,g_u)`,
          'u 是 completed update count，eta 是 learning rate；AdamW 的 update 还依赖当前 gradient 与 moments。',
        ),
        table(
          ['controlled-run symptom', '可能的 LR reading', '先做的检查'],
          [
            [
              'loss 多次 update 后仍近 ln(5)',
              '1e-6 可能太小',
              '确认 labels 对齐、grads 非 None、step 真执行',
            ],
            [
              'loss 下降平滑',
              '1e-3 在该 tiny run 可作为起点',
              '继续比较 held-out loss 与 samples',
            ],
            [
              'loss spike / oscillation',
              '可能太大',
              '查看 first bad update 与 pre-clip grad norm',
            ],
            [
              'loss 或 gradients 非有限',
              'update 可能失稳',
              '先定位第一个 NaN/Inf，再调整 LR',
            ],
          ],
        ),
        paragraph(
          '固定教学 run 使用 AdamW(..., lr=1e-3, weight_decay=1e-2)，但这不是所有模型的 magic value。比较 1e-6 与 1e-3 时必须固定 tokenizer、split、batch/accumulation policy、seed 与 update 数，否则差异不能归因给 LR。',
        ),
        callout(
          'Shape 不变，values 改变',
          [
            paragraph(
              'θ、gradient、m、v 与 Δθ 都保持每个 parameter 的固有 shape，例如 [5,4]；LR 不把 [3,2,5] 变成另一种 shape。它只缩放 update dynamics。',
            ),
          ],
          'concept',
        ),
      ],
      [
        '不要从单个 noisy batch 的一次 loss 诊断 LR。',
        '更小不自动更安全；小到没有可观察进展同样是失败模式。',
        '改变 batch size 或 accumulation 会改变 update regime，常需重新评估 LR。',
        'Sampling 的 τ 只处理 inference logits，与 optimizer learning rate 完全不同。',
      ],
      check('Controlled run 中什么现象可能提示 LR 太小？', [
        paragraph(
          '在确认 targets、grads 与 optimizer.step 都正确后，training loss 跨许多 completed updates 仍几乎停在约 ln(5) 的 baseline。',
        ),
      ]),
    ),
    section(
      'o0396-11-overfit-one-batch-test',
      '11. Overfit One Batch：先识别不可消除的标签冲突',
      'One-batch diagnostic 常被描述成“把所有 labels 记到 loss≈0”，但本固定 batch 的同一 causal context [我] 对应两个不同 targets；若忽略这一点，会把数学上不可能的目标误诊成 implementation bug。',
      [
        '用重复一个固定 batch 检查 data→forward→loss→backward→step 的 plumbing。',
        '推导 empirical conditional 的最优 0.5/0.5 与 mean NLL 下确界 ln(2)/3≈0.231，并选择可区分 contexts 做额外检查。',
      ],
      [
        paragraph(
          '直白地说，这个 diagnostic 问的是“完整监督路径能否明显学习”，而不是“模型是否 generalize”。反复使用 inputs [[0,1],[4,1],[0,3]] 与 targets [[1,2],[1,0],[3,2]] 后，loss 应从 random reference 约 ln(5) 明显下降，并朝该 batch 的 empirical conditional optimum 走；但不能要求 deterministic causal model argmax 正确预测全部六个 labels。',
        ),
        code(
          'python',
          `def overfit_mini_gpt_one_batch(
    model: MiniGPT,
    optimizer: torch.optim.Optimizer,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    updates: int = 200,
    completed_updates: int = 0,
) -> tuple[list[float], int]:
    if type(updates) is not int or updates < 1:
        raise ValueError("updates must be a positive integer")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")

    model.train()
    inputs = inputs.to(device)
    targets = targets.to(device)
    history: list[float] = []
    for _ in range(updates):
        optimizer.zero_grad(set_to_none=True)
        logits, loss = model(inputs, targets)
        assert logits.shape == (3, 2, 5)
        assert loss is not None and torch.isfinite(loss)
        loss.backward()
        optimizer.step()
        completed_updates += 1  # only after optimizer.step succeeds
        history.append(loss.detach().item())
    return history, completed_updates`,
          'week11_training_and_generation.py',
        ),
        table(
          [
            'position(s)',
            'causal context',
            'observed target(s)',
            'empirical optimum',
          ],
          [
            [
              'b=0,t=0 与 b=2,t=0',
              '[我]',
              '喜欢、学习',
              'P(喜欢|我)=0.5，P(学习|我)=0.5',
            ],
            ['b=0,t=1', '[我,喜欢]', 'AI', '该 row 可趋近给 AI probability 1'],
            ['b=1,t=0', '[猫]', '喜欢', '可趋近给 喜欢 probability 1'],
            ['b=1,t=1', '[猫,喜欢]', '我', '该 row 可趋近给 我 probability 1'],
            ['b=2,t=1', '[我,学习]', 'AI', '该 row 可趋近给 AI probability 1'],
          ],
          '重复上下文 [我] 在同一 position embedding t=0 下必须产生同一 distribution',
        ),
        formula(
          String.raw`\min_{p+q=1}\bigl[-\ln p-\ln q\bigr]=2\ln2\quad\text{at}\quad p=q=\frac12`,
          '同一 [我] distribution 要同时解释目标 喜欢 与 学习；经验条件分布在两者间各分一半 probability。',
        ),
        formula(
          String.raw`\inf\mathcal L_{\mathrm{batch}}=\frac{2\ln2+0+0+0+0}{6}=\frac{\ln2}{3}\approx0.231`,
          '若其余四个可区分 tasks 的 NLL 各趋近 0，mean NLL 只能趋近约 0.231；有限 logits/weights 不会真正给 probability 1，故通常不取到该下界。',
        ),
        chain([
          'same [我] prefix at t=0 → exactly one shared five-token distribution',
          'two conflicting labels → empirical mass 0.5 on 喜欢 and 0.5 on 学习',
          'four distinguishable contexts → correct-label probability can approach 1',
          'mean loss falls materially below ln(5) toward, but not to, ln(2)/3',
          'inspect [我,喜欢] versus [猫,喜欢] final logits to confirm context can create different predictions',
        ]),
        paragraph(
          '实际诊断应记录 first/last loss、finite values 与 gradients，并比较 logits.argmax(dim=-1) [3,2] 时承认冲突位置最多选中其中一个。Helper 接受已有 completed_updates，只在每次 optimizer.step() 成功返回后加 1，并把 cumulative count 与 history 一起交还 caller；它不会用 loop 上限冒充已完成进度。更有信息量的 context check 是让 [我,喜欢] 与 [猫,喜欢] 在 t=1 产生可不同 distributions；它们的 visible prefixes 确实不同。',
        ),
      ],
      [
        '不要声称本 batch 的六个 labels 都可被 deterministic argmax 同时记住。',
        '不要把 loss→0 当作本数据的正确成功标准；下确界约为 0.231。',
        '不要在同一 batch 上训练又把它称为 validation 或 generalization evidence。',
        'History 只存 detached Python numbers；保存 graph tensors 会不断占用 memory。',
        '若 loss 完全不降，先查 target alignment、registered parameters、non-None gradients、LR 与 step order，不先加数据。',
      ],
      check(
        '为什么这个 one-batch diagnostic 不能要求六个 positions 全部 argmax 正确？',
        [
          paragraph(
            '因为两个 t=0 positions 的可见 causal context 都是同一个 [我]，却分别要求 喜欢 与 学习；同一 deterministic distribution 的 argmax 不能同时是两个不同 token。',
          ),
        ],
      ),
    ),
    section(
      'o0397-12-checkpoint',
      '12. Checkpoint：严格复用 Week 10 的 Identity Contract',
      '只保存 model.state_dict() 也许能在外部条件恰好一致时 inference，却不能证明 tokenizer meanings、architecture policy 或 AdamW history 匹配，更不能 faithful resume。',
      [
        '直接调用 Week 10 的 canonical saver/inference loader，不重定义或削弱其 schema、config、tokenizer hash 与 untied policy。',
        '由成功的 optimizer.step() 推进 completed_updates，并在 save/resume 时把它与 AdamW per-parameter step state 交叉验证。',
        '为 training resume 增加一个调用端 loader：先验证全部 identity 与 optimizer metadata，再构造和使用模型。',
      ],
      [
        paragraph(
          `直白地说，checkpoint 是一份 compatibility contract，而不是“任意 tensors 的袋子”。${canonicalIdentity} Week 10 的 stable members（token_embedding、position_embedding、blocks[i].ln1/attention/ln2/feed_forward、final_norm、lm_head）及 _init_weights 原样保留；Week 11 只 import 并驱动它们。`,
        ),
        table(
          ['checkpoint key', 'exact meaning / value'],
          [
            ['schema', '{name: mini-gpt-training-checkpoint, version: 1}'],
            ['tokenizer', 'version + ordered_tokens + policy + sha256'],
            [
              'config',
              'vocab_size=5, block_size=2, n_embd=4, n_head=2, n_layer=2',
            ],
            ['weight_policy', 'token_embedding_lm_head=untied'],
            ['model_state', 'Week 10 exact state-dict names and tensors'],
            ['optimizer', 'fully qualified class + state_dict'],
            ['completed_updates', '已完成 optimizer.step() 的非负整数次数'],
          ],
        ),
        table(
          ['canonical tokenizer identity', 'exact value'],
          [
            [
              'compact sorted-key UTF-8 JSON',
              '{"ordered_tokens":["我","喜欢","AI","学习","猫"],"policy":"whitespace-delimited;no-specials;no-pad;no-unk","version":"mini-gpt-v1"}',
            ],
            [
              'SHA-256',
              '38d630f4c589664c9bef567457d48764cbe2307734777e80f7d5d5c63ac88dd6',
            ],
          ],
          '与 Week 10 相同：sort_keys=True、separators=(",", ":")、ensure_ascii=False，再 UTF-8 encode',
        ),
        code(
          'python',
          `def validate_mini_gpt_adamw_completed_updates(
    optimizer: torch.optim.Optimizer,
    completed_updates: int,
) -> None:
    if type(optimizer) is not torch.optim.AdamW:
        raise TypeError("faithful resume requires exactly torch.optim.AdamW")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")

    optimizer_state = optimizer.state_dict()
    state = optimizer_state.get("state")
    param_groups = optimizer_state.get("param_groups")
    if not isinstance(state, dict) or not isinstance(param_groups, list):
        raise ValueError("malformed AdamW state_dict")

    parameter_ids: list[int] = []
    for group in param_groups:
        if not isinstance(group, dict) or not isinstance(group.get("params"), list):
            raise ValueError("malformed AdamW param_groups")
        parameter_ids.extend(group["params"])
    if not parameter_ids or len(set(parameter_ids)) != len(parameter_ids):
        raise ValueError("AdamW parameter IDs must be non-empty and unique")
    expected_ids = set(parameter_ids)

    # A newly constructed AdamW has no per-parameter state before its first step.
    if completed_updates == 0:
        if state:
            raise ValueError("zero completed updates require a fresh empty AdamW state")
        return

    if set(state) != expected_ids:
        raise ValueError("nonzero progress requires AdamW state for every parameter")

    observed_steps: set[int] = set()
    for parameter_id in parameter_ids:
        parameter_state = state[parameter_id]
        if not isinstance(parameter_state, dict) or "step" not in parameter_state:
            raise ValueError("every AdamW parameter state must contain step")
        raw_step = parameter_state["step"]
        if torch.is_tensor(raw_step):
            if raw_step.numel() != 1:
                raise ValueError("AdamW step must be scalar")
            raw_step = raw_step.detach().cpu().item()
        if isinstance(raw_step, bool) or not isinstance(raw_step, (int, float)):
            raise ValueError("AdamW step must be a finite integer")
        numeric_step = float(raw_step)
        if not math.isfinite(numeric_step) or not numeric_step.is_integer():
            raise ValueError("AdamW step must be a finite integer")
        observed_steps.add(int(numeric_step))

    if observed_steps != {completed_updates}:
        raise ValueError("completed_updates disagrees with AdamW step state")


def train_and_save_week11_one_batch(
    path: str,
    *,
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    requested_updates: int = 200,
    completed_updates: int = 0,
) -> tuple[list[float], int]:
    # Check resume progress before training, then derive new progress from
    # successful optimizer.step calls rather than from requested_updates.
    validate_mini_gpt_adamw_completed_updates(optimizer, completed_updates)
    history, completed_updates = overfit_mini_gpt_one_batch(
        model,
        optimizer,
        inputs,
        targets,
        device,
        updates=requested_updates,
        completed_updates=completed_updates,
    )
    validate_mini_gpt_adamw_completed_updates(optimizer, completed_updates)

    # Save through the canonical Week 10 API; do not invent new keys.
    save_mini_gpt_training_checkpoint(
        path,
        model=model,
        optimizer=optimizer,
        completed_updates=completed_updates,
        ordered_tokens=CANONICAL_ORDERED_TOKENS,
        tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    return history, completed_updates`,
          'week11_training_and_generation.py',
        ),
        code(
          'python',
          `def week11_config_fields(config: GPTConfig) -> dict[str, int]:
    return {
        "vocab_size": config.vocab_size,
        "block_size": config.block_size,
        "n_embd": config.n_embd,
        "n_head": config.n_head,
        "n_layer": config.n_layer,
    }


def load_mini_gpt_training_resume(
    path: str,
    *,
    device: torch.device,
) -> tuple[MiniGPT, torch.optim.AdamW, int]:
    checkpoint = torch.load(
        path,
        map_location=device,
        weights_only=False,
    )
    if not isinstance(checkpoint, dict):
        raise ValueError("checkpoint must be a dictionary")
    required_keys = {
        "schema",
        "tokenizer",
        "config",
        "weight_policy",
        "model_state",
        "optimizer",
        "completed_updates",
    }
    if set(checkpoint) != required_keys:
        raise ValueError("training checkpoint keys mismatch")
    if checkpoint["schema"] != {
        "name": "mini-gpt-training-checkpoint",
        "version": 1,
    }:
        raise ValueError("checkpoint schema/version mismatch")

    validate_checkpoint_tokenizer_identity(
        checkpoint,
        expected_ordered_tokens=CANONICAL_ORDERED_TOKENS,
        expected_tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        expected_tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    expected_config = GPTConfig()
    if checkpoint["config"] != week11_config_fields(expected_config):
        raise ValueError("checkpoint config mismatch")
    if checkpoint["weight_policy"] != {
        "token_embedding_lm_head": "untied",
    }:
        raise ValueError("checkpoint weight policy mismatch")

    completed_updates = checkpoint["completed_updates"]
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    optimizer_payload = checkpoint["optimizer"]
    if not isinstance(optimizer_payload, dict):
        raise ValueError("optimizer checkpoint must be a dictionary")
    if set(optimizer_payload) != {"class", "state"}:
        raise ValueError("optimizer checkpoint keys mismatch")
    expected_optimizer_class = (
        f"{torch.optim.AdamW.__module__}."
        f"{torch.optim.AdamW.__qualname__}"
    )
    if optimizer_payload["class"] != expected_optimizer_class:
        raise ValueError("optimizer class mismatch")
    if not isinstance(optimizer_payload["state"], dict):
        raise ValueError("optimizer state must be a dictionary")

    # Construct and use state only after every identity check above passes.
    model = MiniGPT(expected_config).to(device)
    model.load_state_dict(checkpoint["model_state"], strict=True)
    if model.lm_head.weight is model.token_embedding.weight:
        raise ValueError("restored model must keep canonical untied weights")
    optimizer = torch.optim.AdamW(model.parameters())
    optimizer.load_state_dict(optimizer_payload["state"])
    validate_mini_gpt_adamw_completed_updates(optimizer, completed_updates)
    return model, optimizer, completed_updates`,
          'week11_training_and_generation.py',
        ),
        code(
          'python',
          `def load_week11_mini_gpt_for_inference(
    path: str,
    *,
    device: torch.device,
) -> MiniGPT:
    # Inference-only restore delegates to the frozen Week 10 loader.
    inference_model = load_mini_gpt_for_inference(
        path,
        expected_ordered_tokens=CANONICAL_ORDERED_TOKENS,
        expected_tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        expected_tokenizer_version=CANONICAL_TOKENIZER_VERSION,
        map_location=device,
    )
    inference_model.eval()
    return inference_model`,
          'week11_training_and_generation.py',
        ),
        table(
          ['restore goal', '必须有', '可以省略'],
          [
            [
              'inference only',
              'schema/tokenizer/config/untied policy/model_state',
              'optimizer 与 completed_updates',
            ],
            [
              'faithful optimizer resume',
              'inference fields + exact optimizer class/state + completed_updates',
              '不能省 optimizer moments/history',
            ],
            [
              'bit-for-bit continuation',
              '还需相同 data order 及相关 CPU/CUDA/Python RNG state',
              '本教学 checkpoint 不宣称做到',
            ],
          ],
        ),
        paragraph(
          'map_location 决定 serialized tensors 映射到哪个 CPU/CUDA/MPS device；model、后续 inputs 与 targets 仍必须共置。Fresh optimizer 的合法起点是 completed_updates=0 且 AdamW per-parameter state 为空；非零 progress 则要求每个 canonical parameter 都有 step，并且所有 step 恰好等于 completed_updates。Save 前和 resume load 后都执行这项交叉检查。SHA-256 绑定已记录的 canonical bytes、用于发现 identity mismatch 或损坏，但不是来源签名；只 load trusted files。',
        ),
      ],
      [
        '相同 vocab_size=5 不足以证明 ID 1 仍表示 喜欢；必须验证 ordered tokens 与 policy。',
        'State dict 不保存 Python forward code、_init_weights intent 或 tying policy。',
        '不要把 Week 10 member names 改成另一套缩写；strict state loading 依赖 exact keys。',
        'Inference-only restore 与 faithful resume 的承诺不同；前者不需要 optimizer，后者不能省略。',
        'completed_updates 是已完成 update 的 count，不是 zero-based loop index。',
        '不要把 requested update 数直接写进 completed_updates；只有 optimizer.step() 成功后才递增，并与 AdamW step state 核对。',
        '加载不可信 torch.save 文件有安全风险；digest 通过也不等于来源可信。',
      ],
      check(
        'Meaningful inference 与 faithful training resume 的 checkpoint 要求差在哪里？',
        [
          paragraph(
            '两者都要 schema、精确 tokenizer identity、config、untied policy 与 model_state；faithful resume 还必须匹配并恢复 AdamW class/state 和无歧义的 completed_updates。',
          ),
        ],
      ),
    ),
    section(
      'o0398-13-inference-training',
      '13. Inference、Training 与 Validation：都 Forward，但目的不同',
      '三个 phase 都可能调用 model，所以仅凭“执行了 forward”或“targets=None”无法判断 graph、loss、state update 和 loop direction 是否正确。',
      [
        '在一个表中对照 inputs、outputs、mode/Autograd、state changes 与下一步动作。',
        '用同一 Week 10 forward API 证明共享 logits 不等于共享 workflow。',
      ],
      [
        paragraph(
          '直白地说，training 用目标答案计算 loss 并把误差反传；validation 也有答案，但只用来计分；inference 没有答案，必须把当前最后位置分布转换成一个 ID 并循环追加。MiniGPT.forward 保持不变，差异由 Week 11 caller 建立。',
        ),
        table(
          ['phase', 'model call', 'graph / mode', '之后做什么'],
          [
            [
              'training',
              'model(inputs [3,2], targets [3,2])',
              'train mode + Autograd graph',
              'all-position loss → backward → step',
            ],
            [
              'validation',
              'model(held_out_inputs)，external summed CE',
              'eval mode + no_grad',
              'token-weighted report；不更新',
            ],
            [
              'inference',
              'model(cropped context)，无 targets',
              'eval mode + no_grad',
              'last logits → sample [B,1] → append',
            ],
          ],
        ),
        code(
          'python',
          `prompt = torch.tensor([[0, 1]], dtype=torch.long, device=device)
was_training = model.training
model.eval()
try:
    with torch.no_grad():
        prompt_logits, no_loss = model(prompt)
finally:
    model.train(was_training)

assert prompt_logits.shape == (1, 2, 5)
assert no_loss is None
next_logits = prompt_logits[:, -1, :]  # [1,5] after 我 喜欢`,
          'week11_training_and_generation.py',
        ),
        chain([
          'training：([3,2],[3,2]) → (logits [3,2,5], loss []) → gradients → updated θ',
          'validation：held-out ([B,T],[B,T]) → logits → external loss sum/count → Python float',
          'inference：[B,T_context] → logits [B,T_context,5] → last [B,5] → next_id [B,1]',
        ]),
        formula(
          String.raw`\mathrm{training}:\ \theta\mapsto\theta',\qquad \mathrm{validation}:\ \theta\mapsto\text{held-out metric},\qquad \mathrm{inference}:\ \theta\mapsto\text{sampled history}`,
          '只有 training 有 parameter update；validation 产生 measurement，inference 产生 caller-owned token history。',
        ),
        paragraph(
          'eval() 不会删除之前残留的 .grad；它只改变 module mode。no_grad() 防止本 forward 建 graph，却也不清除旧 .grad。真正保证 inference 不更新的是调用链中完全没有 loss.backward() 与 optimizer.step()。',
        ),
      ],
      [
        'targets=None 让 loss 缺席，但不自动调用 eval() 或 no_grad()。',
        'Validation 不是 inference：它有 held-out targets 并计算 aggregate metric。',
        'Training 不能只消费 final-position logits；它要评分所有六个有效 positions。',
        'Inference 不能为了得到 next distribution 而伪造 targets。',
      ],
      check(
        'Training 与 inference 都一定能得到哪个 output？loss 何时才存在？',
        [
          paragraph(
            '两者都有 logits；只有 caller 提供 aligned targets 时 canonical forward 才返回 scalar loss。',
          ),
        ],
      ),
    ),
    section(
      'o0399-14',
      '14. 为什么生成只取最后一个位置',
      'Causal MiniGPT 为输入的每个位置都输出五个 vocabulary logits，但当前 generation iteration 只需要“完整当前 context 之后”的一个 next-token distribution。',
      [
        '把 logits[:, -1, :] 固定为 training 与 generation 的边界。',
        '逐行标注 [我,喜欢] 两个输出位置分别在回答哪道 next-token 问题。',
      ],
      [
        paragraph(
          '直白地说，prompt [我, 喜欢] 的 position 0 logits 回答“我后面是什么”，position 1 logits 回答“我 喜欢后面是什么”。生成当前轮只会 append 后一个问题的答案；早期 logits 在 teacher-forced training 中有监督价值，在本 generation iteration 却不是 prompt 末尾之后的预测。',
        ),
        code(
          'python',
          `prompt = torch.tensor([[0, 1]], dtype=torch.long, device=device)
was_training = model.training
model.eval()
try:
    with torch.no_grad():
        logits, no_loss = model(prompt)  # targets intentionally absent
finally:
    model.train(was_training)

assert logits.shape == (1, 2, 5)
assert no_loss is None
next_logits = logits[:, -1, :]
assert next_logits.shape == (1, 5)`,
          'week11_training_and_generation.py',
        ),
        table(
          ['tensor slice', 'shape', 'labelled meaning'],
          [
            ['logits[0,0,:]', '[5]', 'after 我：五个候选 scores'],
            ['logits[0,1,:]', '[5]', 'after 我 喜欢：五个候选 scores'],
            [
              'logits[:,-1,:]',
              '[1,5]',
              '每个 batch prompt 的当前最后位置 distribution source',
            ],
          ],
          '每个五维 row 的 candidate order 都是 [我, 喜欢, AI, 学习, 猫]',
        ),
        formula(
          String.raw`z_{\mathrm{next}}=\mathrm{logits}_{:,T_{\mathrm{context}}-1,:}\in\mathbb{R}^{B\times V}`,
          '先选择 time/context axis 的最后一行；B 保留，T_context axis 消失，V=5 保留。',
        ),
        formula(
          String.raw`p_{\theta}(x_{T+1}\mid x_{\le T})=\operatorname{softmax}(\mathrm{logits}_{:,-1,:})`,
          '最后位置的 raw logits 经后续 sampling transformations 才成为 next-token probabilities。',
        ),
        paragraph(
          '若输入三条 prompts 的 logits 是 [3,2,5]，同一 indexing 得到 [3,5]，每行独立决定一个 next ID。这里 -1 表示当前 sequence axis 的最后位置，不是 token ID -1。',
        ),
        chain([
          'training：logits [3,2,5] 全部 reshape 为 [6,5] 并评分六个 positions',
          'generation：logits [B,T_context,5] 先选择 [:,-1,:]',
          'next logits [B,5] 再经过 τ / top-k / Softmax / sampling',
        ]),
      ],
      [
        'Context length 大于一时不能固定用 logits[:,0,:]。',
        '不能在选择 time position 之前对 [B,T,V] 的 dim=1 做 argmax；那是在 positions 之间选择。',
        '不能把全部 T 个 distributions 都 append；autoregressive loop 每轮只追加一个 ID。',
        'Generation 不需要 targets 来“帮助”得到最后 row。',
      ],
      check('logits shape 是 [3,2,5] 时，logits[:,-1,:] 是什么 shape？', [
        paragraph(
          '[3,5]：三个 prompt rows 各保留一个五候选 next-token score vector。',
        ),
      ]),
    ),
    section(
      'o0400-15-temperature',
      '15. Temperature τ：只改变 Sampling 分布的尖锐程度',
      'Raw last-position logits 可能让抽样太集中或太分散；若直接手选 token，就看不见模型分数与 sampling policy 的分工。',
      [
        '在 Softmax 前只引入一个 transformation：用正的 temperature τ 除 logits。',
        '把 τ 与 sequence axis T、training learning rate 彻底分开。',
      ],
      [
        paragraph(
          '直白地说，τ<1 会放大 logit 差距，让最高分候选更集中；τ>1 会缩小差距，让分布更平；τ=1 保持普通 Softmax。它是 inference-time sampling control，不改变 model parameters、AdamW state 或训练目标。T 在本周始终保留给 sequence/time axis。',
        ),
        callout(
          '固定最后位置的五个带标签 logits',
          [
            paragraph(
              '候选顺序 [我, 喜欢, AI, 学习, 猫]，z=[0,2,1,-1,-0.5]，shape [1,5]。当 τ=1 时，z/τ 仍为 [0,2,1,-1,-0.5]；本节先只观察 scaling，下一节再手算 probabilities。',
            ),
          ],
          'example',
        ),
        formula(
          String.raw`p_i(\tau)=\frac{\exp(z_i/\tau)}{\sum_{j=1}^{V}\exp(z_j/\tau)},\qquad \tau>0`,
          'z_i 是 token i 的 last-position logit；先除正数 tau，再沿五个 vocabulary candidates 归一化。',
        ),
        table(
          ['τ setting', 'scaled logits 的相对间距', 'sampling effect'],
          [
            ['τ=0.5', '原差距乘 2', '更尖，最高 logit probability 上升'],
            ['τ=1', '不变', '普通 Softmax'],
            ['τ=2', '原差距减半', '更平，低分候选 probability 上升'],
          ],
        ),
        chain([
          'last logits z [B,5]',
          'validate τ>0',
          'scaled logits z/τ [B,5]',
          'ranking 不变；relative gaps 改变',
          '之后才做 optional top-k 与 Softmax',
        ]),
        paragraph(
          'Positive τ 除法保持 candidate ranking；它只改变相对概率差距。τ=0 会除零，τ<0 会翻转 ranking，都不是本 sampling API 允许的设置。',
        ),
      ],
      [
        'τ 必须严格大于 0；不要把 τ=0 当作 argmax 的写法。',
        '不要在训练 CE 中偷偷除以 τ，除非你明确在改变训练 objective。',
        'τ 不是 learning rate，也不是 top-k；三者分别控制 optimizer、distribution sharpness 与 candidate set。',
        'T 表示 sequence axis，sampling temperature 只写作 τ 或 tau。',
      ],
      check('把 τ 从 1 降到 0.5 会改变 checkpoint 中的 model weights 吗？', [
        paragraph('不会；它只在本次 inference 中缩放 last-position logits。'),
      ]),
    ),
    section(
      'o0401-16-temperature',
      '16. 手算 Temperature τ：同一组五个带标签概率',
      '“分布更尖”仍很抽象；只有把同一五个 candidates 在不同 τ 下归一化，才能看到概率质量怎样移动。',
      [
        '用固定 logits 逐步完成 scaling、exponential、normalization 与 sampling。',
        '并列 argmax 和 multinomial 的相同 output shape 与不同 decision policy。',
      ],
      [
        paragraph(
          '直白地说，手算同一组 scores 能把“更尖、更平”变成可核对的 probability changes；实际使用时据此选择 sampling diversity。仍用 candidate order [我, 喜欢, AI, 学习, 猫] 与 z=[0,2,1,-1,-0.5]。Softmax 只在 τ scaling 之后发生；表中值为四舍五入，所以每列显示值可能不严格相加为 1。',
        ),
        table(
          ['token', 'raw z', 'p(τ=1)', 'p(τ=0.5)', 'p(τ=2)'],
          [
            ['我', '0.0', '0.083', '0.016', '0.148'],
            ['喜欢', '2.0', '0.612', '0.860', '0.403'],
            ['AI', '1.0', '0.225', '0.116', '0.244'],
            ['学习', '-1.0', '0.030', '0.002', '0.090'],
            ['猫', '-0.5', '0.050', '0.006', '0.115'],
          ],
          '同一 last-position scores；只改变正的 sampling temperature τ',
        ),
        paragraph(
          'τ=0.5 时，z/τ=[0,4,2,-2,-1]；对应 exponentials 约 [1.000,54.598,7.389,0.135,0.368]，总和约 63.490。最高 logit“喜欢”因此得到约 0.860。τ=2 时，z/τ=[0,1,0.5,-0.5,-0.25]，差距缩小。',
        ),
        formula(
          String.raw`[0,4,2,-2,-1]\xrightarrow{\exp}[1.000,54.598,7.389,0.135,0.368]\xrightarrow{/63.490}[0.016,0.860,0.116,0.002,0.006]`,
          'tau 等于 0.5 的 labelled five-token example；向量顺序始终为我、喜欢、AI、学习、猫。',
        ),
        code(
          'python',
          `next_logits = torch.tensor(
    [[0.0, 2.0, 1.0, -1.0, -0.5]],
    device=device,
)  # [1,5] ordered as 我, 喜欢, AI, 学习, 猫
temperature = 0.5
if not math.isfinite(temperature) or temperature <= 0:
    raise ValueError("temperature must be positive")

scaled_logits = next_logits / temperature  # [1,5]
probabilities = F.softmax(scaled_logits, dim=-1)  # [1,5]
next_id = torch.multinomial(
    probabilities,
    num_samples=1,
)  # torch.long [1,1]`,
          'week11_training_and_generation.py',
        ),
        formula(
          String.raw`z\ [1,5]\to z/\tau\ [1,5]\to p\ [1,5]\to\mathrm{next\_id}\ [1,1]`,
          'Scaling 和 Softmax 保持五个 candidates；multinomial 最终为每个 batch row 采一个 integer class ID。',
        ),
        paragraph(
          'torch.argmax(probabilities, dim=-1, keepdim=True) 也输出 [1,1]，但总选最高 probability；torch.multinomial 会按概率随机抽样，所以可能选择非 argmax token。二者都是 forward 之后的 choice policy，不是另一次模型计算。',
        ),
      ],
      [
        'torch.multinomial 接收 non-negative probabilities；不能直接传 raw logits。',
        '不能对已经归一化的 probabilities 简单除以 τ 并声称等价于 logit scaling。',
        '一次 random sample 可能不是最高概率 token，也不能单独证明模型质量。',
        '概率表必须始终标明 token order；裸数字向量无法解释。',
      ],
      check(
        '本例 τ 从 1 降到 0.5 时，哪个 token 的 probability 增加最多？为什么？',
        [
          paragraph(
            '喜欢；它原本有最高 logit 2，较小 τ 放大其相对领先，概率约从 0.612 升至 0.860。',
          ),
        ],
      ),
    ),
    section(
      'o0402-17-top-k-sampling',
      '17. Top-k：在 τ Scaling 后限制候选集',
      'Temperature τ 只调整所有有限 logits 的相对 probability，仍会给每个 candidate 非零质量；极低分 token 仍可能被抽中。',
      [
        '把 top-k 加作独立的 candidate filter：保留 k 个最高 scaled logits，其余设为负无穷。',
        '验证 τ 与 k，严格按 scaling→filter→Softmax→multinomial 顺序实现唯一命名 helper。',
      ],
      [
        paragraph(
          '直白地说，top-k 在 sampling 前缩小“本轮允许抽中的词表”。正 τ 不改变 ranking，因此先做 τ scaling，再取最高 k 项；被过滤项设为 -∞，Softmax 后精确变成 0，保 survivors 会重新归一化。它不更新 model，也不是 training regularizer。',
        ),
        table(
          [
            'token',
            'scaled logit at τ=1',
            'after k=3 filter',
            'final probability',
          ],
          [
            ['我', '0.0', '0.0', '0.090'],
            ['喜欢', '2.0', '2.0', '0.665'],
            ['AI', '1.0', '1.0', '0.245'],
            ['学习', '-1.0', '-∞', '0.000'],
            ['猫', '-0.5', '-∞', '0.000'],
          ],
          '保留 喜欢、AI、我；denominator=exp(2)+exp(1)+exp(0)=11.107',
        ),
        code(
          'python',
          `def sample_mini_gpt_next_id(
    last_logits: torch.Tensor,
    temperature: float = 1.0,
    top_k: int | None = None,
) -> torch.Tensor:
    if last_logits.ndim != 2:
        raise ValueError("last_logits must have shape [B,V]")
    if last_logits.size(-1) != 5:
        raise ValueError("mini-gpt-v1 requires V=5")
    if not bool(torch.isfinite(last_logits).all()):
        raise ValueError("last_logits must be finite")
    if not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("temperature must be positive")

    scaled_logits = last_logits / temperature
    vocabulary_size = scaled_logits.size(-1)
    if top_k is not None:
        if type(top_k) is not int or not 1 <= top_k <= vocabulary_size:
            raise ValueError("top_k must be an integer in [1,V]")
        top_values, top_indices = torch.topk(
            scaled_logits,
            k=top_k,
            dim=-1,
        )
        filtered_logits = torch.full_like(
            scaled_logits,
            float("-inf"),
        )
        filtered_logits.scatter_(
            dim=-1,
            index=top_indices,
            src=top_values,
        )
        scaled_logits = filtered_logits

    probabilities = F.softmax(scaled_logits, dim=-1)
    next_id = torch.multinomial(probabilities, num_samples=1)
    assert next_id.dtype == torch.long
    return next_id  # [B,1]`,
          'week11_training_and_generation.py',
        ),
        chain([
          'last_logits z [B,V]=[B,5]',
          'validate τ>0 and optional integer 1≤k≤V',
          'scale z/τ [B,5]',
          'retain top k logits; others become -∞ [B,5]',
          'Softmax renormalizes survivors [B,5]',
          'multinomial samples next_id torch.long [B,1]',
        ]),
        formula(
          String.raw`\widetilde z_i=\begin{cases}z_i/\tau,&i\in\operatorname{TopK}(z/\tau)\\-\infty,&\text{otherwise}\end{cases},\qquad p_i=\operatorname{softmax}(\widetilde z)_i`,
          '过滤发生在 Softmax 之前；负无穷候选的 exponential 为零，survivors 的 probabilities 重新和为 1。',
        ),
        paragraph(
          'k=1 使剩余 distribution 在唯一最高项上确定；k=V=5 不过滤任何 finite candidate。Cutoff 处相同 logits 的 tie selection 可依实现而定，不能承诺相等分数中固定保留哪一个。',
        ),
      ],
      [
        '必须拒绝 k=0、negative k、k>V 与非 integer k。',
        '必须先 filter logits 再 Softmax，才能让 survivors 正确重新归一化。',
        '不能在 multinomial 之后才过滤；token 已经被选中。',
        'top-k 不代表“top-k tokens 都追加”；每个 batch row 仍只 sample 一个 [1] ID。',
      ],
      check(
        '一个 candidate 被 top-k 设为 -∞ 后，其 Softmax probability 是多少？',
        [paragraph('0；exp(-∞)=0，剩余 candidates 会重新归一化。')],
      ),
    ),
    section(
      'o0403-18-generation-loop',
      '18. 完整 Generation Loop：Crop、Last、Sample、Append',
      '正确的一次 sampling 仍没有说明 prompt 如何逐 token 增长，也没有处理 history 超过 Week 10 block_size=2 时的合法 forward input。',
      [
        '把 eval、no-grad、input validation、context crop、last-position selection、τ/top-k sampling 与 append 组装为完整 caller loop。',
        '保持 full history 与 cropped context 为两个对象，并在退出时恢复原 module mode。',
      ],
      [
        paragraph(
          '直白地说，每轮只把完整 history 的最后至多两个 IDs 送进 MiniGPT；模型返回每个 visible position 的 logits；caller 只拿最后一行，抽一个 [B,1] integer ID，再把它接到未裁剪 history 上。整个过程 target-free 且 read-only。',
        ),
        code(
          'python',
          `@torch.no_grad()
def generate_mini_gpt_sampled(
    model: MiniGPT,
    history: torch.Tensor,
    max_new_tokens: int,
    temperature: float = 1.0,
    top_k: int | None = None,
) -> torch.Tensor:
    if type(max_new_tokens) is not int or max_new_tokens < 0:
        raise ValueError("max_new_tokens must be a non-negative integer")
    if history.ndim != 2:
        raise ValueError("history must have shape [B,L_history]")
    if history.dtype != torch.long:
        raise TypeError("history must have dtype torch.long")
    if history.numel() == 0 or history.size(1) < 1:
        raise ValueError("history must contain at least one token per row")
    if int(history.min().item()) < 0 or int(history.max().item()) >= 5:
        raise ValueError("history IDs must be in [0,4]")
    if history.device != next(model.parameters()).device:
        raise ValueError("history and model must be on the same device")
    if not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("temperature must be positive")
    if top_k is not None:
        if type(top_k) is not int or not 1 <= top_k <= 5:
            raise ValueError("top_k must be an integer in [1,5]")

    was_training = model.training
    model.eval()
    try:
        for _ in range(max_new_tokens):
            context = history[:, -model.config.block_size :]
            logits, no_loss = model(context)  # no targets in generation
            assert no_loss is None
            last_logits = logits[:, -1, :]
            next_id = sample_mini_gpt_next_id(
                last_logits,
                temperature=temperature,
                top_k=top_k,
            )
            assert next_id.shape == (history.size(0), 1)
            history = torch.cat((history, next_id), dim=1)
    finally:
        model.train(was_training)
    return history`,
          'week11_training_and_generation.py',
        ),
        table(
          ['first iteration from 我 喜欢', 'value', 'shape'],
          [
            ['full history', '[[0,1]] = [我,喜欢]', '[1,2]'],
            ['cropped context', '[[0,1]]，仍在 block_size=2 内', '[1,2]'],
            [
              'model logits',
              '两个 visible positions，各五个 scores',
              '[1,2,5]',
            ],
            ['last_logits', 'after 我 喜欢', '[1,5]'],
            ['sampled example next_id', '[[2]] = AI', '[1,1]'],
            ['new full history', '[[0,1,2]] = [我,喜欢,AI]', '[1,3]'],
          ],
        ),
        chain([
          'uncropped history [B,L_history]',
          'crop only forward context → [B,min(L_history,2)]',
          'MiniGPT(context), no targets → [B,T_context,5]',
          'logits[:,-1,:] → [B,5]',
          'τ scale → optional top-k → Softmax → multinomial',
          'next_id torch.long [B,1]',
          'append to uncropped history → [B,L_history+1]',
        ]),
        formula(
          String.raw`[B,L_{\mathrm{history}}]\to[B,\min(L_{\mathrm{history}},2)]\to[B,T_{\mathrm{context}},5]\to[B,5]\to[B,1]\to[B,L_{\mathrm{history}}+1]`,
          '只裁剪 forward context；返回历史每轮增加一个 integer token ID。',
        ),
        paragraph(
          '第二轮 full history 已是 [0,1,2]，但进入 model 的 context 是尾部 [1,2]。若需要 sampled demo 可复现，应在 caller 明确设置 torch RNG seed；这不把 sampling 变成 model state update。',
        ),
      ],
      [
        '@torch.no_grad() 与 model.eval() 各有职责，二者不能相互替代。',
        'Append 的必须是 torch.long [B,1] IDs，不是 [B,5] probabilities。',
        '不能用 cropped context 覆盖 full history，否则会丢失返回文本的早期 tokens。',
        'Batch rows 独立 sampling，但每个 iteration 同步各追加一个 ID。',
        '本 helper 名称明确属于 MiniGPT，不会覆盖 Week 6 或 Week 10 的 generate helper。',
      ],
      check('Append 前哪个 tensor 的 shape 必须是 [B,1]？', [
        paragraph(
          'sample_mini_gpt_next_id 返回的 integer next_id；每个 batch row 恰好一个 token ID。',
        ),
      ]),
    ),
    section(
      'o0404-19-context',
      '19. 为什么只截断 Forward Context，不截断 History',
      'Canonical MiniGPT 的 block_size=2；生成第三个 token 后 full history 已长于 position table 与 causal mask 的容量，直接整段 forward 会被正确拒绝。',
      [
        '区分 caller 保存的完整生成记录 L_history 与 model 本轮可见的 T_context。',
        '展示 tail crop 如何满足 Week 10 API，同时明确被裁掉 tokens 不再被模型记住。',
      ],
      [
        paragraph(
          '直白地说，history 是要交给用户的完整结果，context 是本轮模型能看的尾部窗口。Caller 保留前者，只有在调用 forward 前才计算后者。这样 output 不会丢词，但模型的决定确实只依赖最近至多两个 token。',
        ),
        table(
          ['对象', 'IDs / tokens', 'shape', 'owner'],
          [
            [
              'full history',
              '[0,1,2] = 我 喜欢 AI',
              '[1,3]',
              'generation caller',
            ],
            ['tail context', '[1,2] = 喜欢 AI', '[1,2]', '本轮 forward input'],
            [
              'model logits',
              'context 两个 positions × 五 candidates',
              '[1,2,5]',
              'MiniGPT forward',
            ],
            ['last logits', 'after 喜欢 AI', '[1,5]', 'caller sampling path'],
          ],
        ),
        formula(
          String.raw`T_{\mathrm{context}}=\min(L_{\mathrm{history}},\mathrm{block\_size}),\qquad \mathrm{block\_size}=2`,
          'L_history 可以继续增长；每轮进入模型的 T_context 只能是 1 或 2。',
        ),
        formula(
          String.raw`\mathrm{context}=\mathrm{history}_{:,-2:}\in\mathbb{N}^{B\times T_{\mathrm{context}}}`,
          'Tail slice 只改变本轮 forward view；原 history tensor reference 会在 append 时形成新的更长记录。',
        ),
        code(
          'python',
          `history = torch.tensor(
    [[0, 1, 2]],
    dtype=torch.long,
    device=device,
)  # 我 喜欢 AI，shape [1,3]
context = history[:, -model.config.block_size :]
assert context.tolist() == [[1, 2]]
assert context.shape == (1, 2)

was_training = model.training
model.eval()
try:
    with torch.no_grad():
        logits, no_loss = model(context)  # targets intentionally absent
finally:
    model.train(was_training)
assert logits.shape == (1, 2, 5)
assert no_loss is None`,
          'week11_training_and_generation.py',
        ),
        paragraph(
          '实际用途是遵守 position_embedding.weight [2,4]、每个 causal_mask [1,1,2,2] 和 forward 的 1≤T≤2 guard。Crop 不是 causal mask：mask 限制当前窗口内 query 能看哪些 key；crop 直接让更早 tokens 不进入计算，因此模型无法“暗中记得”我@history position 0。',
        ),
      ],
      [
        '不要把 training inputs/targets 静默 crop；应在建 batch 时保证其符合 block_size。',
        '不要 append 到 context 后把它当完整 history 返回；早期 tokens 会消失。',
        'Crop 不会扩展 context memory，也不等于 causal masking。',
        'L_history 是生成记录长度，n_layer=2 才是 block 数；不要复用一个符号。',
      ],
      check(
        'Full history 是 [0,1,2] 且 block_size=2 时，下一次 forward 收到哪些 IDs？',
        [paragraph('[1,2]；完整 [0,1,2] 仍由 caller 保留并最终返回。')],
      ),
    ),
    section(
      'o0405-20-bug-checklist',
      '20. 常见 Bug Checklist：按症状检查 Phase 边界',
      'Training/inference 错误常仍有“看起来合理”的 shapes 或随机输出；泛泛地重读代码不如从症状追到最可能被跨越的 data、state、measurement 或 sampling boundary。',
      [
        '给出可直接执行的 symptom→likely cause→first check 顺序。',
        '把本周两条 shape contract 变成 diagnosis anchors，再提醒 shape correctness 不等于 semantic correctness。',
      ],
      [
        paragraph(
          '直白地说，先确认你正在做哪一个 phase，再检查该 phase 允许读取和改变什么。以下表应在“加层、换 optimizer、增数据”之前使用；每一行都指向一个最小观察点。',
        ),
        table(
          ['symptom', '最可能的 boundary mistake', 'first direct check'],
          [
            [
              'one-batch loss 完全不降',
              'targets 错位、parameters 未注册/未进 optimizer、缺 backward/step、LR 不合适',
              '打印六个 pairs；检查 non-None grads 与 completed_updates',
            ],
            [
              'loss/gradients 变成 NaN 或 Inf',
              'LR/update 过大、输入或中间值先非有限',
              '定位 first non-finite value；记录 pre-clip grad norm',
            ],
            [
              '期待 loss→0 却停在约 0.231',
              '忽略两个 [我] contexts 的 conflicting labels',
              '核对 P(喜欢|我) 与 P(学习|我) 是否趋近 0.5/0.5',
            ],
            [
              'accumulation 像单 microbatch',
              'window 内 zero_grad 或过早 step',
              '数每个 step 前有几次 backward',
            ],
            [
              'earlier logits 随 future token 改变',
              'causal mask/slice/axis 泄漏答案',
              '固定 prefix，只改变右侧 token，比较 t=0 logits',
            ],
            [
              'validation 占 memory 或随机波动',
              '缺 no_grad、缺 eval，或 split/样本太小',
              '同时使用两者并恢复 mode；检查 held-out 数据量',
            ],
            [
              'validation 值受 batch packing 改变',
              '平均了 batch means',
              '累加 reduction=sum 与 valid target count',
            ],
            [
              'checkpoint load 后乱码/异常',
              'tokenizer/config/tie policy/member keys 不匹配',
              '先核 schema、canonical JSON/SHA-256 与 strict state keys',
            ],
            [
              'device error',
              'model、inputs、targets 不共置',
              '打印各 tensor/parameter device；用 map_location 和 .to(device)',
            ],
            [
              'generation 超过两 tokens 失败',
              '忘记 crop forward context',
              'assert context.size(1)≤block_size',
            ],
            [
              'next value shape/type 不对',
              '使用了所有 positions 或把 probability vector 当 ID',
              'assert last [B,5]；next_id long [B,1]',
            ],
            [
              'τ/top-k 产生 invalid distribution',
              'τ≤0、k 越界、或 filter 顺序错误',
              'validate τ>0、1≤k≤V；filter logits before Softmax',
            ],
          ],
        ),
        code(
          'python',
          `assert inputs.shape == (3, 2)
assert targets.shape == (3, 2)
logits, loss = model(inputs.to(device), targets.to(device))
assert logits.shape == (3, 2, 5)
assert loss is not None and loss.ndim == 0

last_logits = logits[:, -1, :]
assert last_logits.shape == (3, 5)
# Shape assertions locate axes; they do not prove targets or causality.`,
          'week11_training_and_generation.py',
        ),
        chain([
          'training contract：inputs [3,2] + targets [3,2]',
          'MiniGPT representations [3,2,4] → logits [3,2,5]',
          'reshape [6,5] + [6] → mean loss [] → backward → step',
          'generation contract：context [B,T_context] → logits [B,T_context,5]',
          'select last [B,5] → τ/top-k/Softmax → next_id [B,1]',
        ]),
        formula(
          String.raw`\mathrm{training}:\ [3,2]\to[3,2,4]\to[3,2,5]\to[6,5]+[6]\to[]`,
          '固定 Week 11 training spine：所有六个有效 positions 参与 loss。',
        ),
        formula(
          String.raw`\mathrm{generation}:\ [B,T_{\mathrm{context}}]\to[B,T_{\mathrm{context}},5]\to[B,5]\to[B,1]`,
          'Target-free generation spine：只从最后位置选并追加一个 token ID。',
        ),
        paragraph(
          '一个 successful sample 不能证明 model quality；一个 passing shape assertion 也不能证明 target semantics、causality 或 held-out integrity。Diagnosis 要沿 data→forward→loss→gradient→update 或 prompt→crop→last→sample→append 顺序观察实际 state。',
        ),
      ],
      [
        '不要用“跳过 NaN batch”掩盖第一处数值错误。',
        '不要因为 shape 匹配就假设 tokenizer ID semantics 匹配。',
        '不要把 same-corpus score 报成 held-out validation。',
        '不要用一个随机生成句子替代 systematic measurement。',
        '每次只改变一个排查变量，否则无法归因。',
      ],
      check('Generation 收到 [B,T,V] logits 后，第一项必要 indexing 是什么？', [
        paragraph(
          'logits[:,-1,:]；它移除 time axis 并得到每个 prompt 的 [B,V]=[B,5] next-token scores。',
        ),
      ]),
    ),
    section(
      'o0411-21-week-11-7',
      '21. Week 11 最应该理解的 7 件事',
      'API 名称很多，若不能压缩成少数 causal claims，遇到新 optimizer、loader 或 sampling setting 时仍会靠背诵而无法推理。',
      [
        '用恰好七条 statements 复盘固定 data、state、measurement、checkpoint 与 generation contracts。',
        '让每条 statement 都能回到一个具体 shape、数值或 owner。',
      ],
      [
        paragraph(
          '直白地说，下面七条是阅读任何 small language-model run 的最短路线，而不是孤立术语：先认 data signal，再认 state change，随后认 measurement、persistence 与 target-free generation；实际排错时也按这个顺序定位边界。',
        ),
        list(
          [
            '固定 corpus 的 inputs/targets 都是 [3,2]；一次 forward 产生 logits [3,2,5]，reshape 为 [6,5]+[6] 后评分全部六个 next-token signals。',
            'Uniform five-way prediction 的 mean NLL reference 是 ln(5)≈1.609；random first loss 可在其附近，而它绝不是训练完成标准。',
            'backward() 把 gradients 累加到 parameter.grad，zero_grad() 定义 accumulation window；只有 optimizer.step() 改 parameter values 与 AdamW moments/counters。',
            'Step 是一次 parameter update，epoch 是走完 training batches 一遍；accumulation 可让多次 forward/backward 只产生一次 completed update。',
            'Held-out validation 必须同时用 eval() 与 no_grad()、恢复先前 mode，并按 reduction=sum / valid target count 做 token-weighted 聚合；same-corpus score 不是 validation。',
            '两个相同 [我] causal contexts 分别标为 喜欢 与 学习，所以 empirical optimum 是 0.5/0.5，batch mean NLL 只会趋近而不会以 finite weights 达到 ln(2)/3≈0.231；检查 [我,喜欢] 与 [猫,喜欢] 等可区分 contexts 是否能分化。',
            '兼容 checkpoint 复用 Week 10 exact schema/tokenizer SHA-256/config/untied state keys；inference 则 target-free 地 crop context、取 logits[:,-1,:]、按 τ 和 optional top-k 处理、Softmax/multinomial 得 [B,1] 并 append full history。',
          ],
          true,
        ),
        table(
          ['training trace', 'generation trace'],
          [
            ['inputs [3,2]', 'history [1,2] = [我,喜欢]'],
            ['representations [3,2,4]', 'cropped context [1,2]'],
            ['logits [3,2,5]', 'logits [1,2,5] → last [1,5]'],
            [
              'loss [] → gradients → updated θ',
              'sample next_id [1,1] → history [1,3]',
            ],
          ],
        ),
        formula(
          String.raw`\underbrace{[3,2]\to[3,2,4]\to[3,2,5]\to[]\to\nabla_{\theta}\to\theta'}_{\mathrm{supervised\ training}}\qquad\underbrace{[1,2]\to[1,2,5]\to[1,5]\to[1,1]\to[1,3]}_{\mathrm{target\text{-}free\ generation}}`,
          'Training 聚合全部位置并更新参数；generation 只选择最后位置并扩展 caller history。',
        ),
        paragraph(
          '实际用途是把每个 symptom 放回所属 boundary：没有下降先查 supervised path；validation 异常先查 measurement；load 异常先查 identity；generation 异常先查 crop、last-position 与 sampling transforms。',
        ),
      ],
      [
        '不要把 eval、no_grad 与 no-update 合并成同一概念。',
        '不要把 generation 的 last-position rule 倒灌到 training loss。',
        '不要用 checkpointing 解释 parameter improvement；它只保存或恢复 state。',
        '不要忘记 one-batch 的 conflicting [我] labels。',
      ],
      check('用一句话区分 zero_grad() 与 optimizer.step()。', [
        paragraph(
          'zero_grad() 清除 accumulated gradient buffers；optimizer.step() 读取当前 gradients 并更新 parameters 与 optimizer state。',
        ),
      ]),
    ),
    section(
      'o0412-22-week-11-week-12',
      '22. Week 11 → Week 12：把 Lifecycle 接回完整 Pipeline',
      '分别理解 training、validation、checkpoint 与 inference 后，learner 仍可能不知道它们在 raw text 到 generated text 的端到端系统中何时交接。',
      [
        '把 Week 9 tokenizer、Week 10 architecture 与 Week 11 lifecycle 接成唯一 trace。',
        '明确 supervised training 在哪里结束、target-free autoregressive inference 在哪里开始，为 Week 12 的 assembly 留下稳定接口。',
      ],
      [
        paragraph(
          '直白地说，Week 9 决定 text 怎样成为 model-bound IDs；Week 10 的 frozen MiniGPT 决定一次 forward 怎样产生 logits；Week 11 决定 labels、gradients、updates、measurement、persistence 与 sampling 何时发生。Week 12 将把同一代码和同一 state contract 放进一个完整 project trace，而不是再造另一套类或 ID space。',
        ),
        callout(
          '一条句子的 supervised 路径',
          [
            paragraph(
              'Raw “我 喜欢 AI” 用 mini-gpt-v1 编为 [0,1,2]，shift 得 [0,1]→[1,2]；它与另两句组成 [3,2] batch，进入 token/position embeddings [3,2,4]、两个 canonical blocks、logits [3,2,5] 与 scalar loss，随后 backward 和 AdamW step 更新 θ。',
            ),
          ],
          'example',
        ),
        chain([
          'raw corpus：我 喜欢 AI / 猫 喜欢 我 / 我 学习 AI',
          'mini-gpt-v1 IDs [B,N]=[3,3]',
          'shift → inputs/targets [3,2]',
          'token + position representations [3,2,4]',
          'Week 10 two-block MiniGPT → logits [3,2,5]',
          'reshape [6,5]+[6] → loss [] → backward → optimizer.step()',
          'token-weighted held-out validation and/or canonical checkpoint',
          'target-free prompt history → crop → last logits [B,5] → sampled ID [B,1] → append',
        ]),
        formula(
          String.raw`\mathrm{raw\ text}\to[3,3]\to[3,2]\to[3,2,4]\to[3,2,5]\to[6,5]+[6]\to\mathcal L\to\nabla_{\theta}\to\theta'\to\mathrm{checkpoint}`,
          'Supervised branch 从 fixed raw corpus 到 canonical saved training state；每个 shape transition 都有明确 owner。',
        ),
        formula(
          String.raw`[B,L_{\mathrm{history}}]\to[B,\min(L_{\mathrm{history}},2)]\to[B,5]\xrightarrow{\tau,\,\mathrm{top}\text{-}k,\,\mathrm{softmax}}[B,5]\to[B,1]`,
          'Inference branch 没有 targets：crop context，选择最后 logits，变换 distribution，sample 一个 ID。',
        ),
        table(
          ['handoff point', '之前', '之后'],
          [
            [
              'after optimizer step',
              'supervised training，可改变 θ',
              '可验证、保存或继续 training',
            ],
            [
              'after checkpoint identity validation/load',
              'serialized compatible state',
              'restored model/optimizer 或 inference model',
            ],
            [
              'target-free eval/no-grad forward',
              'prompt context IDs',
              '只取 final-position logits 并开始 autoregressive append',
            ],
          ],
        ),
        paragraph(
          '从 supervised training 切到 autoregressive inference 的精确时刻，是 caller 对没有 targets 的 prompt 做 eval/no-grad forward，并从 logits[:, -1, :] 开始 sampling 与 append。Checkpoint 可以夹在两者之间，但它不构成学习 update。',
        ),
      ],
      [
        '不要把 Week 9 的 V=11 illustrative IDs 交给 V=5 MiniGPT；Week 12 继续使用 mini-gpt-v1。',
        '不要在 Week 12 重命名 GPTConfig、MiniGPT members 或 _init_weights；checkpoint continuity 依赖它们。',
        'Generation 绝不复用 training targets。',
        'Loss 下降必须配合 held-out validation 与 samples 才能讨论 usefulness。',
        'Checkpoint save/load 不会单独改善 model。',
      ],
      check(
        '端到端 trace 在哪一步从 supervised training 切换为 autoregressive inference？',
        [
          paragraph(
            '在加载/选择好当前参数后，对 target-free prompt 进行 eval/no-grad forward，并只取 final-position logits 来 sample 和 append 时。',
          ),
        ],
      ),
    ),
  ],
};
