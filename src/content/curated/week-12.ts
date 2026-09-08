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

const batchRows = [
  ['b=0', '[0,1,2]', '[0,1]', '[1,2]', '我→喜欢；[我,喜欢]→AI'],
  ['b=1', '[4,1,0]', '[4,1]', '[1,0]', '猫→喜欢；[猫,喜欢]→我'],
  ['b=2', '[0,3,2]', '[0,3]', '[3,2]', '我→学习；[我,学习]→AI'],
];

const fixedTrace =
  '固定 trace 始终使用 mini-gpt-v1：[我, 喜欢, AI, 学习, 猫] 对应 IDs 0..4；B=3、N=3、T=2、C=4、H=2、d_head=2、V=5、n_layer=2。B 在一般 API 中可变，但本训练例固定为 3。';

const endToEndRunner = `# week12_end_to_end.py
# This file is a caller. It reuses, rather than redefines, Week 10/11 APIs.
from __future__ import annotations

from pathlib import Path

import torch
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, configure_console

from mini_gpt_walkthrough import (
    GPTConfig,
    MiniGPT,
    save_mini_gpt_training_checkpoint,
)
from week11_training_and_generation import (
    CANONICAL_ORDERED_TOKENS,
    CANONICAL_TOKENIZER_POLICY,
    CANONICAL_TOKENIZER_VERSION,
    generate_mini_gpt_sampled,
    load_mini_gpt_training_resume,
    train_mini_gpt_step,
    validate_mini_gpt_adamw_completed_updates,
)


RAW_TEXTS = DEMO_DOCUMENTS
EXPECTED_RAW_IDS = (
    (0, 1, 2),  # 我 喜欢 AI
    (4, 1, 0),  # 猫 喜欢 我
    (0, 3, 2),  # 我 学习 AI
)
FROZEN_STOI = {
    token: token_id
    for token_id, token in enumerate(CANONICAL_ORDERED_TOKENS)
}
assert CANONICAL_ORDERED_TOKENS == FIVE_WORD_TOKENIZER.tokens
assert CANONICAL_TOKENIZER_POLICY == (
    "whitespace-delimited;no-specials;no-pad;no-unk"
)


def encode_mini_gpt_v1(text: str) -> list[int]:
    ids = FIVE_WORD_TOKENIZER.encode(text)
    if not ids:
        raise ValueError("mini-gpt-v1 text must contain a token")
    return ids


def make_fixed_batch(device: torch.device) -> tuple[torch.Tensor, torch.Tensor]:
    encoded_rows = [encode_mini_gpt_v1(text) for text in RAW_TEXTS]
    assert tuple(tuple(row) for row in encoded_rows) == EXPECTED_RAW_IDS
    raw = torch.tensor(encoded_rows, dtype=torch.long, device=device)  # [3,3]
    inputs = raw[:, :-1]   # [3,2]
    targets = raw[:, 1:]   # [3,2]
    return inputs, targets


def main() -> None:
    configure_console()
    seed = 7
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = MiniGPT(GPTConfig()).to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-2,
    )
    inputs, targets = make_fixed_batch(device)
    assert inputs.shape == targets.shape == (3, 2)

    # Observe the labelled [我,喜欢] -> AI row before any update.
    model.eval()
    with torch.no_grad():
        before_logits, _ = model(inputs)
        before_probs = torch.softmax(before_logits[0, 1, :], dim=-1)  # [5]

    completed_updates = 0
    for _ in range(100):
        loss, grad_norm, completed_updates = train_mini_gpt_step(
            model,
            optimizer,
            inputs,
            targets,
            device,
            completed_updates=completed_updates,
        )
        assert torch.isfinite(loss) and torch.isfinite(grad_norm)
    assert completed_updates == 100
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    model.eval()
    with torch.no_grad():
        reference_logits, reference_loss = model(inputs, targets)
    assert reference_logits.shape == (3, 2, 5)
    assert reference_loss is not None and reference_loss.ndim == 0
    after_probs = torch.softmax(reference_logits[0, 1, :], dim=-1)  # [5]
    print("observed context=[我,喜欢], target=AI")
    print("vocabulary_order=", CANONICAL_ORDERED_TOKENS)
    print("before_probs=", before_probs.detach().cpu().tolist())
    print("after_probs=", after_probs.detach().cpu().tolist())

    path = Path("mini-gpt-training.pt")
    save_mini_gpt_training_checkpoint(
        str(path),
        model=model,
        optimizer=optimizer,
        completed_updates=completed_updates,
        ordered_tokens=CANONICAL_ORDERED_TOKENS,
        tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    restored, restored_optimizer, restored_updates = (
        load_mini_gpt_training_resume(str(path), device=device)
    )
    assert restored_updates == completed_updates
    validate_mini_gpt_adamw_completed_updates(
        restored,
        restored_optimizer,
        restored_updates,
    )

    restored.eval()
    with torch.no_grad():
        restored_logits, _ = restored(inputs)
    torch.testing.assert_close(restored_logits, reference_logits)

    prompt = torch.tensor(
        [[FROZEN_STOI["我"], FROZEN_STOI["喜欢"]]],
        dtype=torch.long,
        device=device,
    )
    generated_history = generate_mini_gpt_sampled(
        restored,
        prompt,
        max_new_tokens=3,
        temperature=0.8,
        top_k=3,
    )
    assert generated_history.shape == (1, 5)


if __name__ == "__main__":
    main()`;

export const week12Revision: CuratedWeekRevision = {
  weekSlug: 'week-12',
  title: 'Week 12 - End-to-End Mini GPT：从文字、学习到恢复后生成',
  keyQuestion:
    '怎样沿同一批数据追踪 tokenizer、MiniGPT、loss、gradient、AdamW、checkpoint 与 target-free generation，并知道每一步改变了什么？',
  objectives: [
    '沿 [3,3]→[3,2]→[3,2,4]→两层 Block→[3,2,5]→[6,5]+[6]→loss[] 追踪完整 forward。',
    '从 scalar loss 反向追踪参数 gradients，区分 gradient buffer、parameter value 与 AdamW state。',
    '完成 100 次成功 update、eval/no-grad reference、canonical checkpoint、严格恢复与 restored-model generation。',
    '用 pipeline、same-batch learning、held-out generalization 三阶段诊断，并把 Weeks 1–12 接成一个心智模型。',
  ],
  estimatedReadingMinutes: 130,
  sections: [
    section(
      'o0414-week-12',
      'Week 12 核心目标：一条可追踪的完整链路',
      '前十一周分别解释了零件；如果不能从原始文字一路指出当前 tensor、owner、shape 与 state change，就仍难以判断模型是在学习、测量、保存还是生成。',
      [
        '建立唯一的固定例子，避免每节换数字造成接口错觉。',
        '明确 supervised training 在 cross-entropy 汇成 scalar objective，而 inference 从 target-free last logits 开始。',
      ],
      [
        paragraph(
          `直白地说，MiniGPT 是一个条件分数函数，training controller 才把误差变成更新。${fixedTrace}`,
        ),
        table(
          ['ID', 'token'],
          vocabularyRows,
          'mini-gpt-v1 ordered vocabulary，V=5',
        ),
        chain([
          'raw text → raw IDs [B,N]=[3,3]',
          'shift → inputs/targets [B,T]=[3,2]',
          'token + position embeddings [B,T,C]=[3,2,4]',
          'two canonical pre-norm Blocks [3,2,4]',
          'bias-free LM head logits [B,T,V]=[3,2,5]',
          'reshape logits [6,5] + targets [6] → mean loss []',
          'backward → AdamW step → checkpoint → strict restore',
          'restored target-free context → last logits [B,5] → next ID [B,1]',
        ]),
        table(
          ['监督题', 'context', 'target'],
          [
            ['1', '[我]', '喜欢'],
            ['2', '[我,喜欢]', 'AI'],
            ['3', '[猫]', '喜欢'],
            ['4', '[猫,喜欢]', '我'],
            ['5', '[我]', '学习'],
            ['6', '[我,学习]', 'AI'],
          ],
          '训练评分所有六个位置；generation 每轮只消费当前最后位置',
        ),
        formula(
          String.raw`\mathrm{text}\to\mathrm{IDs}\in\mathbb{N}^{3\times3}\to(x,y)\in\mathbb{N}^{3\times2}\to Z\in\mathbb{R}^{3\times2\times5}\to\mathcal L\in\mathbb{R}`,
          '固定训练主线从离散 ID 到三维 logits，再聚合成 rank-0 scalar loss。',
        ),
      ],
      [
        'Checkpoint 保存或恢复 state，本身不是一次 learning update。',
        'Generation 没有 training targets，也不调用 backward 或 optimizer.step。',
        'Token IDs 是 Vocabulary addresses，不具有数值距离。',
      ],
      check(
        'Supervised training 在哪个对象上第一次成为一个 scalar objective？',
        [
          paragraph(
            '当 logits [6,5] 与 targets [6] 进入 cross-entropy，得到 loss [] 时。',
          ),
        ],
      ),
    ),
    section(
      'o0415-1',
      '1. 项目结构：责任先于文件名',
      '把 tokenizer、模型、训练循环与 checkpoint 都塞进匿名大脚本，会让错误发生时无法确定由谁拥有和修改 state。',
      [
        '沿模块边界复用 Week 10/11 的稳定实现。',
        '区分 model parameters、optimizer state、transient activations 与 durable checkpoint。',
      ],
      [
        paragraph(`本周不另起配置类名，也不定义第二套 MiniGPT。${fixedTrace}`),
        table(
          ['module / object', '责任', '关键接口或长期 state'],
          [
            [
              'mini_gpt_walkthrough.py',
              'Week 10 canonical architecture',
              'GPTConfig、MiniGPT、stable member names、_init_weights',
            ],
            [
              'week11_training_and_generation.py',
              'lifecycle controller',
              'train_mini_gpt_step、validators、restore、stable sampling',
            ],
            [
              'week12_end_to_end.py',
              '组装 fixed trace',
              'batch、100 updates、reference、save/load、generate',
            ],
            [
              'checkpoint file',
              '持久化兼容 state',
              'schema、tokenizer identity、config、untied weights、AdamW、completed_updates',
            ],
          ],
        ),
        formula(
          String.raw`\theta=\{E_{\mathrm{token}},E_{\mathrm{position}},\theta_{\mathrm{block\,1}},\theta_{\mathrm{block\,2}},\theta_{\mathrm{final\,norm}},W_{\mathrm{head}}\}`,
          'Model parameters 属于 MiniGPT；AdamW moments 与 completed_updates 属于 training lifecycle。',
        ),
        callout(
          'Stable ownership',
          [
            paragraph(
              'blocks 必须是 nn.ModuleList，成员仍叫 ln1、attention、ln2、feed_forward；Attention 成员仍叫 qkv、output_projection、causal_mask。这样 parameters() 与 state_dict() 才与 Week 10 checkpoint 保持同一 namespace。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '普通 Python list 不会像 ModuleList 一样注册子模块。',
        '不能只凭 tensor shapes 猜 tokenizer meanings。',
        '不要把旧缩写 proj、ln_1、attn、ln_f 混入 canonical namespace。',
      ],
      check('哪个 owner 负责把 [B,T] 映射为 [B,T,V]？', [
        paragraph(
          'MiniGPT.forward；它委托两个 registered blocks 做 contextual transformation。',
        ),
      ]),
    ),
    section(
      'o0416-2-pipeline',
      '2. 第一次运行先验证 Pipeline',
      '随机输出看起来像文字，也可能掩盖错位 targets、非法 IDs、断开的 gradients 或没有发生的 update。',
      [
        '在讨论质量前验证每个接口和一次真实 state change。',
        '把 ln(5) 当作均匀五分类参考，而不是承诺某次初始化的实测值。',
      ],
      [
        paragraph(
          `先打印三条 raw IDs 和六道题，再验证 dtype、device、shapes、finite loss、gradients 与 parameter change。${fixedTrace}`,
        ),
        code(
          'python',
          `# excerpt: Week 12 pipeline gate
inputs, targets = make_fixed_batch(device)
assert inputs.dtype == targets.dtype == torch.long
assert inputs.shape == targets.shape == (3, 2)
before = {name: value.detach().clone() for name, value in model.named_parameters()}
loss, grad_norm, completed_updates = train_mini_gpt_step(
    model, optimizer, inputs, targets, device, completed_updates=0
)
assert completed_updates == 1
assert torch.isfinite(loss) and torch.isfinite(grad_norm)
assert any(
    not torch.equal(before[name], value.detach())
    for name, value in model.named_parameters()
)`,
          'week12_end_to_end.py',
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{uniform}}=-\log(1/V)=\log 5\approx1.609`,
          '五个候选等概率时的 mean NLL reference；随机初始 loss 可能在附近但不保证精确相等。',
        ),
        table(
          ['boundary', '固定 evidence', '失败就先查'],
          [
            [
              'tokenizer/batch',
              '[3,3]→[3,2]，long，IDs 0..4',
              'mapping 与 shift',
            ],
            [
              'forward',
              '[3,2]→[3,2,5]，loss [] finite',
              'rank、device、mask、targets',
            ],
            [
              'backward',
              'expected .grad non-None/finite',
              'graph 与 zero order',
            ],
            [
              'step',
              '至少一个 parameter value 改变，count=1',
              'optimizer binding 与 step',
            ],
          ],
        ),
      ],
      [
        'Shape 正确不证明 label semantics 或 causality 正确。',
        '某一 embedding row 不变不证明整个 update 失败。',
        '不要用一次生成样本替代 pipeline assertions。',
      ],
      check('问“文字是否好”之前至少先核对什么？', [
        paragraph(
          'ID/shift、dtype/device、shapes、finite loss/gradients、optimizer binding 和一次真实 parameter update。',
        ),
      ]),
    ),
    section(
      'o0417-3',
      '3. 从文字开始：冻结 Tokenizer 才有稳定地址',
      '用户输入是文字，而 embedding 只接受整数地址；若 mapping 在训练和恢复之间漂移，同一个 row 会突然代表另一个 token。',
      [
        '解释 tokenizer 的意义：定义离散单位与稳定 ID 协议。',
        '把 frozen encoding 与模型学习 contextual representation 分开。',
      ],
      [
        paragraph(
          `本教学 tokenizer 仅按空格切分已知词；它没有 specials、PAD 或 UNK。${fixedTrace}`,
        ),
        table(['ID', 'token'], vocabularyRows),
        code(
          'python',
          `# excerpt from the assembled Week 12 caller
RAW_TEXTS = ("我 喜欢 AI", "猫 喜欢 我", "我 学习 AI")
EXPECTED_RAW_IDS = ((0, 1, 2), (4, 1, 0), (0, 3, 2))
FROZEN_STOI = {
    token: token_id
    for token_id, token in enumerate(CANONICAL_ORDERED_TOKENS)
}

def encode_mini_gpt_v1(text: str) -> list[int]:
    pieces = text.split()
    if not pieces:
        raise ValueError("mini-gpt-v1 text must contain a token")
    try:
        return [FROZEN_STOI[piece] for piece in pieces]
    except KeyError as error:
        raise ValueError(
            f"mini-gpt-v1 has no unknown-token fallback: {error.args[0]}"
        ) from error

encoded_rows = [encode_mini_gpt_v1(text) for text in RAW_TEXTS]
assert tuple(tuple(row) for row in encoded_rows) == EXPECTED_RAW_IDS`,
          'week12_end_to_end.py',
        ),
        formula(
          String.raw`\operatorname{encode}(\text{我 喜欢 AI})=[0,1,2]\in\mathbb N^3,\qquad X_{\mathrm{raw}}\in\mathbb N^{B\times N}=\mathbb N^{3\times3}`,
          '三条等长句子编码后堆成 raw IDs [3,3]。',
        ),
        paragraph(
          'Tokenizer 只决定“切成什么、编号是什么”；embedding 与 blocks 才在训练中改变连续表示。ID 4 不是“四只猫”，只是 token 猫的第 5 个 row address。',
        ),
      ],
      [
        '不能把 Week 9 的 w09-readable-v1（V=11、T=4）IDs 送入 V=5、block_size=2 的 MiniGPT。',
        '新增 token 必须同步改变 ordered mapping、vocab_size、embedding、LM head 与 checkpoint identity。',
        'Tokenizer 不等于 semantic encoder。',
      ],
      check('把新 token 加入词表时，哪些接口必须一起变化？', [
        paragraph(
          'Frozen mapping、vocab_size、token embedding rows、LM-head candidates，以及兼容的 checkpoint identity。',
        ),
      ]),
    ),
    section(
      'o0418-4-training-batch',
      '4. Training Batch：一行文字变成两道监督题',
      'Raw sequence 只记录顺序；next-token training 还需要明确每个 context 对应哪个答案。',
      [
        '用 one-position shift 建立 teacher-forced inputs/targets。',
        '显示一个 forward 为什么同时评分六个 positions。',
      ],
      [
        paragraph(
          `raw IDs 用左两列作 inputs、右两列作 targets。Teacher forcing 提供真实前缀，而不是模型自己刚抽到的 token。${fixedTrace}`,
        ),
        table(
          ['row', 'raw IDs [N=3]', 'inputs [T=2]', 'targets [T=2]', '两道题'],
          batchRows,
        ),
        code(
          'python',
          `raw = torch.tensor(
    [[0, 1, 2], [4, 1, 0], [0, 3, 2]],
    dtype=torch.long,
    device=device,
)  # [B,N] = [3,3]
inputs = raw[:, :-1]   # [[0,1],[4,1],[0,3]] [B,T]=[3,2]
targets = raw[:, 1:]   # [[1,2],[1,0],[3,2]] [B,T]=[3,2]`,
        ),
        formula(
          String.raw`x=X_{\mathrm{raw}}[:,0:N-1],\qquad y=X_{\mathrm{raw}}[:,1:N],\qquad x,y\in\mathbb N^{3\times2}`,
          '每个 target 正好是同一 raw row 中对应 input position 的下一个 ID。',
        ),
        callout('同一个 [我] 的两种答案', [
          paragraph(
            'b=0,t=0 与 b=2,t=0 的 causal context 都只有 [我]，targets 却分别是 喜欢 和 学习。这是数据中的真实冲突，后面会决定 one-batch loss 不可能趋近 0。',
          ),
        ]),
      ],
      [
        'targets=inputs 会变成复制当前 token，而不是预测下一个 token。',
        'Cross-entropy targets 必须是 integer class IDs，不是 one-hot float vectors。',
        'Training 评分所有 B×T=6 个 positions，不能只取最后位置。',
      ],
      check('第三行 input 学习 的 target 是什么？', [paragraph('AI，ID 2。')]),
    ),
    section(
      'o0419-5-embedding-lookup',
      '5. Embedding Lookup：离散地址变成四个可学习 Features',
      '把 ID 当普通数字会错误暗示猫=4 比我=0“大”；模型需要每个类别自己的可学习向量，同时还要知道位置。',
      [
        '展示 token row lookup 与 position row lookup 的区别。',
        '解释 [T,C] position tensor 如何沿 B broadcast 到 [B,T,C]。',
      ],
      [
        paragraph(
          `token_embedding 选 row，position_embedding 选位置；两者相加后才进入 Block。${fixedTrace}`,
        ),
        code(
          'python',
          `B, T = inputs.shape
positions = torch.arange(T, device=inputs.device)  # [T]=[2]
token_rows = model.token_embedding(inputs)         # [B,T,C]=[3,2,4]
position_rows = model.position_embedding(positions) # [T,C]=[2,4]
x = token_rows + position_rows                     # [3,2,4]`,
        ),
        table(
          ['axis', '值', '含义'],
          [
            ['B=3', '三行', '三个 sequences'],
            ['T=2', '两列', '每行两个 input positions'],
            ['C=4', '四通道', '模型学习的 features，不是人工命名属性'],
          ],
        ),
        formula(
          String.raw`X^{(0)}=E_{\mathrm{token}}[x]+E_{\mathrm{position}}[0:T]\in\mathbb R^{3\times2\times4}`,
          '位置 rows [2,4] 在 batch axis 上广播，与每个 sequence 的 token rows 对齐。',
        ),
      ],
      [
        'Position IDs 与 token IDs 是两套 lookup addresses。',
        'Embedding 尚未跨 positions 混合信息。',
        'Addition 要求最后的 C=4 对齐；它不是 concatenation。',
      ],
      check('为什么 [3,2,4] 可以与 [2,4] 相加？', [
        paragraph('[2,4] 沿 batch axis 广播成逻辑上的 [3,2,4]。'),
      ]),
    ),
    section(
      'o0420-6-transformer-block',
      '6. Transformer Block：跨位置读取，再逐位置变换',
      '独立 embedding 无法让第二个“喜欢”的表示因前面是“我”或“猫”而不同。',
      [
        '解释 pre-norm Attention 与 FFN 的不同用途。',
        '让两个 residual additions 都保持 [B,T,C] 不变。',
      ],
      [
        paragraph(
          `两个 canonical blocks 依次处理同一个 [3,2,4] 表示；Attention mixing T，FFN 在每个位置 mixing C。${fixedTrace}`,
        ),
        code(
          'python',
          `# exact Week 10 member names
def forward(self, x: torch.Tensor) -> torch.Tensor:
    x = x + self.attention(self.ln1(x))       # [3,2,4] + [3,2,4]
    x = x + self.feed_forward(self.ln2(x))    # [3,2,4] + [3,2,4]
    return x                                  # [3,2,4]`,
        ),
        formula(
          String.raw`X'=X+\operatorname{Attention}(\operatorname{LN}_1(X)),\qquad X^{\mathrm{next}}=X'+\operatorname{FFN}(\operatorname{LN}_2(X'))`,
          'Pre-norm 先归一化 sublayer input；residual 把 sublayer output 加回原路径。',
        ),
        table(
          ['component', '读取范围', '内部宽度', 'external shape'],
          [
            [
              'causal Attention',
              '允许的当前/左侧 positions',
              'H=2，d_head=2',
              '[3,2,4]→[3,2,4]',
            ],
            [
              'FFN',
              '每个 position 独立',
              'C→4C→C，即 4→16→4',
              '[3,2,4]→[3,2,4]',
            ],
          ],
        ),
      ],
      [
        'Residual 是逐元素 addition，不是 concatenation。',
        'FFN 不负责跨 token positions 读取。',
        'Causal mask 必须阻止当前位置读取右侧 target。',
      ],
      check('哪个 sublayer 让位置 1 能读取位置 0？', [
        paragraph('Causal self-Attention。'),
      ]),
    ),
    section(
      'o0421-7-q-k-v-shape-trace',
      '7. Q/K/V Shape Trace：把上下文查询摊成矩阵',
      '只背 Q、K、V 名字，仍无法知道 score matrix 的两条 T 轴如何形成，mask 又在遮哪一边。',
      [
        '从 [3,2,4] 追踪 combined QKV、head split、scores、weights 与 merged values。',
        '给 query rows 与 key columns 明确命名。',
      ],
      [
        paragraph(
          `Query 表示目的位置在找什么，Key 表示来源位置可匹配什么，Value 表示匹配后带回什么。${fixedTrace}`,
        ),
        table(
          ['operation', 'shape', 'axes'],
          [
            ['x', '[3,2,4]', '[B,T,C]'],
            ['qkv(x)', '[3,2,12]', '[B,T,3C]'],
            ['q,k,v', 'each [3,2,4]', '[B,T,C]'],
            ['split/transpose', 'each [3,2,2,2]', '[B,H,T,d_head]'],
            ['q @ kᵀ', '[3,2,2,2]', '[B,H,query T,key T]'],
            ['masked Softmax', '[3,2,2,2]', 'visible key columns sum to 1'],
            ['weights @ v', '[3,2,2,2]', '[B,H,T,d_head]'],
            ['merge + output_projection', '[3,2,4]', '[B,T,C]'],
          ],
        ),
        formula(
          String.raw`S=QK^{\mathsf T}/\sqrt{d_{\mathrm{head}}}\in\mathbb R^{B\times H\times T\times T},\qquad d_{\mathrm{head}}=C/H=2`,
          '最后两轴是 destination query positions × source key positions；缩放除以根号 2。',
        ),
        formula(
          String.raw`A=\operatorname{softmax}(\operatorname{mask}(S)),\qquad \operatorname{Attention}(Q,K,V)=AV`,
          '先把未来 key scores 设为负无穷，再沿 key axis 做 Softmax 并聚合 Values。',
        ),
        callout('T=2 的 causal visibility', [
          paragraph(
            'Query row 0 只能读 key column 0；query row 1 可读 columns 0 和 1。每个 batch row、每个 head 都有自己的 [2,2] score matrix。',
          ),
        ]),
      ],
      [
        '缩放项是 sqrt(d_head)=sqrt(2)，不是 sqrt(C)。',
        'Mask 必须发生在 Softmax 之前。',
        'K 的 transpose 只交换最后两个 T/d_head axes。',
      ],
      check('一个 batch example 的一个 head 有多大的 score matrix？', [
        paragraph('[T,T]=[2,2]，query rows × key columns。'),
      ]),
    ),
    section(
      'o0422-8-lm-head-logits',
      '8. LM Head：每个位置给五个候选打分',
      'Contextual features 的最后一维是 C=4，不是可直接解释的 token probabilities。',
      [
        '用 final_norm 与 bias-free LM head 把 C=4 映射为 V=5。',
        '明确 logits 是 raw scores，候选顺序来自 frozen tokenizer。',
      ],
      [
        paragraph(
          `两个 blocks 后仍是 [3,2,4]；final_norm 保持 shape，lm_head 为每个位置产生五个 scores。${fixedTrace}`,
        ),
        code(
          'python',
          `for block in model.blocks:
    x = block(x)                 # [3,2,4]
x = model.final_norm(x)          # [3,2,4]
logits = model.lm_head(x)         # [3,2,5], bias=False`,
        ),
        formula(
          String.raw`Z=X^{(2)}W_{\mathrm{head}}^{\mathsf T}\in\mathbb R^{3\times2\times5},\qquad W_{\mathrm{head}}\in\mathbb R^{5\times4}`,
          'PyTorch Linear 使用五个 output rows 点乘四维表示；canonical LM head 没有 bias。',
        ),
        table(
          ['selected row', '表示的 context', '五个 candidate order'],
          [
            ['logits[0,0,:]', '[我]', '[我,喜欢,AI,学习,猫]'],
            ['logits[0,1,:]', '[我,喜欢]', '[我,喜欢,AI,学习,猫]'],
          ],
        ),
      ],
      [
        'Logits 不是 probabilities；训练 CE 接收 raw logits。',
        '位置 0 的 row 只看见第一个 input token，不代表整行 context。',
        '不要给 bias-free equation 加不存在的 +b。',
      ],
      check('为什么每个 position 恰有五个 logits？', [
        paragraph(
          'V=5；每个 score 对应 frozen ordered vocabulary 中一个 next-token candidate。',
        ),
      ]),
    ),
    section(
      'o0423-9-cross-entropy-loss',
      '9. Cross Entropy：六个预测汇成一个 Scalar Loss',
      '一次 forward 返回六组候选 scores，而 optimizer 需要一个可微 scalar 来衡量整批错误。',
      [
        '解释 flatten 只合并 B/T axes，不会删除任何监督题。',
        '用一个带标签 logit row 手算概率和 NLL，再与 batch mean 分开。',
      ],
      [
        paragraph(
          `logits [3,2,5] reshape 为 [6,5]，targets [3,2] reshape 为 [6]；row order 同步，所以六道题仍一一对齐。${fixedTrace}`,
        ),
        code(
          'python',
          `flat_logits = logits.reshape(6, 5)
flat_targets = targets.reshape(6)
loss = torch.nn.functional.cross_entropy(flat_logits, flat_targets)
assert loss.ndim == 0`,
        ),
        formula(
          String.raw`\mathcal L=-\frac1{BT}\sum_{b=1}^{B}\sum_{t=1}^{T}\log p_\theta(y_{b,t}\mid x_{b,\le t}),\qquad Z_{\mathrm{flat}}\in\mathbb R^{6\times5}`,
          'Mean cross-entropy 对六个 aligned target log-probabilities 取平均。',
        ),
        callout('单位置数学例子，不是训练后的 batch 实测', [
          paragraph(
            '候选顺序 [我,喜欢,AI,学习,猫]，若 raw logits=[0,2,1,-1,0] 且 target=喜欢，则 Softmax target probability≈0.592，single-position NLL=-ln(0.592)≈0.524。',
          ),
          formula(
            String.raw`p_{\mathrm{target}}=\frac{e^2}{e^0+e^2+e^1+e^{-1}+e^0}\approx0.592,\qquad -\ln p_{\mathrm{target}}\approx0.524`,
            '固定 didactic logits 的单题结果；不是声称模型训练后一定产生这些数。',
          ),
        ]),
      ],
      [
        '不要在 F.cross_entropy 前先 Softmax。',
        'Targets 必须是 long class IDs [6]，不是 float one-hot。',
        'Single-position 0.524 不等于整批 mean loss。',
      ],
      check('Targets [3,2] flatten 后是什么 shape？', [
        paragraph('[6]，每项是一个 integer class ID。'),
      ]),
    ),
    section(
      'o0424-10-backward-trace',
      '10. Backward Trace：从一个数回到所有参与参数',
      'Loss 只是测量；如果不对参数求导，就没有“往哪里改”这条信号。',
      [
        '沿 LM head→final norm→两 blocks→embeddings 追踪 chain rule。',
        '区分 backward 写 gradient buffer 与 optimizer.step 改 parameter value。',
      ],
      [
        paragraph(
          `loss.backward() 反向穿过构建它的 graph，把 derivatives 累加进 participating parameters 的 .grad；此时 parameter values 还没变。${fixedTrace}`,
        ),
        chain([
          'loss []',
          'six logit rows [6,5]',
          'lm_head.weight.grad [5,4] + final_norm grads',
          'Block 2 grads → Block 1 grads',
          'token/position embedding table grads [5,4] / [2,4]',
          'optimizer.step() 之后才产生新 parameter values',
        ]),
        code(
          'python',
          `optimizer.zero_grad(set_to_none=True)
logits, loss = model(inputs, targets)
assert loss is not None and loss.ndim == 0
loss.backward()
assert model.lm_head.weight.grad is not None
assert model.lm_head.weight.grad.shape == (5, 4)
assert model.token_embedding.weight.grad is not None
assert model.token_embedding.weight.grad.shape == (5, 4)
# Parameters still hold pre-step values here.`,
        ),
        formula(
          String.raw`g_\theta=\nabla_\theta\mathcal L,\qquad \theta_{\mathrm{new}}=\theta_{\mathrm{old}}\ \text{until optimizer.step() succeeds}`,
          'Backward computes and accumulates gradients; it does not apply the update.',
        ),
      ],
      [
        'Gradients 默认累加；遗漏 zero_grad 会混入旧窗口。',
        'loss.item() 是 detached reporting value，不能再 backward。',
        'Gradient shape 与 parameter shape 对齐，但数值不等于 parameter value。',
      ],
      check('Backward 后、step 前，什么变了？', [
        paragraph(
          'parameter.grad buffers 变了；parameter values 与 AdamW moments 尚未更新。',
        ),
      ]),
    ),
    section(
      'o0425-11-embedding-rows',
      '11. Embedding Rows：被查到的行才有直接 Lookup Gradient',
      '看到 embedding table [5,4] 容易误以为每一批都会同样更新五个 token rows。',
      [
        '把 input usage 与 LM-head target usage 分开。',
        '准确解释 ID 2 在 untied architecture 中的 direct gradient path。',
      ],
      [
        paragraph(
          `inputs 中出现 IDs {0,1,3,4}；ID 2/AI 只出现在 targets。本模型 token_embedding 与 lm_head untied。${fixedTrace}`,
        ),
        table(
          [
            'ID/token',
            'input lookup?',
            'target candidate?',
            '本 batch 的直接路径',
          ],
          [
            [
              '0/我',
              '是',
              '是',
              'token row lookup + LM-head target/non-target scoring',
            ],
            ['1/喜欢', '是', '是', 'token row lookup + LM-head scoring'],
            [
              '2/AI',
              '否',
              '是',
              'token_embedding row 2 无直接 lookup gradient；lm_head row 2 受 targets 影响',
            ],
            ['3/学习', '是', '是', 'token row lookup + LM-head scoring'],
            [
              '4/猫',
              '是',
              '否',
              'token row lookup；LM-head row 4 仍作为非目标候选参与 Softmax',
            ],
          ],
        ),
        formula(
          String.raw`\frac{\partial\mathcal L}{\partial E_{\mathrm{token}}[i]}=\sum_{(b,t):x_{b,t}=i}\frac{\partial\mathcal L}{\partial X^{(0)}_{b,t}}`,
          'Embedding lookup 对同一 ID 的所有使用位置累加 row gradient；未 lookup 的 row 没有这条直接路径。',
        ),
        code(
          'python',
          `row_grad_norms = model.token_embedding.weight.grad.norm(dim=1)
print(row_grad_norms)  # exact values depend on initialization/device
# Inspect finiteness and expected direct-use pattern; do not hard-code magnitudes.`,
        ),
        paragraph(
          '“row 2 没有直接 token-embedding lookup gradient”不等于 AI 对 loss 完全没有作用：它作为 target 改变 untied lm_head 的 output-row gradients，并通过 logits/loss 影响上游已使用 representations。',
        ),
        callout(
          'Gradient 为零，不代表 Step 后参数值一定不动',
          [
            paragraph(
              '本 runner 的 nn.Embedding 使用 dense parameter gradient，AdamW 又设置 weight_decay=1e-2。当前 batch 未 lookup ID 2，所以 token_embedding.weight.grad[2] 的直接 lookup contribution 为零；但 optimizer.step() 的 decoupled weight decay 仍可缩放非零 row-2 parameter value。若是 faithful resume，历史 exp_avg/exp_avg_sq moments 也可能在当前 row gradient 为零时产生更新方向。',
            ),
          ],
          'principle',
        ),
        table(
          ['观察时点', 'row 2 的对象', '本 trace 能说什么'],
          [
            [
              'backward 后',
              'dense .grad[2]',
              'direct lookup contribution 为 0',
            ],
            [
              'step 前',
              'AdamW moments + weight_decay policy',
              '与当前 .grad 是不同 state',
            ],
            [
              'step 后',
              'token_embedding.weight[2] parameter value',
              '可能因 decay；resume 时也可能因历史 moments 而移动',
            ],
          ],
        ),
        code(
          'python',
          `# excerpt immediately around one fresh runner update
optimizer.zero_grad(set_to_none=True)
_, loss = model(inputs, targets)
assert loss is not None
row2_before = model.token_embedding.weight[2].detach().clone()
loss.backward()
row2_current_grad = model.token_embedding.weight.grad[2].detach().clone()
assert torch.count_nonzero(row2_current_grad).item() == 0
optimizer.step()  # AdamW uses weight_decay=1e-2 and any restored moments
row2_after = model.token_embedding.weight[2].detach().clone()
print("row2_moved_after_step=", not torch.equal(row2_before, row2_after))`,
        ),
      ],
      [
        '不要把 parameter gradient 与 parameter value 混成同一对象。',
        '不要说 ID 2 对 loss 完全无作用。',
        '不要从 current direct lookup gradient=0 推断 post-step row value 必然不变；还要检查 decoupled weight decay 与 optimizer history。',
        '若 weight tying，input/output 共用一个 table，direct-row 区分会改变；本 canonical model 明确 untied。',
      ],
      check('哪个 ID 未出现在 inputs，却出现在 targets？其直接影响在哪里？', [
        paragraph(
          'AI/2；token_embedding row 2 的当前 direct lookup gradient 为零，但 untied lm_head row 2 会因 target scoring 得到 gradient。step 后 token-embedding row 2 仍可能因本 runner 的 AdamW weight_decay=1e-2 移动；faithful resume 时历史 moments 也可能推动它。',
        ),
      ]),
    ),
    section(
      'o0426-12-optimizer-step',
      '12. Optimizer Step：读取 Gradient，更新参数与 AdamW 状态',
      'Gradient 给出局部方向，却还需要 learning rate、moments 与 weight decay policy 才能形成稳定 update。',
      [
        '按 zero→forward→backward→clip→step 顺序解释每种 state。',
        '只在 optimizer.step 成功返回后增加 completed_updates。',
      ],
      [
        paragraph(
          `AdamW 对每个 canonical parameter 保存 moving moments/counter；Week 11 validator 还验证唯一 group 与 object identity/order。${fixedTrace}`,
        ),
        table(
          [
            'operation',
            'parameter.grad',
            'parameter values',
            'AdamW state / count',
          ],
          [
            ['zero_grad', '清空', '不变', '不变'],
            ['forward + loss', '尚未写新值', '不变', '不变'],
            ['backward', '写入/累加', '不变', '不变'],
            ['clip', '可能原地缩放', '不变', '不变'],
            ['optimizer.step', '被读取', '更新', 'moments/counters 更新'],
            [
              'step 成功后',
              '仍在，等待清理',
              '已更新',
              'completed_updates += 1',
            ],
          ],
        ),
        formula(
          String.raw`m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\qquad v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2`,
          'AdamW 为每个 parameter element 维护 gradient 的一阶 moving average m 与 squared-gradient 的二阶 moving average v。',
        ),
        formula(
          String.raw`\widehat m_t=\frac{m_t}{1-\beta_1^t},\qquad \widehat v_t=\frac{v_t}{1-\beta_2^t}`,
          'Early-step bias corrections 抵消从零初始化 moments 带来的缩小。',
        ),
        formula(
          String.raw`\theta_t=(1-\eta\lambda)\theta_{t-1}-\eta\frac{\widehat m_t}{\sqrt{\widehat v_t}+\epsilon}`,
          '在 canonical AdamW 默认方向下的简化逐元素直觉：weight decay 以独立乘法缩放参数，再减去 bias-corrected adaptive direction。实际 optimizer 还受其明确 options 与数值实现约束。',
        ),
        paragraph(
          'Plain SGD 的基本式是 θ_t=θ_{t-1}−ηg_t；AdamW 不直接把 raw g_t 当 update。即使当前 g_t 的某个 row 为零，decoupled factor (1−ηλ) 仍可改变非零参数；恢复的 m/v history 也可让 adaptive term 非零。',
        ),
        code(
          'python',
          `loss.backward()
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
optimizer.step()
completed_updates += 1  # only after the successful step returns`,
        ),
      ],
      [
        '把 zero_grad 放到 backward 后、step 前会擦掉本次 signal。',
        '调用 step 两次会重复消费同一批 gradients。',
        'requested loop count 不是 completed_updates；后者只能记录成功 steps。',
      ],
      check(
        '第一行真正改变 model.state_dict() parameter values 的操作是什么？',
        [paragraph('optimizer.step()。')],
      ),
    ),
    section(
      'o0427-13-training',
      '13. 项目 A：固定三句的训练与保存加载',
      '零散 excerpts 容易漏掉 save 后的严格 reload，或继续用内存中的旧 model 生成，从而没有真正验证持久化链路。',
      [
        '展示一个按静态顺序可编译的 Week 12 caller。',
        '完成 fixed batch→100 successful updates→eval reference→save→strict resume→logits equality→restored generation。',
        '在 update window 前后运行时观测同一个 labelled context 的五候选 probabilities，不预填或承诺数值方向。',
      ],
      [
        paragraph(
          '下面文件依赖 Week 10 的 mini_gpt_walkthrough.py 与 Week 11 的 week11_training_and_generation.py。它只调用冻结 API，不重定义 GPTConfig、MiniGPT、initializer、state-dict namespace、checkpoint schema 或 sampling helper。',
        ),
        code('python', endToEndRunner, 'week12_end_to_end.py'),
        formula(
          String.raw`P=5\cdot4+2\cdot4+2(8+48+20+8+80+68)+8+5\cdot4=520`,
          'Untied canonical model 共 520 trainable parameters；causal mask buffer 与 AdamW state 不计入。',
        ),
        table(
          ['checkpoint identity field', '固定内容'],
          [
            ['schema', 'mini-gpt-training-checkpoint / version 1'],
            [
              'tokenizer',
              'mini-gpt-v1 ordered tokens + exact policy + SHA-256',
            ],
            [
              'tokenizer SHA-256',
              '38d630f4c589664c9bef567457d48764cbe2307734777e80f7d5d5c63ac88dd6',
            ],
            ['config', 'GPTConfig(5,2,4,2,2)，无 dropout'],
            ['weight policy', 'token_embedding_lm_head=untied'],
            [
              'training state',
              'model_state + exact AdamW class/state + completed_updates=100',
            ],
          ],
        ),
        paragraph(
          '训练 loss 的具体轨迹与生成 token 依赖初始化、device 和软件版本，因此程序只观测和验证，不在教材中捏造概率或样本。Tying 仅作概念对比：共享 5×4 table 会得到 500 parameters，却改变 gradient sharing 与 checkpoint policy；本 trace 不启用。',
        ),
        table(
          ['runtime observation', 'label / shape', '怎样报告'],
          [
            [
              'before_probs',
              '[我,喜欢]→AI 的 update 前 [5]',
              '按 CANONICAL_ORDERED_TOKENS 顺序打印',
            ],
            [
              'after_probs',
              '同一 row 的 100 successful updates 后 [5]',
              '从 reference_logits[0,1,:] 现场计算并打印',
            ],
            [
              'interpretation',
              '一次特定 seed/device/version 的观测',
              '不 hard-code、不 assert 上升方向、不推广为普遍事实',
            ],
          ],
        ),
        paragraph(
          'Runner 先在 eval/no_grad 下记录 before_probs，再训练；随后从 post-update reference_logits 计算 after_probs。两者都明确标为 context=[我,喜欢]、target=AI，并连同 Vocabulary order 输出，因此读者能核对这次运行发生了什么，而不是把教材数字误当保证。',
        ),
      ],
      [
        '不要生成后才发现从未 load checkpoint；这里从 restored model 生成。',
        '不要把 zero-based loop index 保存成 update count。',
        '不要称 same fixed batch 的下降为 held-out validation。',
        'Runner 只使用 PyTorch RNG：torch.manual_seed 与 CUDA 可用时的 manual_seed_all；它不使用 Python random。Seed 不保证跨不同 device/version bit-for-bit 相同。',
      ],
      check('为什么 saved completed_updates 是 100，而不是 99？', [
        paragraph(
          '循环执行并成功完成 100 次 optimizer.step；它记录 count，不记录最后一次 zero-based index。',
        ),
      ]),
    ),
    section(
      'o0428-14-autoregressive-generation-trace',
      '14. Autoregressive Generation：裁 Context、取最后一行、抽一个 ID',
      'Forward 为每个输入位置都返回 logits，但续写只应回答“整个当前可见 prompt 后面是什么”。',
      [
        '把 training-all-positions 与 generation-last-position 分开。',
        '沿 stable τ/top-k/Softmax/multinomial 得到 long [B,1]，再追加未裁剪 history。',
      ],
      [
        paragraph(
          `从 restored model 和 prompt [[0,1]]=[我,喜欢] 开始；不传 targets，因此 loss 为 None，也没有 update。${fixedTrace}`,
        ),
        chain([
          'uncropped history [1,2] = [[0,1]]',
          'crop forward context to last block_size=2 IDs [1,2]',
          'restored(context), targets=None → logits [1,2,5]',
          'logits[:,-1,:] → last_logits [1,5]',
          'promote/row-center/divide by τ → optional top-k → checked Softmax [1,5]',
          'multinomial → next_id torch.long [1,1]',
          'append to uncropped history → [1,3]，repeat',
        ]),
        formula(
          String.raw`[B,L_{\mathrm{history}}]\to[B,\min(L_{\mathrm{history}},2)]\to[B,T_{\mathrm{context}},5]\to[B,5]\to[B,1]\to[B,L_{\mathrm{history}}+1]`,
          '只裁 forward context；caller 保存并增长完整 history。',
        ),
        table(
          ['phase', 'positions consumed', 'targets?', 'state change'],
          [
            [
              'training',
              'all B×T=6 logits rows',
              '有 [3,2]',
              'backward + step 更新 θ/AdamW',
            ],
            [
              'generation',
              'only final row per prompt [B,5]',
              '无',
              '只增长 caller history',
            ],
          ],
        ),
      ],
      [
        '不能 append [B,V] probabilities；必须 sample integer [B,1]。',
        '不要从所有 [B,T,V] rows 同时 sampling。',
        '极小正 τ 也可能造成 scaled overflow；复用 Week 11 stable validator/helper。',
        '不要编造 restored model 必然抽到哪个 token。',
      ],
      check('logits [3,2,5] 的 logits[:,-1,:] 是什么 shape？', [
        paragraph('[3,5]，三个 prompt rows 各一个五候选分布。'),
      ]),
    ),
    section(
      'o0429-15',
      '15. 为什么朴素生成会重复计算过去',
      '每轮把整个 cropped context 再送入模型，会重复算以前 token 的 Q/K/V 与 block activations。',
      [
        '先维护正确的 full-history/cropped-context 分工，再解释效率限制。',
        '把 context cropping 与 KV caching 区分。',
      ],
      [
        paragraph(
          `当 history=[0,1,2]、block_size=2，下一轮只 forward [1,2]，但这两个位置的两层 activations 都会重新计算。${fixedTrace}`,
        ),
        table(
          ['strategy', '保存什么', '每轮工作', 'trade-off'],
          [
            [
              '朴素 loop',
              'caller full token IDs',
              '重算 cropped context 的全部 layers',
              '最清楚、最容易验证',
            ],
            [
              'KV cache',
              '每层 past keys/values + positions',
              '主要计算新 token',
              '更快但需严格管理 cache shape/device/reset',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{attention\ score\ work\ per\ full\ prefix}=O(T_{\mathrm{context}}^2),\qquad \sum_{t=1}^{L}O(t^2)=O(L^3)`,
          '不裁剪、反复重算不断增长 prefix 时，attention score work 的粗略累计量是 cubic；本例 block_size=2 使单轮 bounded。',
        ),
        paragraph(
          'KV cache 是性能优化，不改变 causal condition 或抽样分布；本最小教学程序故意不实现，以免把 correctness trace 与 cache bookkeeping 混在一起。',
        ),
      ],
      [
        'Context crop 不是 KV cache。',
        '不同 prompts 之间必须 reset cache。',
        '优化不得让 future positions 泄漏进 earlier logits。',
      ],
      check('为什么 block_size=2 仍有重复计算？', [
        paragraph(
          '每轮仍重新计算 cropped context 中两个 positions 的 layer activations。',
        ),
      ]),
    ),
    section(
      'o0430-16',
      '16. 三阶段诊断：Pipeline、Same-batch Learning、Generalization',
      '同时更换数据、模型大小、训练循环与 sampling，会让任何改善或失败都无法归因。',
      [
        '把 collapsed child stages 合并成有 stop condition 的顺序。',
        '承认 fixed batch 的 conflicting [我] labels 和不可达有限权重下界。',
      ],
      [
        paragraph(
          `三个阶段回答不同问题：代码能否流通、模型能否从这批数据学到其可表达的规律、规律能否用于未见数据。${fixedTrace}`,
        ),
        table(
          ['stage', '冻结什么', 'evidence', 'stop condition'],
          [
            [
              '1 Pipeline correctness',
              'fixed batch/config/seed',
              '[3,2]→[3,2,5]→[]；finite grads；parameter changes',
              '任一边界失败就停止',
            ],
            [
              '2 Same-batch learning',
              '重复同一 fixed batch',
              'loss 显著低于 ln(5)，可区分 contexts 分化；[我]趋向 empirical 0.5/0.5',
              '不要要求 loss=0 或六题全 argmax',
            ],
            [
              '3 Generalization',
              '更大 corpus 的 frozen train/held-out split',
              'eval + no_grad 的 held-out token-weighted loss 与 samples',
              '只有这里可讨论 generalization',
            ],
          ],
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{validation}}=\frac{\sum_{i\in\mathrm{held\text{-}out\ valid\ targets}}\ell_i}{\sum_{\mathrm{held\text{-}out\ batches}}\#\mathrm{valid\ targets}}`,
          'Validation 要累加所有有效 target tokens 的 loss sum，再除以有效 target 总数；不能平均各 batch 的 mean loss。',
        ),
        code(
          'python',
          `@torch.no_grad()
def evaluate_token_weighted(model, held_out_batches, device, ignore_index=-100):
    was_training = model.training
    total_loss_sum = 0.0
    total_valid_targets = 0
    model.eval()
    try:
        for inputs, targets in held_out_batches:
            inputs, targets = inputs.to(device), targets.to(device)
            logits, no_loss = model(inputs)  # read-only; no training targets branch
            assert no_loss is None
            flat_targets = targets.reshape(-1)
            total_loss_sum += torch.nn.functional.cross_entropy(
                logits.reshape(-1, model.config.vocab_size),
                flat_targets,
                ignore_index=ignore_index,
                reduction="sum",
            ).item()
            total_valid_targets += int(
                flat_targets.ne(ignore_index).sum().item()
            )
    finally:
        model.train(was_training)
    if total_valid_targets == 0:
        raise ValueError("held-out evaluation has no valid targets")
    return total_loss_sum / total_valid_targets`,
          'week12_validation_excerpt.py',
        ),
        formula(
          String.raw`\inf\mathcal L_{\mathrm{fixed\ batch}}=\frac{-\log(1/2)-\log(1/2)}{6}=\frac{\ln(2)}{3}\approx0.231`,
          '四个无冲突 tasks 可趋近 target probability 1；两个相同 context [我] 的 empirical optimum 在 喜欢/学习 间各 0.5。有限 logits 只能趋近 ln(2)/3≈0.231 这个 infimum。',
        ),
        formula(
          String.raw`\mathcal L_{\mathrm{train}}\downarrow\ \not\Rightarrow\ \mathcal L_{\mathrm{held\text{-}out}}\downarrow`,
          'Repeated fixed-batch fitting 不能替代 held-out generalization evidence。',
        ),
        callout('可区分 Context 的检查', [
          paragraph(
            '[我,喜欢]→AI 与 [猫,喜欢]→我 拥有不同 causal prefixes，模型有机会让它们的 last-position distributions 分化；这比要求两个相同 [我] contexts 同时 argmax 不同答案更合理。',
          ),
        ]),
      ],
      [
        '不要把 same-corpus score 称为 validation。',
        '不要计算 mean-of-batch-means；不同 batches 的有效 target 数可能不同。',
        'Validation 使用 eval + no_grad + reduction=sum/valid-count，不调用 backward 或 step。',
        '不要用 sampling randomness 掩盖概率分布。',
        '不要在 pipeline assertion 失败时通过加大模型补偿。',
      ],
      check('哪个 stage 才能声称评估 generalization？', [
        paragraph(
          'Stage 3；必须在真正 held-out examples 上 read-only evaluation。',
        ),
      ]),
    ),
    section(
      'o0434-17-corpus',
      '17. 项目 B：用独立文档完成训练、验证与结果解释',
      '反复学习三句话能检查更新链路，却回答不了“遇到没参与更新的资料时怎样”。现在保留同一个 MiniGPT 类，明确开启一个独立文档实验。',
      [
        '先按文档划分，再各自构造窗口；不要把验证内容喂给 optimizer。',
        '用同一种损失和同一种评估模式比较训练/验证，保存真正运行的结果。',
      ],
      [
        paragraph(
          '本实验使用下载包 data/documents 内的 8 篇原创英文训练短文和 3 篇独立验证短文。题材都与观察、学习、日常活动有关，降低“完全不同领域”造成的混淆，但材料很少、文风单一，不能作为语言能力 benchmark。训练文件不含验证原文，不等于已经排除所有近似重复或数据偏差。',
        ),
        table(
          ['条件', '本实验设置', '为什么明确写出'],
          [
            [
              '输入单位',
              '30 个固定字符：a–z、空格、句点、逗号、换行',
              '字符表独立规定，不从验证集扩词表。',
            ],
            [
              '模型',
              '同一 MiniGPT 类；T_max=24、C=32、H=4、2 个 block',
              '这是新配置，不再声称默认五词模型只有 520 参数。',
            ],
            [
              '结构',
              '手写 causal attention、Pre-Norm、GELU FFN、不共享权重、无 dropout',
              '机制与主线一致；改变数据后明确新建模型。',
            ],
            [
              '训练',
              'CPU、seed=7、batch=4、AdamW lr=0.003、decay=0.01、梯度范数上限 1',
              '记录实际条件；不承诺某个速度或收敛数值。',
            ],
            [
              '评估',
              '每 20 次更新，在全部固定训练/验证窗口上 eval + no_grad',
              '不用不同随机小批次制造误导曲线，也不改变训练抽样随机序列。',
            ],
          ],
        ),
        paragraph(
          '先分文档，再切窗口。T=24 意味着每道窗口要取连续 25 个字符：前 24 个作输入，后 24 个作目标。stride=24 让相邻窗口的目标位置不重叠；不足 25 个字符的末尾部分不用于本实验，报告会记录真正计分的目标数量。窗口不跨文档，更不能跨训练/验证边界。',
        ),
        code(
          'text',
          '示意一个文档开头（实际程序按字符切，不按单词）：\n原始 25 个字符  [c0,c1,...,c24]\ninputs 长度 24 [c0,c1,...,c23]\ntargets 长度24 [c1,c2,...,c24]\n下一窗从 c24 开始；它的第一个目标是 c25。',
        ),
        paragraph(
          '回忆 Week 6：给出目标不表示模型能看见目标。位置 t 的输出只使用本窗口中到 t 为止的输入。把不同位置都算 loss，是并行提供多道监督题，不是取消 causal mask。',
        ),
        code(
          'bash',
          'cd course_examples\npython week12_generalization.py --steps 200 --eval-every 20 --seed 7 --output runs/first',
        ),
        paragraph(
          '这是可直接运行的完整程序，需要先按下载包 README 安装 PyTorch。输出目录必须不存在；重复实验请换成 runs/second，程序不会覆盖原记录。不需要下载外部语料，也不需要 GPU。',
        ),
        table(
          ['生成的文件', '怎样阅读它'],
          [
            [
              'config.json',
              '记录 Python/PyTorch、CPU、seed、模型、词表和评估设置。',
            ],
            [
              'data_report.json',
              '逐文档字符数、窗口数、文本校验值、完整包含检查和 48 字符重叠计数。',
            ],
            [
              'loss.csv / loss.svg',
              '每次记录都来自真正 forward；两条曲线都在 eval 模式下对固定窗口计算。',
            ],
            [
              'samples.json',
              '三个固定 prompt 的续写；可能重复、拼写混乱，不能只挑最好的一条。',
            ],
            [
              'inference.pt',
              '模型配置、词表、权重及明确的文件格式；只用于加载推理，不包含精确续训所需全部状态。',
            ],
            [
              'experiment_record.md',
              '实际首尾损失和加载差异，以及需要你自己补写的解释。',
            ],
          ],
        ),
        paragraph(
          '如何汇总验证 Loss？假设一批有 48 个有效目标，平均损失 2；另一批有 24 个有效目标，平均损失 1。总平均是 (48×2+24×1)/(48+24)=1.6667，不是直接平均两个 batch 得 1.5。程序累加每批平均损失乘有效目标数，再除以总数；这是 Week 11 的同一约定。',
        ),
        paragraph(
          '怎样解释曲线：两条都下降，表示在这个有限实验中两份资料的平均预测改善；训练下降、验证上升，先检查重复/切分、目标对齐、模式与样本量，再考虑过拟合。单个点反弹不足以定论；验证改善也不能证明事实正确性、推理能力或开放域泛化。',
        ),
        code(
          'bash',
          'python week12_generalization.py --generate-only runs/first/inference.pt --prompt "a " --new-tokens 80',
        ),
        paragraph(
          '加载时重建保存的同一模型配置和字符表。不要把这个 checkpoint 交给五词模型的严格恢复器；两种实验的格式和词表明确不同。程序会比较保存/加载前同一输入的 logits，但不宣称能逐步复现训练中断后的随机轨迹。',
        ),
        callout('独立任务：先写预期，再运行', [
          paragraph(
            'EX12-B1：运行前记录你预计哪条曲线更低、为什么，以及什么现象会推翻你的猜测。运行后填写实际首尾值，不把本页的示意算式当成实测。',
          ),
          paragraph(
            'EX12-B2：挑一个生成错误，说明它更可能与小语料、短上下文、模型容量或采样有关；一次生成不能唯一定位原因，写出下一项能区分假设的实验。',
          ),
          paragraph(
            'EX12-C：复制同一命令，只把 --learning-rate 改为 0.001，输出到新目录。其余数据、seed、步数、评估保持不变；也可以选择只改 --heads 或 --layers，不同时改三项。固定 C 时改变 head 数不必改变主要矩阵参数总量。',
          ),
        ]),
      ],
      [
        '没有运行时，不填写训练成功、实测 Loss 或生成质量结论。',
        '验证频率不改变训练 batch 抽样；改变参数前先固定比较条件。',
        '小语料独立验证是学习评估方法，不是可靠的通用能力测评。',
      ],
      check(
        '为什么这次实验比固定三句话多提供了一层证据，却仍不能证明模型具备真正的语言理解能力？',
        [
          paragraph(
            '验证文档未参与参数更新，因此它测量了训练资料之外的一组预测；固定三句没有提供这层隔离。但资料数量、题材和写作风格非常有限，next-token loss 与事实正确性或推理能力也不是同一个指标。回顾本节数据说明及 Week 11 的评估范围。',
          ),
        ],
      ),
    ),
    section(
      'o0435-18-character-tokenizer-subword',
      '18. Character、Byte、Word 与 Subword：换单位会改变整条接口',
      'Character 可能让序列变长，word 容易遇到未知形式，byte 稳定可逆但对非 ASCII 可能更长；需要理解 subword 为什么存在。',
      [
        '比较 tokenizer 单位的用途与代价。',
        '明确 Week 9 的教学 artifact 与 mini-gpt-v1 的模型协议不能混用。',
      ],
      [
        paragraph(
          'Subword/BPE 的意义是在有限 V 下复用常见片段，平衡 sequence length 与 Vocabulary coverage；它先在 tokenizer-training 阶段学习 merges，随后 encoding 阶段冻结应用。',
        ),
        table(
          ['unit', '“我喜欢AI，AI也喜欢猫。”示意', '优势', '代价'],
          [
            ['character', '逐 Unicode 字符', '直观', '长词/英文片段可能很长'],
            ['word', '按词/边界', '序列短', '未知词与切词规则困难'],
            [
              'UTF-8 byte',
              '每个 byte 0..255',
              '任意文本可逆',
              '中文字符通常占多个 bytes',
            ],
            [
              'BPE/subword',
              '依 learned merges 而定',
              'coverage 与长度折中',
              '需版本化 merge rules',
            ],
          ],
          '分段仅为单位示意；确切 BPE pieces 由已学习 merges 决定',
        ),
        formula(
          String.raw`P_{\mathrm{input/output\ tables}}\approx2VC\quad\text{for untied token embedding and bias-free LM head}`,
          '改变 V 会同时改变 input embedding rows 与 output LM-head rows。',
        ),
        callout(
          '两份 artifact，各自止步于自己的接口',
          [
            paragraph(
              'Week 9 的 w09-readable-v1 用 V=11、T=4 教协议；Week 10–12 的 mini-gpt-v1 用 V=5、T≤2。即使二者都输出 integers，也不能互换 IDs。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'Vocabulary 越大不自动越好；它增加参数与 output compute。',
        'Byte 可逆不等于 sequence 很短。',
        'Tokenizer 决定 units/IDs，不产生 contextual meaning。',
      ],
      check('V 改变时，哪两个 model layers 的边界必须改变？', [
        paragraph('token_embedding 的 rows 与 lm_head 的 output rows。'),
      ]),
    ),
    section(
      'o0436-19-model',
      '19. 扩大 Model：一次只改变一个可解释 Lever',
      '更多 layers、更宽 channels、更长 context 与更多 heads 解决不同限制，也带来不同 memory/compute/checkpoint costs。',
      [
        '把每个 scaling lever 映射到 shape constraint 与主要成本。',
        '保留 baseline，避免多变量实验无法归因。',
      ],
      [
        paragraph(
          `先让 fixed model 通过 pipeline 和 learning diagnostics，再改变一个变量并记录 config、seed、data split、updates、loss 和 samples。${fixedTrace}`,
        ),
        table(
          ['lever', '接口/约束', '主要影响'],
          [
            [
              'block_size T_max',
              'position table 与 causal mask 同步扩展',
              'attention score memory/work 约 T²',
            ],
            [
              'n_embd C',
              '所有 residual paths 同宽',
              'projections/FFN 参数与 compute 大致 C²',
            ],
            [
              'n_head H',
              'C mod H=0，d_head=C/H',
              'attention routing partition',
            ],
            [
              'n_layer',
              'ModuleList 深度与 state keys 改变',
              '顺序变换、memory/compute 近线性增长',
            ],
            [
              'corpus/tokenizer',
              'mapping、V、split 全部版本化',
              'signal coverage 与 embedding/head sizes',
            ],
          ],
        ),
        formula(
          String.raw`d_{\mathrm{head}}=C/H\in\mathbb N,\qquad \#\mathrm{attention\ scores}=BHT^2`,
          'C 必须能均分 heads；每层 score tensor 的元素数对 T 是 quadratic。',
        ),
        paragraph(
          '改变 block_size 会让 position_embedding 与 causal_mask shapes 和旧 checkpoint 不兼容；改变 V 会同时改变两端矩阵；改变 width/depth 会改大量 state keys/shapes。迁移必须显式设计。',
        ),
      ],
      [
        '不要一次改变 corpus、V、C、H、layers 与 learning rate。',
        '更大模型不会修复错位 targets 或 causal leak。',
        '降低 batch size 会改变 optimization noise，不能只看参数数量。',
      ],
      check('本 multi-head implementation 的核心整数约束是什么？', [
        paragraph('n_embd % n_head == 0；此处 4 % 2 == 0。'),
      ]),
    ),
    section(
      'o0437-20-mini-gpt',
      '20. 项目检查清单：从输入与目标到学习证据',
      '一个 plausible completion 无法证明 tokenizer、batch、gradients、checkpoint round-trip 或 causal mask 正确。',
      [
        '把六类 collapsed child checks 吸收到一张分层清单。',
        '提供 future-token perturbation 的可执行因果检查。',
      ],
      [
        table(
          ['group', '必须观察的证据'],
          [
            [
              'Tokenizer',
              '五 token round-trip；unknown rejected；long IDs 0..4；exact SHA-256 identity',
            ],
            [
              'Batch',
              'exact raw/inputs/targets arrays；[3,2]；六个 next-token pairs',
            ],
            [
              'Model',
              '[3,2,5]；520 params；two registered blocks；stable member names',
            ],
            [
              'Gradient/update',
              'finite loss/expected grads；one step changes parameter；count increments after success',
            ],
            [
              'Checkpoint',
              'strict schema/config/tokenizer/untied/AdamW checks；restored eval logits equal reference',
            ],
            [
              'Causality',
              '只改变 future token，earlier-position logits 保持 close',
            ],
          ],
        ),
        code(
          'python',
          `model.eval()
a = torch.tensor([[0, 1]], dtype=torch.long, device=device)
b = torch.tensor([[0, 4]], dtype=torch.long, device=device)
with torch.no_grad():
    logits_a, _ = model(a)
    logits_b, _ = model(b)
torch.testing.assert_close(logits_a[:, 0, :], logits_b[:, 0, :])`,
        ),
        formula(
          String.raw`p_\theta(x_{t+1}\mid x_{\le t},x_{>t})=p_\theta(x_{t+1}\mid x_{\le t})`,
          '合法 causal decoder 的 position-t prediction 不依赖右侧 future inputs。',
        ),
        chain([
          'tokenizer/batch 失败：停止',
          'forward/loss 失败：停止，不 backward',
          'gradient/update 失败：停止，不加模型规模',
          'checkpoint round-trip 失败：拒绝 incompatible state',
          'causality 失败：先查 mask/slice/axes',
          'generation shape/probability 失败：先查 crop/last/sample/append',
        ]),
      ],
      [
        'Equal shapes 不证明 causality。',
        'map_location 只搬 tensors，不会重映 Vocabulary meanings。',
        'Checkpoint digest 是 identity/integrity check，不是来源签名；只 load trusted files。',
      ],
      check('哪个实验直接检查 position 0 没读 position 1？', [
        paragraph(
          '只替换 position 1 的 token，再比较两次 position-0 logits；它们应在 tolerance 内相同。',
        ),
      ]),
    ),
    section(
      'o0444-21',
      '21. Weeks 1–12 怎样汇合：每周负责一段因果链',
      '若最终程序只剩 framework calls，学习者可能忘记每个 shape、gradient 与 probability rule 来自哪里。',
      [
        '把十二周内容映射到 end-to-end trace 的具体责任。',
        '让复习从“记术语”变成“指出当前对象与下一步”。',
      ],
      [
        table(
          ['Week', '在最终系统中的责任', '本 trace 的对象'],
          [
            [
              '1',
              '数、函数、vector/matrix 与 shape',
              '[3,2]、[3,2,4] 与 matrix multiplication',
            ],
            ['2', 'loss 与 gradient descent', 'scalar CE 与 update direction'],
            ['3', 'neurons/nonlinearity', 'FFN 的 Linear→GELU→Linear'],
            [
              '4',
              'chain rule/backprop',
              'loss.backward() 到每个 parameter.grad',
            ],
            [
              '5',
              'tensor axes/PyTorch',
              'B、T、C、H、d_head、V 与 broadcasting',
            ],
            [
              '6',
              'token IDs、embedding、next-token CE',
              'V=5 corpus 与六个 shifted tasks',
            ],
            ['7', 'causal Q/K/V', '[B,H,T,T] scores/mask/value aggregation'],
            [
              '8',
              'residual、norm、FFN Block',
              '两个 pre-norm blocks，shape 保持 [3,2,4]',
            ],
            [
              '9',
              'tokenizer/data protocol',
              '冻结 units/IDs；隔离 w09-readable-v1',
            ],
            [
              '10',
              'canonical MiniGPT ownership',
              'GPTConfig、stable members、520 params',
            ],
            [
              '11',
              'training/validation/checkpoint/generation lifecycle',
              'AdamW validators、strict restore、stable sampling',
            ],
            [
              '12',
              '组装与可观察性',
              '同一 trace 从 text 到 restored generation',
            ],
          ],
        ),
        chain([
          'Weeks 1–5：math 与 tensor runtime',
          'Weeks 6–9：language objective、context 与 data identity',
          'Weeks 10–11：model architecture 与 lifecycle state',
          'Week 12：同一 evidence chain 中组装、恢复与诊断',
        ]),
        formula(
          String.raw`\theta\xrightarrow{\mathrm{forward}}Z\xrightarrow{\mathrm{cross\ entropy}}\mathcal L\xrightarrow{\mathrm{chain\ rule}}\nabla_\theta\mathcal L\xrightarrow{\mathrm{AdamW}}\theta'`,
          '十二周最后汇成一个可测量、可微分、可更新的 prediction system。',
        ),
      ],
      [
        '每周不是一个要复制进同一 namespace 的 class。',
        'Later abstractions 依赖 earlier rules，而不是让 shapes 与数学失效。',
        '会背 Attention 不等于能追踪其 query/key axes。',
      ],
      check('哪一周解释 Attention score 为什么有 T×T axes？', [
        paragraph('Week 7，并借助 Week 5 的 tensor-axis language。'),
      ]),
    ),
    section(
      'o0457-22-mental-model',
      '22. 最终 Mental Model：一个带状态的条件概率机器',
      'API 名称会遮住模型真正做的事情，也容易让 probability 被误读成事实或理解。',
      [
        '用 training lane 与 generation lane 总结对象、状态和边界。',
        '明确 checkpoint 持久化 compatible state，而非“真理”。',
      ],
      [
        paragraph(
          'Tokenizer 建立离散协议；embeddings 与 causal Transformer 把允许读取的左侧 context 变成 representation；LM head 打分；Softmax 把最后一行变成条件分布。Training 改 θ，generation 只增长 history。',
        ),
        table(
          ['lane', '完整 trace', '改变的长期对象'],
          [
            [
              'training',
              'text→IDs→[3,2]→[3,2,5]→[6,5]+[6]→loss→grads→step',
              'θ、AdamW state、completed_updates',
            ],
            [
              'generation',
              'prompt→crop→logits→last [B,5]→sample [B,1]→append',
              'caller history；θ/optimizer 不变',
            ],
            [
              'checkpoint restore',
              'validated serialized state→model/optimizer objects',
              '显式替换长期 state，但不是 learning',
            ],
          ],
        ),
        formula(
          String.raw`p_\theta(x_{1:L})=\prod_{t=1}^{L}p_\theta(x_t\mid x_{<t})`,
          'Autoregressive joint score 分解为每个 token 在左侧 history 条件下的 next-token probabilities。',
        ),
        formula(
          String.raw`\theta'=\operatorname{Optimizer}(\theta,\nabla_\theta\mathcal L,\mathrm{optimizer\ state})`,
          'Training update 同时依赖当前 parameters、gradients 与 optimizer memory。',
        ),
      ],
      [
        'Probability 是模型在数据/架构下分配的 likelihood，不是事实保证。',
        'Attention weights 本身不是完整解释。',
        'Low training loss 不证明安全、公平或泛化。',
      ],
      check('一次 generation call 中什么固定，什么增长？', [
        paragraph(
          'Model parameters 与 optimizer state 固定；caller 的 token-ID history 每轮增长一个 ID。',
        ),
      ]),
    ),
    section(
      'o0458-23',
      '23. 最终理解测试：从症状回到出错边界',
      '能认出定义，不等于能在完整 pipeline 中定位一次具体 shape/type/identity failure。',
      [
        '用一个 generation crash 同时检查 last-position、sampling 与 append。',
        '用一个 GPU→CPU restore 检查 device relocation 与 semantic identity 的区别。',
      ],
      [
        callout(
          '综合题',
          [
            paragraph(
              '一次运行的 inputs [3,2]、logits [3,2,5] 与 loss 都正常，但 generation 把五个浮点数直接 append，下一次 embedding 崩溃。错误在哪里？另：为什么 GPU 训练的 checkpoint 可在 CPU 加载，哪些内容仍必须完全匹配？',
            ),
          ],
          'concept',
        ),
        paragraph(
          '错误在 generation boundary：先取 logits[:,-1,:] [B,5]，经过稳定 temperature/top-k/Softmax 后用 multinomial 得到 torch.long next_id [B,1]，追加这个 ID，而不是追加五维 probabilities。',
        ),
        formula(
          String.raw`\mathbb R^{B\times V}\xrightarrow{\mathrm{sampling}}\mathbb N^{B\times1}\xrightarrow{\mathrm{append}}\mathbb N^{B\times(L+1)}`,
          'Sampling 把每个 batch row 的 V 个 scores/probabilities 变成一个离散 token ID。',
        ),
        paragraph(
          'torch.load(..., map_location="cpu") 可以搬移 serialized tensors；它不会改变 Vocabulary meaning。Schema/version、ordered tokenizer artifact/hash/policy、exact GPTConfig、untied policy、model state keys/shapes，以及 faithful resume 的 exact AdamW class/group/order/state 与 completed_updates 仍必须匹配。',
        ),
      ],
      [
        'map_location 不会修复 tokenizer mismatch。',
        'Finite loss 不会验证 inference append code。',
        '能 load model weights 不代表 optimizer resume faithful。',
      ],
      check('Generation 为什么不能直接 append [B,5]？', [
        paragraph(
          '它是五个候选的连续 scores/probabilities；history 需要每行恰好一个 long token ID [B,1]。',
        ),
      ]),
    ),
    section(
      'o0459-24',
      '24. 完成课程：用自己的话解释一次学习与生成',
      '十二周若只留下组件清单，就缺少一个能被数据和 evaluation 证伪的统一目标。',
      [
        '把数学 objective、实现 trace 与能力边界收束为一条原则。',
        '说明 usefulness 必须由数据、held-out evaluation 与 deployment safeguards 支持。',
      ],
      [
        paragraph(
          'Learning 就是在明确 examples、模型与 loss 下寻找降低平均 next-token prediction error 的 parameters。Embedding、Q/K/V、residual、FFN 与 AdamW 都服务于“让条件分数可计算、误差可求导、参数可调整”。',
        ),
        formula(
          String.raw`\boxed{\mathrm{Learning}=\text{finding parameters }\theta\text{ that minimize measured prediction loss}}`,
          '课程的统一原则：先定义可测 prediction task，再用 gradients 调整 parameters。',
        ),
        formula(
          String.raw`\theta^*=\arg\min_\theta\mathbb E_{(x,y)\sim\mathcal D}[\mathcal L(f_\theta(x),y)]`,
          '数据分布、parameterized logits 与 comparing loss 是 objective 的三个 ingredients；实际优化不保证找到全局最优。',
        ),
        chain([
          '定义 text/token/data contract',
          '验证 tensor/causal forward contract',
          '用 loss 与 gradients 执行 successful updates',
          '保存并严格恢复 compatible state',
          '在 held-out evidence 与 target-free generation 中评估用途和限制',
        ]),
      ],
      [
        'Optimization target 不保证 truth、fairness、causality 或 human-like understanding。',
        '不要声称已找到 global minimum 或 perfect generalization。',
        'Deployment 仍需要与用途相称的安全和质量评估。',
      ],
      check('MiniGPT objective 的三个 ingredients 是什么？', [
        paragraph(
          'Tokenized input/target examples、产生 logits 的 parameterized model，以及比较二者的 cross-entropy loss。',
        ),
      ]),
    ),
  ],
};
