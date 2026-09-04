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

const runningText = '我喜欢AI，AI也喜欢猫。';

const readableVocabularyRows = [
  ['0', '<BOS>', '文档开始'],
  ['1', '<EOS>', '文档结束'],
  ['2', '<PAD>', '补齐 batch 长度'],
  ['3', '<UNK>', '一种有损的未知项策略'],
  ['4', '我', '内容 token'],
  ['5', '喜欢', '内容 token'],
  ['6', 'AI', '内容 token'],
  ['7', '，', '内容 token'],
  ['8', '也', '内容 token'],
  ['9', '猫', '内容 token'],
  ['10', '。', '内容 token'],
];

const segmentationRows = [
  [
    'character / code point',
    '[我, 喜, 欢, A, I, ，, A, I, 也, 喜, 欢, 猫, 。]',
    '13',
    '这些 code points 无需 word dictionary',
    '喜欢 与 AI 都被拆开，sequence 较长',
  ],
  [
    'word-like（指定 segmenter）',
    '[我, 喜欢, AI, ，, AI, 也, 喜欢, 猫, 。]',
    '9',
    '短而且容易阅读',
    '中文边界、未见词和规范差异需要额外规则',
  ],
  [
    'UTF-8 byte',
    'E6 88 91 … 41 49 … E3 80 82',
    '31',
    '固定 256 个 base symbols 可覆盖任意有效 UTF-8 文本',
    '最长；单个 byte fragment 不一定可独立阅读',
  ],
  [
    'subword（进一步训练后的示意）',
    '[我, 喜欢, AI, ，, AI, 也, 喜欢, 猫, 。]',
    '9',
    '常见片段短，少见文本仍可拆成更小单位',
    'merge、normalization 与 ID 都属于该 tokenizer 版本',
  ],
];

const utf8Rows = [
  ['我', 'U+6211', 'E6 88 91', '3'],
  ['喜', 'U+559C', 'E5 96 9C', '3'],
  ['欢', 'U+6B22', 'E6 AC A2', '3'],
  ['A', 'U+0041', '41', '1'],
  ['I', 'U+0049', '49', '1'],
  ['，', 'U+FF0C', 'EF BC 8C', '3'],
  ['A', 'U+0041', '41', '1'],
  ['I', 'U+0049', '49', '1'],
  ['也', 'U+4E5F', 'E4 B9 9F', '3'],
  ['喜', 'U+559C', 'E5 96 9C', '3'],
  ['欢', 'U+6B22', 'E6 AC A2', '3'],
  ['猫', 'U+732B', 'E7 8C AB', '3'],
  ['。', 'U+3002', 'E3 80 82', '3'],
];

const streamRows = [
  ['0', '0', '<BOS>'],
  ['1', '4', '我'],
  ['2', '5', '喜欢'],
  ['3', '6', 'AI'],
  ['4', '7', '，'],
  ['5', '6', 'AI'],
  ['6', '8', '也'],
  ['7', '5', '喜欢'],
  ['8', '9', '猫'],
  ['9', '10', '。'],
  ['10', '1', '<EOS>'],
];

export const week09Revision: CuratedWeekRevision = {
  weekSlug: 'week-09',
  title: 'Week 9 - Tokenizer：从原始文字到训练 Batch',
  keyQuestion:
    '怎样把“我喜欢AI，AI也喜欢猫。”稳定地变成模型可用的整数 IDs，同时不混淆 tokenizer training、encoding 与模型学习？',
  objectives: [
    '比较 character、word、UTF-8 byte 与 subword 四种单位对 V、L、覆盖能力和计算成本的影响。',
    '手算 byte-level BPE 的两轮 pair count、tie break、merge 与长度变化。',
    '区分 tokenizer training 与 encoding，并把 tokenizer artifacts 与 model checkpoint 绑定。',
    '沿 text → tokens → stream [L] → shifted examples [T] → batch [B,T] 完成一条可审计的数据路径。',
    '在 Week 10 前明确结束 w09-readable-v1，并切换到不兼容的 mini-gpt-v1。',
  ],
  estimatedReadingMinutes: 80,
  sections: [
    section(
      'o0319-week-9',
      'Week 9 核心目标：让文字与模型共享一份稳定协议',
      '用户输入开放的 Unicode 文字，神经网络却只接受有限范围的整数地址。若切分规则或 ID 对照表改变，同一个数字就可能指向另一段文字，已训练的 embedding row 也随之被误用。',
      [
        '把 Tokenizer 定义为 raw text 与模型之间可保存、可验证、可版本化的协议。',
        '用同一句“我喜欢AI，AI也喜欢猫。”走完单位选择、BPE、特殊 token、stream、shift 与 batch。',
      ],
      [
        paragraph(
          'Tokenizer 不是语言模型。它规定 normalization、怎样切分、Vocabulary 中有哪些 token、每个 token 对应哪个 ID，以及 IDs 怎样 decode。它在模型前把文字变成整数，也在生成后把整数还原为文字；真正可学习的 contextual patterns 位于 embedding 与 Transformer 参数中。',
        ),
        table(
          ['概念', '本章含义', '固定句中的例子'],
          [
            [
              'Token',
              'Tokenizer 发出的一个离散计算单位',
              '可以是 我、喜欢、AI，也可能是某个 byte',
            ],
            [
              'Vocabulary',
              '允许 token 与 ID 的有限清单',
              'w09-readable-v1 有 V=11 个 entries',
            ],
            ['Token ID', '某个 entry 的整数地址', '在该快照中 AI 的地址是 6'],
            [
              'Tokenizer',
              'normalization、split、encode、decode 与 special-token policy 的整体协议',
              '将固定句映射成下方 stream',
            ],
          ],
        ),
        table(
          ['ID', 'token', 'role'],
          readableVocabularyRows,
          'w09-readable-v1 的完整 ordered Vocabulary（V=11）',
        ),
        chain([
          runningText,
          '[<BOS>, 我, 喜欢, AI, ，, AI, 也, 喜欢, 猫, 。, <EOS>]',
          'IDs s=[0,4,5,6,7,6,8,5,9,10,1], shape [L]=[11]',
          'decode(skip_special_tokens=True) → 我喜欢AI，AI也喜欢猫。',
        ]),
        formula(
          String.raw`\operatorname{encode}_{A}:\mathrm{Unicode\ text}\to\{0,\ldots,V_A-1\}^{L},\qquad \operatorname{decode}_{A}:\{0,\ldots,V_A-1\}^{L}\to\mathrm{text}`,
          '在固定 tokenizer artifact A 下，encode 产生长度 L 的合法整数序列，decode 按同一 artifact 的规则重建文字。',
        ),
        callout(
          '本章的可读快照',
          [
            paragraph(
              '后半章用教学 artifact w09-readable-v1：V=11、special IDs 0..3、完整 stream 长度 L=11、batch context T=4。它只服务 Week 9，绝不是通用或 production tokenizer。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'Token ID 是地址，不带“6 比 5 更像 AI”的数值语义。',
        'Tokenizer 的 decode 能否 exact round-trip 取决于 normalization、fallback 与 special-token policy，不能无条件保证。',
        '只检查两个 tokenizer 的 V 相等，不能证明它们与同一 checkpoint 兼容。',
      ],
      check('为什么 tokenizer artifacts 必须与 model checkpoint 一起版本化？', [
        paragraph(
          'embedding row 与 LM-head column 都按 ID 学习。只有 normalization、切分、ordered vocabulary、merges 与 special IDs 完全一致，某个地址才仍代表训练时的同一 token。',
        ),
      ]),
    ),
    section(
      'o0321-1-token-word',
      '1. Token 不等于 Word：同一句话可以有四种边界',
      '把 token 默认理解成“单词”会在中文、标点、代码、emoji 和 byte fallback 上立刻失效，也会让人误以为 token 数等于字符数。',
      [
        '比较四种明确的 segmentation rule，而不是寻找唯一“语言学正确”的切法。',
        '说明 token count L 是 tokenizer 的计算结果，并直接影响 context window 能容纳多少文字。',
      ],
      [
        paragraph(
          '对“我喜欢AI，AI也喜欢猫。”，同一 raw text 在不同规则下可以发出不同数量的单位。下面的 word-like row 依赖指定 segmenter；subword row 恰好看起来一样，只是这个教学词表训练后的结果，并非 subword 的定义。',
        ),
        table(
          [
            'scheme',
            'emitted units',
            'count L',
            'immediate benefit',
            'immediate cost',
          ],
          segmentationRows,
          '同一固定句的四种明确切分',
        ),
        formula(
          String.raw`L_{\mathrm{character}}=13,\qquad L_{\mathrm{wordlike}}=9,\qquad L_{\mathrm{byte}}=31,\qquad L_{\mathrm{subword\ demo}}=9`,
          '这些长度分别属于四种 tokenizer rule，不能把它们当成同一单位的四次测量。',
        ),
        callout(
          'Token count 既不是 character count，也不是 word count',
          [
            paragraph(
              '模型只看到 tokenizer 发出的 positions。真实 tokenizer 还可能特殊处理 leading spaces、normalization 或 byte fallback，因此另一 tokenizer 对这句文字可能得到完全不同的 L。',
            ),
          ],
          'concept',
        ),
      ],
      [
        'Unicode code point 与 UTF-8 byte 是不同单位。',
        '中文没有空格不表示它天然只有一种 word segmentation。',
        '跨 tokenizer 比较 L 时，必须先承认每个 position 的单位不同。',
      ],
      check(
        '13 个 Unicode code points 是否证明所有 tokenizer 都会产生 13 个 IDs？',
        [
          paragraph(
            '不会。character rule 在这里产生 13 个单位；word-like 与示意 subword 各产生 9 个，byte rule 产生 31 个。L 由 tokenizer artifact 决定。',
          ),
        ],
      ),
    ),
    section(
      'o0326-2-word',
      '2. 为什么不简单按 Word 切：覆盖与长度的两难',
      'whole-word Vocabulary 若存下所有拼写、词形、专名和组合会迅速膨胀；若只保留有限清单，又必须处理清单外文字。',
      [
        '用 subword 解释“常见片段短、少见片段可分解”的工程折中。',
        '把 vocabulary size V、sequence length L 与 Attention 的位置成本连起来。',
      ],
      [
        paragraph(
          '在固定句“我喜欢AI，AI也喜欢猫。”中，word-like tokenizer 可把 喜欢 与 AI 保持为整体；byte base 则一定能表达这些有效 UTF-8 bytes，但需要 31 个 positions。Subword 从覆盖能力较强的小单位出发，再把训练语料中的常见相邻片段合并。',
        ),
        table(
          ['choice', 'Vocabulary / coverage', 'sequence length', '主要代价'],
          [
            [
              'whole word',
              '需要很多完整词；缺项时常依赖 <UNK> 或额外 fallback',
              '常见词通常较短',
              'V 大或 unknown information loss',
            ],
            [
              'character / byte',
              'base V 较小；byte base 可覆盖有效 UTF-8',
              '固定句为 13 / 31',
              '更多 positions 与更弱的人类可读性',
            ],
            [
              'subword',
              'common pieces + smaller fallback pieces',
              '通常介于两端；本示意为 9',
              '需要冻结训练出的 merges 与 routing rules',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{self\text{-}attention\ pairwise\ work}\approx O(L^2C)`,
          '在宽度 C 固定时，更长的 token sequence 会增加 Attention 的位置对计算；这不是整个模型成本的完整公式。',
        ),
        callout('辅助 morphology 例子不是保证', [
          paragraph(
            '某个假想英文 Vocabulary 可能把 unhappiness 切成 [un, happi, ness]，但 BPE 不保证得到语言学 morphemes，也不因完成这种切分就理解该词。',
          ),
        ]),
      ],
      [
        'Subword 不保证边界与 morpheme 或语义一致。',
        'BPE 让新字符串可分解，不代表模型已知道新实体。',
        'word-level tokenizer 也可以用 <UNK>；代价是多个 unknown pieces 会坍缩到同一地址。',
      ],
      check('Subword 相比有限 whole-word Vocabulary 解决了什么问题？', [
        paragraph(
          '它能用已知的较小 pieces 表示未作为完整 entry 出现的组合，不必为每个 whole word 新增一行；是否理解这些组合仍由模型训练决定。',
        ),
      ]),
    ),
    section(
      'o0327-3-vocabulary-size-trade-off',
      '3. Vocabulary Size 的 Trade-off：V 与 L 会同时改变系统',
      '增大 Vocabulary 往往能缩短文字序列，却也扩大 input/output 两个 vocabulary-facing interfaces；只谈一端会误判参数和计算成本。',
      [
        '说明 V 决定可选 token rows/columns，L 与模型 context T 决定一次能覆盖多少原文。',
        '区分 generic biased untied head 的 2VC+V 与后续 canonical MiniGPT 的 bias-free untied 2VC。',
      ],
      [
        paragraph(
          '固定句的 13、9、31 positions 只显示方向，不证明“9 最优”。较大的 V 可以为常见片段分配单独 entry，较小的 V 则常要用更多 positions 表达同一文字。模型仍会在每个 position 输出 V 个 logits。',
        ),
        table(
          [
            'design direction',
            'vocabulary-facing tables',
            'same text length',
            'context / Attention implication',
          ],
          [
            [
              'smaller V',
              '较少 rows 与 output candidates',
              '往往更大 L',
              '固定 T 能覆盖的原文可能更少，位置对更多',
            ],
            [
              'larger V',
              '较多 rows 与 output candidates',
              '常见片段往往更短',
              '每一步的 LM-head computation / memory 增大',
            ],
          ],
        ),
        formula(
          String.raw`E_{\mathrm{in}}\in\mathbb{R}^{V\times C},\qquad \mathrm{logits}\in\mathbb{R}^{B\times T\times V}`,
          '输入 embedding 有 V 行、每行 C 个 features；输出在每个 batch/time position 给 V 个候选 logits。',
        ),
        formula(
          String.raw`N_{\mathrm{vocab,\ generic\ biased\ untied}}=VC+(VC+V)=2VC+V`,
          '只有 generic 的 untied 且带 bias LM head 变体才包含额外 V 个 bias 参数。',
        ),
        formula(
          String.raw`N_{\mathrm{vocab,\ canonical\ MiniGPT}}=VC+VC=2VC`,
          'Week 10 的 canonical MiniGPT 使用 bias-free、untied LM head，因此 vocabulary-facing 参数为 2VC。',
        ),
        callout(
          'Weight tying 只改 parameter accounting',
          [
            paragraph(
              '若 input embedding 与 LM-head weight 真正共享同一 Parameter，独立参数会减少；但输出仍有 V 个候选。Week 10 的 canonical mini-model 明确采用 untied weights。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '较大 V 不自动更快；短 sequence 与更大 output axis 是不同成本。',
        'T 是 context positions，V 是 candidate IDs，C 是每个 position 的 feature width。',
        '不能把 generic 2VC+V 套到 bias-free canonical MiniGPT 上。',
      ],
      check('C 固定且 V 翻倍，哪两个常见 interfaces 会变大？', [
        paragraph(
          'input embedding 的 row 数与 LM head 的 vocabulary dimension 都变大。若 weights untied，两张表各自增长；tying 只改变共享参数数量，不改变 V 个 logits。',
        ),
      ]),
    ),
    section(
      'o0331-4-character-tokenizer',
      '4. Character Tokenizer：先看清 Encode / Decode 闭环',
      '直接进入 byte-level BPE 会同时遇到 byte、merge 与 special-token policy，反而看不清最基本的文字—ID 双向映射。',
      [
        '用一个可手查的 code-point Vocabulary 演示 encode、decode、dtype 与 shape。',
        '把透明的教学 tokenizer 与后面的 w09-readable-v1 ID space 明确分开。',
      ],
      [
        paragraph(
          '对“我喜欢AI，AI也喜欢猫。”，这个简化 tokenizer 把每个 Unicode code point 当作 token。它适合检查闭环，却不等于 production 最佳方案，也不能自动处理 Vocabulary 外 code point、grapheme cluster 或 normalization 差异。',
        ),
        code(
          'python',
          `import torch

text = "我喜欢AI，AI也喜欢猫。"
character_tokens = ["我", "喜", "欢", "A", "I", "，", "也", "猫", "。"]
char_to_id = {token: index for index, token in enumerate(character_tokens)}
id_to_char = {index: token for token, index in char_to_id.items()}


def encode_characters(value: str) -> list[int]:
    return [char_to_id[character] for character in value]


def decode_characters(ids: list[int]) -> str:
    return "".join(id_to_char[index] for index in ids)


ids = encode_characters(text)
token_tensor = torch.tensor(ids, dtype=torch.long)

assert ids == [0, 1, 2, 3, 4, 5, 3, 4, 6, 1, 2, 7, 8]
assert tuple(token_tensor.shape) == (13,)
assert decode_characters(ids) == text`,
        ),
        formula(
          String.raw`\mathrm{char\_to\_id}:\mathrm{known\ code\ point}\to\{0,\ldots,V_{\mathrm{char}}-1\},\qquad \mathrm{ids}:[13]`,
          '这个受限 Vocabulary 中，每个已知 code point 映射为一个整数；固定句形成长度 13 的 torch.long vector。',
        ),
        callout(
          '这里的 IDs 不能带到后面的快照',
          [
            paragraph(
              '在本节 char_to_id 中，AI 是两个 IDs 3、4；w09-readable-v1 把 AI 作为 ID 6。两组数字分别属于不同 tokenizer artifacts，不能混用。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'Python 字符迭代近似展示 code points，不证明每个 user-perceived grapheme 都只有一个 code point。',
        '本示例遇到 Vocabulary 外字符会 KeyError；真实 encoder 必须定义 unknown、fallback 或 error policy。',
        'Character tokenizer 仍要定义 Unicode normalization，不能仅靠一张字典解决所有等价形式。',
      ],
      check(
        '为什么明知本句会有 13 个 tokens，仍值得先实现 character tokenizer？',
        [
          paragraph(
            '它让 Vocabulary、integer lookup、encode、decode、torch.long 与 [L] shape 全部可手查，从而暴露所有 tokenizer 共享的基本数据契约。',
          ),
        ],
      ),
    ),
    section(
      'o0333-5-unicode-utf-8',
      '5. Unicode 与 UTF-8：字符身份不等于序列化 Bytes',
      '“一个字符就是一个 byte”在中文和全角标点中是错误的；若混淆 code point 与 byte，就无法正确解释 byte tokenizer 或 BPE pair。',
      [
        '把 Unicode code point 的抽象身份与 UTF-8 bytes 的具体编码分开。',
        '精确验证固定句有 13 个 code points、31 个 UTF-8 bytes。',
      ],
      [
        paragraph(
          'Unicode 给“我”分配 U+6211；UTF-8 将这个 code point 序列化为 E6 88 91。ASCII 的 A 与 I 各占一个 byte，而本句中的七个 Han code points 和两个全角标点各占三个 bytes，因此总计 21+4+6=31。',
        ),
        table(
          ['visible code point', 'Unicode', 'UTF-8 hex bytes', 'byte count'],
          utf8Rows,
          '“我喜欢AI，AI也喜欢猫。”的全部 13 个 code points 与精确 UTF-8 bytes',
        ),
        code(
          'python',
          `text = "我喜欢AI，AI也喜欢猫。"
utf8_bytes = text.encode("utf-8")

assert len(text) == 13
assert len(utf8_bytes) == 31
assert utf8_bytes.hex(" ").upper() == (
    "E6 88 91 E5 96 9C E6 AC A2 41 49 EF BC 8C "
    "41 49 E4 B9 9F E5 96 9C E6 AC A2 E7 8C AB E3 80 82"
)`,
        ),
        formula(
          String.raw`b_i\in\{0,\ldots,255\},\qquad \mathrm{UTF8}(\text{我喜欢AI，AI也喜欢猫。})\in\{0,\ldots,255\}^{31}`,
          'byte-level base alphabet 有 256 个值；固定句初始为长度 31 的 byte vector。',
        ),
        chain([
          'token IDs',
          'expand learned symbols back to byte symbols',
          'join one byte sequence',
          'UTF-8 decoder with a defined error policy',
          runningText,
        ]),
      ],
      [
        '不能说“中文是三个字符的 UTF-8”；这里是某些 code points 各编码成三个 bytes。',
        '不要独立 decode 一个可能位于多-byte code point 中间的 fragment。',
        'source-file encoding 与 model tokenizer 是两个不同层次。',
      ],
      check('为什么 A 与 我 不是各占一个 UTF-8 byte？', [
        paragraph(
          'UTF-8 用一个 byte 编码 ASCII code point U+0041；U+6211 则需要 E6 88 91 三个 bytes。可见 code point 数与 byte 数不同。',
        ),
      ]),
    ),
    section(
      'o0334-6-token',
      '6. 未见 Token：先决定信息如何保留',
      '有限 Vocabulary 不可能把未来每个专名、拼写、emoji 序列和代码片段都作为完整 entry；direct lookup 失败时必须有明确政策。',
      [
        '比较 <UNK>、subword/byte fallback 与 explicit error 三种策略。',
        '说明 unseen 是相对于 tokenizer units 而言，并不等于模型“不认识一个语言概念”。',
      ],
      [
        paragraph(
          '假设 w09-readable-v1 的 word-only variant 忘了把固定句中的 猫 放进 Vocabulary：它可以输出 <UNK> 的 ID 3，但所有未知片段都会坍缩到同一地址，无法 exact decode 猫。byte-capable fallback 则能保留 E7 8C AB，随后仍可重建原文。',
        ),
        table(
          [
            'policy',
            '猫 不可 direct lookup 时的 output',
            'round-trip',
            'cost / behavior',
          ],
          [
            [
              '<UNK>',
              '[3]',
              '有损：只能还原为 unknown marker',
              '短，但不同未知片段共享一个 ID',
            ],
            [
              'subword / byte fallback',
              '一个或多个已知 smaller-piece IDs',
              '若 normalization/byte policy lossless，可保留原始文字',
              'k 可能大于 1，sequence 变长',
            ],
            [
              'explicit error',
              '不产生 IDs',
              '调用方必须处理失败',
              '适合不允许自动 replacement 的严格输入',
            ],
          ],
        ),
        formula(
          String.raw`f:\mathrm{text\ piece}\rightharpoonup\{0,\ldots,V-1\},\qquad \operatorname{encode}(u)=\begin{cases}f(u),&u\in\operatorname{dom}(f)\\[2pt]\mathrm{fallback}(u)\in\{0,\ldots,V-1\}^{k},&u\notin\operatorname{dom}(f)\end{cases}`,
          'direct mapping 可以是 partial function；完整 encoder 必须为缺项定义返回 k 个已知 IDs、一个 UNK，或 error。',
        ),
        paragraph(
          '固定快照实际包含 猫，所以正常 encoding 是 ID 9。malformed byte sequence 是另一类问题：它需要 UTF-8 replacement/error policy，不能与“有效但未见的词”混为一谈。',
        ),
      ],
      [
        '<UNK> 是控制 entry，不是普通自然语言单词。',
        '<UNK> 无法 exact reconstruct 原先是哪一个 unknown piece。',
        'byte fallback 保留字符串不表示模型已经学习该新实体的事实或用法。',
      ],
      check('为什么 byte fallback 通常比把 猫 替换成 <UNK> 更少丢失信息？', [
        paragraph(
          'E7 8C AB 可重新组成 猫；<UNK> ID 3 会把所有未知内容合并为同一地址，原字符串身份已经丢失。',
        ),
      ]),
    ),
    section(
      'o0335-7-bpe',
      '7. BPE 的核心直觉：真的手算两轮 Merge',
      'Byte base 能覆盖文字，却让“我喜欢AI，AI也喜欢猫。”占 31 个 positions；需要一种可复现的方法把训练语料中常见的相邻 symbols 命名为更长 token。',
      [
        '把 BPE training 展开为 count → deterministic tie break → non-overlapping merge → recount。',
        '精确保留跨 code-point pair (9C,E6)，并验证两轮后长度 31−2−2=27。',
      ],
      [
        paragraph(
          '这是一个无 pre-token boundaries 的 toy byte-level BPE training：固定句的每对相邻 bytes 都可参与计数。只列频率至少为 2 的初始 pairs；(9C,E6) 跨越 喜 的最后 byte 与 欢 的第一 byte，并在两次 喜欢 中出现。',
        ),
        table(
          ['initial adjacent byte pair', 'count', 'why repeated'],
          [
            ['(41,49)', '2', '两次 AI'],
            ['(E5,96)', '2', '两个 喜 的前两 bytes'],
            ['(96,9C)', '2', '两个 喜 的后两 bytes'],
            ['(9C,E6)', '2', '两次 喜→欢 的 code-point boundary'],
            ['(E6,AC)', '2', '两个 欢 的前两 bytes'],
            ['(AC,A2)', '2', '两个 欢 的后两 bytes'],
          ],
          '完整 initial repeated-pair inventory；六组 count 都是 2',
        ),
        formula(
          String.raw`\operatorname{count}_r(a,b)=\sum_{i=1}^{n_r-1}\mathbf{1}\!\left[(z_i^{(r)},z_{i+1}^{(r)})=(a,b)\right]`,
          '第 r 轮在当前一维 symbol stream 中计算每个相邻 pair 的出现次数。',
        ),
        callout(
          '确定性的 tie rule',
          [
            paragraph(
              '先最大化 count；若并列，则把每个十六进制 symbol 读成整数，并按 integer pair (a,b) 做 lexicographic ascending comparison。初始最小者是 (0x41,0x49)，不是按屏幕文字或语言边界选。',
            ),
          ],
          'principle',
        ),
        code(
          'text',
          `Round 1
all six candidates tie at count 2
lexicographically smallest integer pair = (0x41, 0x49)

(41,49) -> new token 256, displayed [41 49]

... E6 AC A2 [41 49] EF BC 8C [41 49] E4 B9 9F ...
length: 31 - 2 = 29 symbols`,
        ),
        paragraph(
          'Round 1 后必须重新计数。两个 [41 49] 的邻居分别不同，因此没有产生新的 repeated adjacent pair；其余五个 repeated pairs 仍各出现两次。',
        ),
        table(
          ['recount after round 1', 'count'],
          [
            ['(96,9C)', '2'],
            ['(9C,E6)', '2'],
            ['(AC,A2)', '2'],
            ['(E5,96)', '2'],
            ['(E6,AC)', '2'],
          ],
          '按 integer-pair lexicographic order 排列；0x96 小于 0x9C、0xAC、0xE5、0xE6',
        ),
        code(
          'text',
          `Round 2
all five repeated pairs tie at count 2
lexicographically smallest integer pair = (0x96, 0x9C)

(96,9C) -> new token 257, displayed [96 9C]

喜 at each occurrence is now: E5 [96 9C]
length: 29 - 2 = 27 symbols

total after two rounds: 31 - 2 - 2 = 27`,
        ),
        formula(
          String.raw`(a_r,b_r)=\operatorname*{arg\,max}_{(a,b)}\operatorname{count}_r(a,b)\quad\text{with lexicographic integer-pair tie break}`,
          '每一轮只根据 tokenizer-training stream 与已声明 tie rule 选 pair，再替换 non-overlapping occurrences。',
        ),
      ],
      [
        '漏掉 (9C,E6) 会把 byte-stream adjacency 错当成 visible-character boundaries。',
        'Round 1 后必须 recount；不能沿用旧排名而不检查新 symbols。',
        '两轮后的 喜 仍是 E5 与 [96 9C] 两个 symbols，不是完整 token。',
        'Inference prompt 不会触发重新计数或创建 token 258。',
        '新 token 的整数 256/257 是地址，不表达“更重要”或“更有语义”。',
      ],
      check('为什么 Round 2 选择 (96,9C)，而且此时 喜 仍不是一个 token？', [
        paragraph(
          'Round 1 后五个 repeated pairs 都为 2；按 integer pair lexicographic order，首元素 0x96 最小。Round 2 只合并 喜 的后两 bytes，所以它仍表示为 E5 与 [96 9C] 两个 symbols。',
        ),
      ]),
    ),
    section(
      'o0337-8-tokenizer-training-text-encoding',
      '8. Tokenizer Training 与 Text Encoding 不同',
      '若把“训练 tokenizer”和“编码一个 prompt”混成同一动作，学习者会误以为每次输入“我喜欢AI，AI也喜欢猫。”都会改 Vocabulary 或重新排序 IDs。',
      [
        '把离线 artifact construction 与反复应用 frozen artifact 分成两条明确阶段。',
        '规定 from-scratch evaluation 时 tokenizer fitting 只读取 train documents，并分离 encode_content / encode_document。',
      ],
      [
        table(
          ['phase', 'input', 'changes artifacts?', 'output'],
          [
            [
              'tokenizer training',
              'training corpus documents',
              '是：选择 normalization、base vocab、merges、special IDs',
              'versioned artifact A',
            ],
            ['text encoding', 'one text + frozen A', '否', 'IDs in 0..V_A−1'],
            [
              'model training',
              'batches of frozen-A IDs',
              '否：A 不变；model parameters 改变',
              'updated neural weights',
            ],
          ],
        ),
        chain([
          'train documents',
          'normalization / pre-tokenization policy',
          'BPE counts + ordered merges',
          'frozen tokenizer artifact A',
          'encode train / validation / inference text',
          'token streams',
          'model training',
        ]),
        formula(
          String.raw`\operatorname{train\_tokenizer}(\mathrm{train\ documents})\to A,\qquad A=\{\mathrm{normalizer,pretokenizer,base\ vocab,merges,specials}\}`,
          'Tokenizer training 产生 artifact A；若从零评估，应先按 document 划分并只用 train documents 拟合 A。',
        ),
        formula(
          String.raw`\operatorname{encode}_{A}(\mathrm{text})\to\mathrm{ids}\in\{0,\ldots,V_A-1\}^{L},\qquad A_{\mathrm{after}}=A_{\mathrm{before}}`,
          'Encoding 只应用 frozen A；不会更新 pair counts、添加 Vocabulary row 或改变 merge order。',
        ),
        paragraph(
          '下面把 w09-readable-v1 写成一个最小、具体的 teaching artifact，而不是调用未配置的通用 library tokenizer。它使用 identity normalization、显式 ordered Vocabulary，以及固定的 longest-first content routes；无法匹配的一个 Unicode code point 映射为 <UNK>。这个 routing 是教学约定，不声称由前面两轮 toy BPE 直接产生。',
        ),
        code(
          'python',
          `TOKENS = (
    "<BOS>",
    "<EOS>",
    "<PAD>",
    "<UNK>",
    "我",
    "喜欢",
    "AI",
    "，",
    "也",
    "猫",
    "。",
)
TOKEN_TO_ID = {token: token_id for token_id, token in enumerate(TOKENS)}
ID_TO_TOKEN = {token_id: token for token, token_id in TOKEN_TO_ID.items()}

BOS_ID = TOKEN_TO_ID["<BOS>"]  # 0
EOS_ID = TOKEN_TO_ID["<EOS>"]  # 1
PAD_ID = TOKEN_TO_ID["<PAD>"]  # 2
UNK_ID = TOKEN_TO_ID["<UNK>"]  # 3

# Deterministic longest-first routing for this small teaching artifact.
# Equal-length routes retain this declared order.
CONTENT_ROUTES = ("喜欢", "AI", "我", "，", "也", "猫", "。")
HIDDEN_ON_DECODE_IDS = {BOS_ID, EOS_ID, PAD_ID}


class ReadableTokenizerV1:
    version = "w09-readable-v1"
    normalization = "identity"
    vocabulary = TOKENS

    def segment_content(self, text: str) -> list[str]:
        pieces: list[str] = []
        cursor = 0
        while cursor < len(text):
            matched = next(
                (
                    piece
                    for piece in CONTENT_ROUTES
                    if text.startswith(piece, cursor)
                ),
                None,
            )
            if matched is None:
                pieces.append("<UNK>")
                cursor += 1
            else:
                pieces.append(matched)
                cursor += len(matched)
        return pieces

    def encode_content(
        self,
        text: str,
        *,
        add_special_tokens: bool = False,
    ) -> list[int]:
        if add_special_tokens:
            raise ValueError("encode_content never adds BOS/EOS")
        return [TOKEN_TO_ID[piece] for piece in self.segment_content(text)]

    def encode_document(
        self,
        text: str,
        *,
        add_special_tokens: bool = True,
    ) -> list[int]:
        if not add_special_tokens:
            raise ValueError("use encode_content when boundaries are unwanted")
        return [
            BOS_ID,
            *self.encode_content(text, add_special_tokens=False),
            EOS_ID,
        ]

    def decode(
        self,
        ids: list[int],
        *,
        skip_special_tokens: bool = True,
    ) -> str:
        pieces: list[str] = []
        for token_id in ids:
            if token_id not in ID_TO_TOKEN:
                raise ValueError(f"token ID out of range: {token_id}")
            if skip_special_tokens and token_id in HIDDEN_ON_DECODE_IDS:
                continue
            pieces.append(ID_TO_TOKEN[token_id])
        return "".join(pieces)


W09_READABLE_V1 = ReadableTokenizerV1()


def encode_content(text: str) -> list[int]:
    return W09_READABLE_V1.encode_content(
        text,
        add_special_tokens=False,
    )


def encode_document(text: str) -> list[int]:
    return W09_READABLE_V1.encode_document(
        text,
        add_special_tokens=True,
    )


RUNNING_TEXT = "我喜欢AI，AI也喜欢猫。"
content_ids = encode_content(RUNNING_TEXT)
document_ids = encode_document(RUNNING_TEXT)

assert content_ids == [4, 5, 6, 7, 6, 8, 5, 9, 10]
assert document_ids == [0, *content_ids, 1]
assert W09_READABLE_V1.decode(
    document_ids,
    skip_special_tokens=True,
) == RUNNING_TEXT

# These calls never mutate vocabulary, routes, or IDs.`,
          'w09_readable_v1.py',
        ),
      ],
      [
        'encode 不是 gradient descent，也不会根据当前 prompt 学新 merge。',
        'Transformer optimizer 更新 model parameters，不更新 frozen tokenizer artifact。',
        '若 tokenizer 在 validation documents 上重新 fitting，会改变评估协议并可能泄漏信息。',
        'encode_content 与 encode_document 的 boundary ownership 必须清楚，不能重复添加 BOS/EOS。',
      ],
      check(
        '固定 BPE rule (41,49)→256 后，再 encode 固定句会改变这条 rule 吗？',
        [
          paragraph(
            '不会。Encoding 只按保存的 ordered merges 应用规则；改变 merge 需要产生新 tokenizer version，并同步改变与之绑定的 model interfaces。',
          ),
        ],
      ),
    ),
    section(
      'o0340-9-tokenizer-model',
      '9. Tokenizer 与 Model 必须绑定：Shape 相同仍可能完全错位',
      '模型的 embedding row 与输出 logit column 是在特定 ID mapping 下训练的。换一个 tokenizer 后，即使 V 恰好相同，合法整数也可能查到错误的 token 参数。',
      [
        '定义 checkpoint 的 tokenizer compatibility contract，而不只检查 tensor dimensions。',
        '用 w09-readable-v1 中 AI / 喜欢 的 ID swap 显示静默错位。',
      ],
      [
        paragraph(
          'w09-readable-v1 把“我喜欢AI，AI也喜欢猫。”中的 喜欢 编为 5、AI 编为 6。若另一个同样 V=11 的 tokenizer 把两者交换，输入 6 会读取原本为 AI 训练的 embedding row，却被新系统解释成 喜欢；输出 column 6 也会 decode 成错误 piece。',
        ),
        table(
          ['bundle item', 'why model loading needs it'],
          [
            [
              'ordered token list / Vocabulary',
              '定义每个 embedding row 与 LM-head column 的名称',
            ],
            ['ordered BPE merges', '决定新文字如何组合成 Vocabulary entries'],
            [
              'normalizer + pre-tokenizer',
              '决定 merge 前看到的 symbols 与 boundaries',
            ],
            [
              'special-token IDs / insertion policy',
              '定义 BOS、EOS、PAD、UNK 的控制地址与何时出现',
            ],
            [
              'tokenizer version / content hash',
              '在加载前做精确 compatibility check',
            ],
            [
              'model config + weights',
              '声明 V、C、context 等 shape，并保存已学习参数',
            ],
          ],
          'Tokenizer artifact 与 model checkpoint 是一个兼容性 bundle',
        ),
        code(
          'text',
          `w09-readable-v1:
ID 5 -> 喜欢
ID 6 -> AI

incompatible-tokenizer:
ID 5 -> AI
ID 6 -> 喜欢

Both report V=11.
Model input ID 6 is numerically in range, but its learned row and displayed token disagree.`,
        ),
        formula(
          String.raw`E[\mathrm{input\_ids}]\in\mathbb{R}^{B\times T\times C},\qquad E\in\mathbb{R}^{V\times C},\qquad \mathrm{logits}\in\mathbb{R}^{B\times T\times V}`,
          'input IDs select Vocabulary rows; output IDs select Vocabulary columns. Both axes need the identical ordered mapping used in training。',
        ),
        callout(
          'Compatibility 不只是 V 相等',
          [
            paragraph(
              '安全加载应验证 tokenizer policy/version/hash、ordered tokens、special IDs 与 model config。给 Vocabulary 追加 entry 还需要调整受 V 影响的 embedding 与 LM head，并通常需要相应训练。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '两个 tokenizer 包含相同 token strings 但顺序不同，仍然不兼容。',
        'Normalization policy 改变可能在 lookup 之前就产生另一串 IDs。',
        '不能只 resize 一张表就假定新 token 已经学会有用表示。',
      ],
      check('为什么两个 V=11 的 tokenizer 仍可能不能共享同一个 checkpoint？', [
        paragraph(
          'V 只说明 row/column 数量；ordered mapping、merges、normalization 与 special policy 可能不同。只要某个 ID 改名，已训练参数的地址语义就错位。',
        ),
      ]),
    ),
    section(
      'o0341-10-special-tokens',
      '10. Special Tokens：由谁添加边界必须只有一个答案',
      '模型需要文档边界、padding 或 unknown control IDs，但若 encoder 与 data pipeline 都手动添加 EOS，同一文档会出现重复边界。',
      [
        '定义 w09-readable-v1 的四个 reserved IDs 与各自职责。',
        '用 encode_content(add_special_tokens=False) 与 encode_document(add_special_tokens=True) 明确分离内容和完整文档 API。',
      ],
      [
        paragraph(
          '在 Week 9 的可读快照中，0..3 是 reserved specials，内容 entries 从 4 开始。它们是 model-visible Vocabulary entries，不是输入中看见字符 <EOS> 就自动产生的魔法。是否显示、mask、停止生成或忽略 loss 都需要调用方与模型 API 明确约定。',
        ),
        table(
          [
            'ID',
            'special token',
            'role in w09-readable-v1',
            'typical handling',
          ],
          [
            [
              '0',
              '<BOS>',
              '文档起点 / 初始 context',
              'encode_document 在最前添加一次',
            ],
            [
              '1',
              '<EOS>',
              '文档终点',
              'encode_document 在最后添加一次；generation 可把它当 stop candidate',
            ],
            [
              '2',
              '<PAD>',
              '把不等长 rows 补成 rectangle',
              '通常在 attention / loss 中 mask',
            ],
            [
              '3',
              '<UNK>',
              'word-only fallback 的 unknown marker',
              '有损；不是 byte fallback 的必需品',
            ],
          ],
        ),
        table(
          ['API result for 我喜欢AI，AI也喜欢猫。', 'tokens', 'IDs'],
          [
            [
              'encode_content(add_special_tokens=False)',
              '[我,喜欢,AI,，,AI,也,喜欢,猫,。]',
              '[4,5,6,7,6,8,5,9,10]',
            ],
            [
              'encode_document(add_special_tokens=True)',
              '[<BOS>,我,喜欢,AI,，,AI,也,喜欢,猫,。,<EOS>]',
              '[0,4,5,6,7,6,8,5,9,10,1]',
            ],
          ],
        ),
        code(
          'python',
          `from w09_readable_v1 import (
    BOS_ID,
    EOS_ID,
    W09_READABLE_V1,
    encode_content,
    encode_document,
)

text = "我喜欢AI，AI也喜欢猫。"
content_ids = encode_content(text)
document_ids = encode_document(text)

assert document_ids == [BOS_ID, *content_ids, EOS_ID]
assert W09_READABLE_V1.decode(
    document_ids,
    skip_special_tokens=True,
) == text

# Wrong: encode_document already owns both boundaries.
# duplicated = [BOS_ID, *encode_document(text), EOS_ID]`,
          'special_tokens_example.py',
        ),
        formula(
          String.raw`0\le \mathrm{special\_id}<V,\qquad V_{\mathrm{w09\text{-}readable\text{-}v1}}=11`,
          'Special IDs 与内容 IDs 都占用同一 Vocabulary axis，但必须有独立的控制角色与 insertion policy。',
        ),
      ],
      [
        'raw text 中出现字面字符 <EOS> 不表示 tokenizer 一定把它识别为 reserved EOS。',
        'encode_document 已经加边界时，不要再手动 append EOS 或 prepend BOS。',
        'EOS 高概率不保证 generation 一定在理想位置停止；stop rule 仍需显式实现。',
        '这些 special IDs 属于 Week 9 artifact；Week 10 的 mini-gpt-v1 明确没有 specials。',
      ],
      check('为什么 encode_document(text)+[EOS] 会破坏本节约定？', [
        paragraph(
          'encode_document(add_special_tokens=True) 已在末尾放置一次 ID 1；再次 append 会制造两个 EOS。需要无边界内容时应调用 encode_content。',
        ),
      ]),
    ),
    section(
      'o0342-11-padding-attention-mask',
      '11. Padding 与 Attention Mask：矩形 Shape 不等于有效数据',
      '真实文档长度不同，而 batch 必须是矩形 [B,T]。若仅补 PAD 却不告诉 Attention 与 loss 哪些 slots 无效，模型会把 shape filler 当成文字。',
      [
        '分开 PAD token ID、attention visibility 与 target loss inclusion。',
        '说明 causal mask 处理未来位置，padding mask 处理无效 slots，两者不可互换。',
      ],
      [
        paragraph(
          '保留主句“我喜欢AI，AI也喜欢猫。”作为 row 0，并用较短的“我喜欢AI。”作为 row 1 的 padding illustration。两者均由 w09-readable-v1 的 encode_document 产生；本表临时把 batch width 记作 T_pad=11，避免与后面 training-window T=4 混淆。',
        ),
        table(
          ['row', 'input_ids [T_pad=11]', 'attention_mask [T_pad=11]'],
          [
            [
              '0: 我喜欢AI，AI也喜欢猫。',
              '[0,4,5,6,7,6,8,5,9,10,1]',
              '[1,1,1,1,1,1,1,1,1,1,1]',
            ],
            [
              '1: 我喜欢AI。',
              '[0,4,5,6,10,1,2,2,2,2,2]',
              '[1,1,1,1,1,1,0,0,0,0,0]',
            ],
          ],
          '右侧 padding 后 input_ids 与 attention_mask 均为 [B,T_pad]=[2,11]',
        ),
        table(
          ['object', 'example value', 'job'],
          [
            ['PAD token ID', '2', '占住矩形 tensor 的 unused slot'],
            [
              'attention_mask',
              'real=1, pad=0',
              '禁止 query 把 PAD key 当作上下文；具体 API 还会处理 padded queries',
            ],
            [
              'causal mask',
              'j≤t',
              '禁止任何 query 读取 future key，不判断 PAD',
            ],
            [
              'loss ignore index',
              '-100',
              '让 padded target 不计入 cross entropy',
            ],
          ],
        ),
        formula(
          String.raw`M_{\mathrm{allowed}}[b,t,j]=\mathbf{1}[j\le t]\land\mathbf{1}[\mathrm{attention\_mask}[b,j]=1]`,
          '一个常见 decoder-only allowed-key rule 同时要求 key 不在未来且不是 padding；实际 mask layout 应遵循 model API。',
        ),
        formula(
          String.raw`\mathrm{input\_ids},\mathrm{attention\_mask}\in\mathbb{Z}^{B\times T_{\mathrm{pad}}},\qquad M_{\mathrm{causal}}\in\{0,1\}^{T_{\mathrm{pad}}\times T_{\mathrm{pad}}}`,
          'input / padding-validity mask 是 batch-by-time；causal mask 是 query-by-key positions，并可 broadcast 到 batch/head axes。',
        ),
        callout('Padding conventions 会变化', [
          paragraph(
            '有些 API 左 pad、有些右 pad；有些组合 additive mask，有些接收 booleans。必须读取模型 contract，而不是根据 0 的外观猜它是 token ID、attention flag 还是 ignored target。',
          ),
        ]),
      ],
      [
        '只在 loss 中忽略 PAD 仍可能允许 Attention 把 PAD 当作 context。',
        'attention_mask 的 0 是控制 flag，不是“token ID 0=<BOS>”。',
        'causal mask 与 padding mask 解决不同问题。',
        'EOS 与 padding 的相对顺序必须由 document/padding policy 定义。',
      ],
      check(
        '为什么 input_ids.shape=[2,11] 仍不足以说明这个 padded batch 正确？',
        [
          paragraph(
            'Shape 只保证矩形。还需 attention mask 排除 padding keys，并用 ignore_index 或等价 loss mask 排除 padded targets；causal mask 另行阻止 future leakage。',
          ),
        ],
      ),
    ),
    section(
      'o0343-12-corpus-token-tensor',
      '12. 把 Corpus 变成 Token Tensor：保留顺序与文档边界',
      'Corpus 是多份原始 documents；模型训练需要可复现的一维 integer stream。若随意 shuffle 单个 tokens 或重复插入边界，next-token context 就被破坏。',
      [
        '用 frozen tokenizer 按 document 编码，再依次串接为 [L] stream。',
        '让 encode_document 独自负责 BOS/EOS，并明确 torch.long 是 embedding lookup 的输入 dtype。',
      ],
      [
        paragraph(
          '只有一份固定文档“我喜欢AI，AI也喜欢猫。”时，w09-readable-v1 直接得到 [0,4,5,6,7,6,8,5,9,10,1]，shape [11]。它仍是一条 chronological stream，不是 batch，也没有 C feature axis。',
        ),
        code(
          'python',
          `import torch

from w09_readable_v1 import encode_document

documents = ["我喜欢AI，AI也喜欢猫。"]

# encode_document already inserts exactly one BOS and one EOS per document.
stream: list[int] = []
for document in documents:
    stream.extend(encode_document(document))

stream_tensor = torch.tensor(stream, dtype=torch.long)

assert stream == [0, 4, 5, 6, 7, 6, 8, 5, 9, 10, 1]
assert tuple(stream_tensor.shape) == (11,)
assert stream_tensor.dtype == torch.long`,
          'corpus_to_tensor.py',
        ),
        formula(
          String.raw`s^{(d)}\in\{0,\ldots,V-1\}^{L_d},\qquad s=\operatorname{concat}\!\left(s^{(1)},\ldots,s^{(D)}\right)\in\{0,\ldots,V-1\}^{L},\qquad L=\sum_{d=1}^{D}L_d`,
          '每份 document sequence 已包含约定边界，按 document order 串接后得到一维 stream。',
        ),
        callout(
          '另一种合法 API，但不能混合使用',
          [
            paragraph(
              '若 pipeline 选择 encode_content，则可显式构造 [BOS, *content_ids, EOS]；若选择 encode_document，就不得再手动添加。关键是每个 document 的 boundary ownership 唯一且可测试。',
            ),
          ],
          'principle',
        ),
      ],
      [
        'ID tensor 必须是 integer / torch.long；float32 ID 不能作为普通 embedding indices。',
        '按 token 随机 shuffle 会摧毁原始 next-token adjacency。',
        '忘记 document boundary 可能让一个 document 的最后 token 直接预测下一篇无关文档的首 token。',
        '[L]=[11] 不是 [B,T]，也不是 embedding [11,C]。',
      ],
      check('固定句刚变为 stream_tensor 时 shape 与 dtype 是什么？', [
        paragraph(
          'shape 是 [L]=[11]，dtype 是 torch.long。它是一条有序 ID stream，尚未切 window 或 stack batch。',
        ),
      ]),
    ),
    section(
      'o0344-13-train-validation-split',
      '13. Train / Validation Split：先隔离 Documents，再切 Windows',
      '若把相邻 token windows 随机分到 train 与 validation，几乎重复的上下文可能同时出现在两边，让 validation loss 过度乐观。',
      [
        '在 model fitting 之前按 document 或合适的时间/group boundary 分割原始数据。',
        '若 tokenizer 从零训练，只在 train documents 上 fit，然后用同一 frozen artifact 编码两边。',
      ],
      [
        paragraph(
          '单句“我喜欢AI，AI也喜欢猫。”只用于 pipeline 手算，不能冒充有意义的 train/validation experiment。真实 corpus 应先分 documents，再冻结 tokenizer，最后分别建立 train_stream 与 val_stream；validation forward 不调用 backward 或 optimizer.step。',
        ),
        chain([
          'raw documents',
          'document/group/temporal split',
          'fit tokenizer A on train documents only (when training from scratch)',
          'freeze A',
          'encode train documents → train_stream [L_train]',
          'encode validation documents → val_stream [L_val]',
          'form windows separately inside each split',
        ]),
        formula(
          String.raw`D_{\mathrm{train}}\cap D_{\mathrm{val}}=\varnothing,\qquad \forall w\in W_{\mathrm{train}}:\operatorname{source}(w)\in D_{\mathrm{train}},\qquad \forall w\in W_{\mathrm{val}}:\operatorname{source}(w)\in D_{\mathrm{val}}`,
          'Train 与 validation 的 source-document provenance 不相交；每个 window instance 只在所属 document 的 lane 内产生。',
        ),
        paragraph(
          '这是 provenance guarantee，不是 value-level deduplication：两份独立 documents 可能都包含常见短语或 boilerplate，因此完全相同的 ID window values 可以自然地分别出现在 train 与 validation。若任务还要求去重，必须另外声明 document/group deduplication policy。',
        ),
        table(
          ['stage', 'train lane', 'validation lane'],
          [
            ['raw data', 'train documents', 'held-out validation documents'],
            [
              'tokenizer',
              'fit A here if from scratch, then freeze',
              'only apply frozen A',
            ],
            [
              'model',
              'forward + loss + backward + step',
              'eval/no_grad forward + loss only',
            ],
            [
              'claim',
              'optimization progress',
              'estimate on held-out token sequences',
            ],
          ],
        ),
      ],
      [
        '不能训练完 model 后才从同一 windows 挑一部分叫 validation。',
        '从零训练 tokenizer 时，默默在 validation text 上 fit merges 会污染 protocol。',
        'Document split 不保证两边绝不会出现数值相同的 token sequence；它保证 source provenance 分离。',
        'train loss 下降不能替代 held-out validation。',
        '使用 pretrained tokenizer 时应锁定外部 artifact，而不是在本 corpus 上偷偷重训。',
      ],
      check('为什么应在 stream concatenation 之前按 documents 分割？', [
        paragraph(
          '这样同一 source document 与同一个 window instance 不会跨进两个 splits，也能在每条 lane 内独立保留 document boundaries；不同 documents 仍可能独立产生相同的 token-value sequence。',
        ),
      ]),
    ),
    section(
      'o0345-14-token-stream-example',
      '14. 从 Token Stream 取一个 Example：Target 必须右移一位',
      '若 input 与 target 完全相同，模型学习的是复制当前 ID，而不是预测 stream 中的下一个 ID；若起点越界，target 还会少一个元素。',
      [
        '从 w09-readable-v1 的 [L]=[11] stream 推导一个 T=4 teacher-forced example。',
        '逐位置标明 x、y 与 causal left context，避免 shape 正确但监督错位。',
      ],
      [
        paragraph(
          '固定 stream s=[0,4,5,6,7,6,8,5,9,10,1] 来自“我喜欢AI，AI也喜欢猫。”。选择 start i=0 与 context length T=4；x 读四个连续 IDs，y 从下一个位置读同样四个 IDs。',
        ),
        table(
          ['stream index', 'ID', 'token'],
          streamRows,
          'w09-readable-v1 的完整一维 stream s，L=11',
        ),
        code(
          'text',
          `x = s[0:4] = [0,4,5,6] = [<BOS>, 我, 喜欢, AI]  shape [T]=[4]
y = s[1:5] = [4,5,6,7] = [我, 喜欢, AI, ，]       shape [T]=[4]`,
        ),
        table(
          [
            'position t',
            'input token',
            'target next token',
            'causal model may use',
          ],
          [
            ['0', '<BOS>', '我', '[<BOS>]'],
            ['1', '我', '喜欢', '[<BOS>, 我]'],
            ['2', '喜欢', 'AI', '[<BOS>, 我, 喜欢]'],
            ['3', 'AI', '，', '[<BOS>, 我, 喜欢, AI]'],
          ],
          '四个 aligned next-token tasks；target 不是提前提供给同一 query',
        ),
        formula(
          String.raw`x=s[i:i+T],\qquad y=s[i+1:i+T+1],\qquad x,y:[T]=[4]`,
          'Input window 与 target window 从同一 stream 取得，target 的 start 恰好右移一位。',
        ),
        formula(
          String.raw`0\le i\le L-T-1,\qquad L=11,\ T=4\quad\Longrightarrow\quad i\in\{0,1,\ldots,6\}`,
          '合法 start 必须为 target 保留额外一个 ID；这里共有 L−T=7 个 starts。',
        ),
      ],
      [
        'y=x 会把 next-token supervision 写错。',
        'i=L−T=7 会使 y 少一个元素；最后合法 start 是 6。',
        'Transformer position t 可用 permitted left prefix，不只是当前单个 input token。',
        'Causal mask 防止 future leakage；shift 则定义正确 label，两者职责不同。',
      ],
      check('在 i=0 的 example 中，input ID 5（喜欢）对应哪个 target？', [
        paragraph(
          '它位于 t=2，对齐的 target 是 ID 6（AI）；模型可用 [<BOS>,我,喜欢] 预测 AI，但不能先读取该 target。',
        ),
      ]),
    ),
    section(
      'o0346-15-batch',
      '15. 构造一个 Batch：随机选择 Rows，Rows 内保持连续',
      'Optimizer step 需要多条 training windows；若把单个 tokens 随机拼成 row，原本的 chronological context 与 right-shift targets 都会断裂。',
      [
        '把 B 个合法 start 对应的 contiguous x/y windows stack 为 [B,T]。',
        '精确说明 torch.randint 的 exclusive upper bound 与 L≤T error。',
      ],
      [
        paragraph(
          '继续只用“我喜欢AI，AI也喜欢猫。”的 w09-readable-v1 stream。固定 B=2、T=4，并选择 legal starts [0,5]；随机性只选择 row 从哪里开始，每个 row 内仍按原 stream 顺序前进。',
        ),
        code(
          'text',
          `starts = [0,5]

inputs = [
  [0,4,5,6],  # <BOS> 我 喜欢 AI
  [6,8,5,9],  # AI 也 喜欢 猫
]             # [B,T] = [2,4]

targets = [
  [4,5,6,7],  # 我 喜欢 AI ，
  [8,5,9,10], # 也 喜欢 猫 。
]             # [B,T] = [2,4]`,
        ),
        table(
          ['batch row b', 'start', 'input sequence', 'target sequence'],
          [
            ['0', '0', '<BOS> 我 喜欢 AI', '我 喜欢 AI ，'],
            ['1', '5', 'AI 也 喜欢 猫', '也 喜欢 猫 。'],
          ],
          '每行需要 T+1 个 source IDs，才能得到 T 个 inputs 与 T 个 shifted targets',
        ),
        code(
          'python',
          `import torch


def sample_batch(source: torch.Tensor, batch_size: int, context_length: int):
    if source.ndim != 1:
        raise ValueError("source must have shape [L]")
    if len(source) <= context_length:
        raise ValueError("source needs at least context_length + 1 IDs")

    # torch.randint excludes high, so high=L-T yields starts 0..L-T-1.
    starts = torch.randint(
        low=0,
        high=len(source) - context_length,
        size=(batch_size,),
    )
    inputs = torch.stack(
        [source[i : i + context_length] for i in starts.tolist()]
    )
    targets = torch.stack(
        [source[i + 1 : i + context_length + 1] for i in starts.tolist()]
    )
    return inputs, targets


source = torch.tensor([0, 4, 5, 6, 7, 6, 8, 5, 9, 10, 1])
inputs, targets = sample_batch(source, batch_size=2, context_length=4)
assert inputs.shape == targets.shape == (2, 4)`,
        ),
        formula(
          String.raw`X[b,:]=s[i_b:i_b+T],\qquad Y[b,:]=s[i_b+1:i_b+T+1],\qquad X,Y\in\mathbb{Z}^{B\times T}=\mathbb{Z}^{2\times4}`,
          '每个 batch row 使用同一个 start 的 input/target slices；输出 interface 是两张 [2,4] integer tensors。',
        ),
        formula(
          String.raw`L-T=11-4=7\quad\Longrightarrow\quad \mathrm{legal\ starts}=\{0,\ldots,6\}`,
          'torch.randint 的 high=7 不包含 7，恰好产生七个合法 starts；需要更多 rows 时可有放回采样。',
        ),
      ],
      [
        'high=len(source)−T+1 会允许 invalid start 7。',
        'inputs 与 targets 必须来自同一 start，不能分别随机抽取。',
        'B 是 batch rows 数，不是 Vocabulary candidates。',
        '这个 [2,4] batch 只属于 Week 9 artifact，不能直接送入 Week 10 block_size=2 模型。',
      ],
      check('为什么每个 row 要从 source 读取 T+1 个 IDs？', [
        paragraph(
          '前 T 个组成 input，向右一位的后 T 个组成 target；最后一个 input 的 next-token label 需要额外的第 T+1 个 source ID。',
        ),
      ]),
    ),
    section(
      'o0347-16-tokenizer',
      '16. Tokenizer 不负责理解语言：它只定义离散接口',
      '更紧凑的 segmentation 会提升计算效率，但很容易被误写成 tokenizer 自己拥有词义、事实或 reasoning。',
      [
        '把 tokenizer-owned integer interface 与 model-owned learned float parameters 分开。',
        '再次用 猫 的 ID 9 说明地址、embedding 与 contextual representation 是三件事。',
      ],
      [
        paragraph(
          'w09-readable-v1 把固定句中的 猫 映射为 9，只表示 ordered Vocabulary 的第 9 个地址。任何“猫常与喜欢共同出现”的 predictive pattern，都要由 token sequences、loss、backprop 与 neural parameters 学习；数字 9 和 BPE merge 本身不含这条知识。',
        ),
        chain([
          'raw text 我喜欢AI，AI也喜欢猫。',
          'tokenizer → integer IDs [B,T]',
          'embedding lookup → learned floats [B,T,C]',
          'Transformer → contextual floats [B,T,C]',
          'LM head → logits [B,T,V]',
          'decode selected IDs → text',
        ]),
        table(
          ['tokenizer responsibility', 'model / training responsibility'],
          [
            [
              'normalization and segmentation',
              'learn useful continuous features from examples',
            ],
            [
              'ordered Vocabulary and ID lookup',
              'combine left context with Attention / FFN',
            ],
            [
              'special-token and fallback policy',
              'produce and update vocabulary logits via loss',
            ],
            [
              'decode IDs under fixed artifact',
              'model probability, behavior, factuality and errors',
            ],
          ],
        ),
        formula(
          String.raw`\mathrm{ids}:[B,T]\xrightarrow{E[\cdot]}\mathrm{embeddings}:[B,T,C]\xrightarrow{\mathrm{Transformer}}\mathrm{context}:[B,T,C]\xrightarrow{\mathrm{LM\ head}}\mathrm{logits}:[B,T,V]`,
          'Tokenizer owns the integer IDs at the left boundary; learned float tables and transformations belong to the model。',
        ),
      ],
      [
        'Embedding 不是人工撰写的词典释义，而是从 objective 学得的 parameter rows。',
        'Subword boundaries 不是 guaranteed semantic parse tree。',
        'Byte coverage 不能自动解决 reasoning、factuality、safety 或 bias。',
        'ID 数值的距离不等于 token meaning 的距离。',
      ],
      check('系统可以在哪里学到 猫 与 喜欢 经常共同出现？', [
        paragraph(
          '在用 token sequences 训练并由 optimizer 更新的 embeddings、Attention、FFN 与 output parameters 中；不会在静态 ID 9 或 tokenizer merge list 中自行出现。',
        ),
      ]),
    ),
    section(
      'o0348-17-week-9-7',
      '17. Week 9 最应该理解的 7 件事',
      'Vocabulary、BPE、special IDs、stream 和 batch 若只作为独立术语记忆，容易在真正接 model 时混用 artifacts 或把 target shift 写错。',
      [
        '用恰好七条可由固定句验证的陈述回收整条数据链。',
        '把 tokenizer training / encoding 与 stream / batch 两组最常见混淆再次分开。',
      ],
      [
        list(
          [
            'Token 是 tokenizer-defined compute unit，不一定是 word。',
            'Subword 在 Vocabulary size 与 sequence length 之间折中；token count 属于具体 tokenizer。',
            'Encode 把 text 映射到 IDs；decode 按 frozen tokenizer policy 返回 text。',
            'Tokenizer training 构建 artifacts；encoding 只应用它们，不改变它们。',
            'Tokenizer ID mapping 与 special-token policy 必须匹配 model checkpoint。',
            'Token stream 通过右移一位提供 inputs 与 next-token targets。',
            'Batch 把连续、已右移的 windows stack 为 inputs,targets:[B,T]。',
          ],
          true,
        ),
        formula(
          String.raw`\mathrm{text}\to\mathrm{ids}\ [L]\to x,y\ [T]\to\mathrm{batch}\ [B,T]\to\mathrm{model\ logits}\ [B,T,V]`,
          '从固定句到 logits 的每一步只改变已说明的单位或 axes。',
        ),
        paragraph(
          '用 AI 自查第 4 与第 6 条：BPE training 学到 (41,49)→256 后，encoding 两次出现的 AI 只应用该 rule，不重新计数；在 i=0 的可读 stream example 中，AI 是 t=3 的 input，右移 target 是 ，。',
        ),
        callout(
          '本章固定 artifact recap',
          [
            paragraph(
              'w09-readable-v1：V=11、special IDs 0..3、document stream [0,4,5,6,7,6,8,5,9,10,1]、L=11、training-window T=4、七个 legal starts 0..6。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '七条不能缩写成“token=word”或“BPE 学懂常用词”。',
        'Readable snapshot 与两轮 toy BPE 的 token inventory 是两个明确标注的教学 artifacts。',
        'Shape 相同不能修复 ID mapping 不一致。',
      ],
      check('请用固定句中的 AI 解释第 4 与第 6 条。', [
        paragraph(
          '第 4 条：encoding 只应用已冻结的 AI merge，不更新 pair counts。第 6 条：i=0 时 AI 作为 input ID 6 对齐下一 stream ID 7（，）作为 target。',
        ),
      ]),
    ),
    section(
      'o0349-18-week-9-week-10',
      '18. Week 9 → Week 10：先结束一个 ID Space，再切换模型协议',
      'Week 9 的 readable batch 含 IDs 5、6、8、9 且 T=4；若直接交给 Week 10 的 V=5、block_size=2 MiniGPT，会出现 out-of-range lookup 与 context-length violation。',
      [
        '把“会构造 [B,T] IDs”的通用技能与某个 tokenizer artifact 的具体数字分开。',
        '显式结束 w09-readable-v1，并让 Week 10 从独立的 mini-gpt-v1 与 idx=[2,2] 重新开始。',
      ],
      [
        paragraph(
          '“我喜欢AI，AI也喜欢猫。”已经完成 Week 9 的全部可读 pipeline。它的 w09-readable-v1 IDs 只用于本章，不能因为都是整数就自动兼容另一模型。Week 10 会回到课程的五-token、按空格切分 corpus，并在进入 embedding 前重新按 mini-gpt-v1 编码。',
        ),
        table(
          [
            'artifact',
            'tokens / IDs',
            'V and specials',
            'context example',
            'lifetime',
          ],
          [
            [
              'w09-readable-v1',
              '<BOS>=0,<EOS>=1,<PAD>=2,<UNK>=3,我=4,喜欢=5,AI=6,，=7,也=8,猫=9,。=10',
              'V=11; specials 0..3',
              'stream L=11; batch T=4',
              'ends in Week 9',
            ],
            [
              'mini-gpt-v1',
              '[我,喜欢,AI,学习,猫] → [0,1,2,3,4]',
              'V=5; no specials, padding, or UNK',
              'block_size=2; initial idx shape [2,2]',
              'canonical Week 10–12 model interface',
            ],
          ],
          '两个 artifacts 的 numeric IDs 互不兼容',
        ),
        code(
          'python',
          `# Week 10 starts fresh with mini-gpt-v1.
mini_gpt_tokens = ["我", "喜欢", "AI", "学习", "猫"]
mini_gpt_token_to_id = {token: index for index, token in enumerate(mini_gpt_tokens)}

idx = torch.tensor([
    [0, 1],  # 我 喜欢
    [4, 1],  # 猫 喜欢
], dtype=torch.long)

assert tuple(idx.shape) == (2, 2)
assert int(idx.min()) >= 0
assert int(idx.max()) < 5

# Never pass Week 9's IDs [5,6,8,9] or T=4 batch to this V=5,
# block_size=2 model.`,
        ),
        chain([
          'finish w09-readable-v1: mixed-script text → stream [11] → Week 9 batch [2,4]',
          'switch tokenizer/model bundle; do not reinterpret old integers',
          'mini-gpt-v1 tokens [我,喜欢,AI,学习,猫], IDs [0..4], V=5',
          'idx=[[0,1],[4,1]], shape [B,T]=[2,2]',
          'Week 10 token + position embeddings [2,2,4]',
          'two Transformer blocks → logits [2,2,5]',
        ]),
        formula(
          String.raw`\mathrm{idx}\in\{0,\ldots,4\}^{2\times2}\xrightarrow{\mathrm{Embedding}(5,4)}\mathbb{R}^{2\times2\times4}\xrightarrow{\mathrm{MiniGPT}}\mathbb{R}^{2\times2\times5}`,
          'Week 10 begins with mini-gpt-v1 IDs inside 0..4 and T=2; it does not consume the Week 9 [2,4] tensor。',
        ),
        callout(
          '通用 handoff 与具体 artifact',
          [
            paragraph(
              '通用 contract 仍是 frozen tokenizer → integer input_ids [B,T] → embedding → Transformer → logits [B,T,V]。但 V、T、ID meaning 与 special policy 必须来自同一 bundle；更换 bundle 就要从 raw/model-specific text 重新 encode。',
            ),
          ],
          'principle',
        ),
      ],
      [
        '绝不能把 Week 9 的 ID 6 送入只有 rows 0..4 的 Week 10 embedding。',
        '绝不能把 Week 9 的 T=4 window 送入 block_size=2 的 canonical MiniGPT。',
        'mini-gpt-v1 没有 BOS/EOS/PAD/UNK；不要把 0..3 继续解释为 Week 9 specials。',
        'Tokenizer 提供 IDs；token/position embeddings 与 contextual representation 仍由模型负责。',
      ],
      check(
        'Week 10 从本章接收的精确起点是什么？为什么不能复用 Week 9 batch？',
        [
          paragraph(
            '它从 mini-gpt-v1 的 idx=[[0,1],[4,1]]、shape [2,2] 开始；该 artifact 为 V=5、无 specials、block_size=2。Week 9 batch 属于 V=11、T=4 的另一 ID space，会导致地址越界与长度不兼容。',
          ),
        ],
      ),
    ),
  ],
};
