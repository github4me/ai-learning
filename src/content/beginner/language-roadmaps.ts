import type { SectionReview } from './apply-beginner-review';
import type { CuratedBodyBlock } from '../curated/types';

const paragraph = (text: string): CuratedBodyBlock => ({
  type: 'paragraph',
  text,
});
const roadmap = (
  sectionId: string,
  start: string,
  sessions: string[][],
  finish: string,
): SectionReview => ({
  sectionId,
  rationale: '用本周实际阅读顺序替换旧导读，主线与选读分开。',
  body: [
    paragraph(start),
    { type: 'table', headers: ['学习单元', '本次解决的问题'], rows: sessions },
    paragraph(finish),
    paragraph(
      '建议阅读、手算、改代码交替进行，每个单元可拆成几次完成。章节编号保留用于旧链接和回查；按页面从上到下的新顺序学习，不需要按旧编号来回跳转。',
    ),
  ],
});

export const LANGUAGE_ROADMAPS: SectionReview[] = [
  roadmap(
    'o0221-week-6-embedding-language-model',
    '本周不从概率符号开始，而从三句有答案的文字开始。前置是 Week 5 的 Tensor、矩阵乘法和一次训练步骤。主线词表固定为 [我,喜欢,AI,学习,猫]，以后讲 Attention 时也不改这些编号。',
    [
      [
        '一：把文字变成题',
        '先 Token，再 Input/Target，再 Batch；说明 B 是几行、T 是每行几个输入位置，为什么需要 T+1 个原始 token。',
      ],
      [
        '二：表示、评分、计错',
        '解释 C 个表示特征和 V 个候选的区别；Embedding → 给定 h 的输出层 → logits → Softmax → CE。',
      ],
      [
        '三：连起来并学习',
        '用串联练习核对六道题，再运行 Bigram 的完整一步和重复训练。',
      ],
      [
        '四：生成与局限',
        '先明确如何选择和追加，再解释同一末尾 token 无法区分不同前缀；引出 Attention。',
      ],
    ],
    '完成标准：手算 p(喜欢)≈0.5923 和 CE≈0.5237，解释 g=p−one-hot；运行 python week06_bigram.py。自然对数的求导与 Perplexity 可第二遍读；输出层的实际乘加、概率归一化及 target 对齐不能跳过。',
  ),
  roadmap(
    'o0254-week-7-attention-token',
    '上一周的 Bigram 只用当前 token 查一行分数。现在保留“我 喜欢”和“猫 喜欢”两条前缀，想让最后的“喜欢”读到不同的左侧信息。Token 编号不变；为算术清楚，本周显式使用更简单的四维输入和固定投影。',
    [
      [
        '一：读取什么',
        '平均和手工加权的限制；再说明 query 是本次匹配需求、key 用来打分、value 是实际取回内容。',
      ],
      [
        '二：逐步手算',
        'Q/K/V → 点积 → 缩放 → 每行权重 → 加权值；每个数都追溯到同一组输入。',
      ],
      [
        '三：为什么不能偷看',
        '对应输入和下一词目标，说明 mask 的方向、负无穷和位置轴。',
      ],
      [
        '四：怎样参与学习',
        '从末位置输出接词表评分和 CE；观察一个 Wq 参数的梯度，再理解多头。',
      ],
    ],
    '运行 python week07_attention.py；需看到 A/B 末位置权重不同，并解释两种 Softmax 分别沿“位置”还是“词表”归一化。多头并行读信息，多个 block 串行改造表示，不要混为一谈。',
  ),
  roadmap(
    'o0285-week-8-transformer-attention',
    'Attention 已经能读上下文，但不是完整 GPT。本周始终区分“原始表示仍从旁路传递”与“子层算出的更新量”。前置是 Week 7 的一次 causal attention，以及均值、平方和平方根。',
    [
      [
        '一：补上位置',
        '同一个 token 的查表向量相同；位置向量告诉模型它出现在哪个位置。',
      ],
      [
        '二：加工与旁路',
        'FFN 在一个位置内组合特征；残差把子层更新加回原始表示。',
      ],
      [
        '三：统一尺度与顺序',
        '手算 LayerNorm；沿 x+attention(LN1(x))、再加 FFN(LN2(...)) 追踪两条旁路。',
      ],
      [
        '四：把表示交给输出层',
        '运行过渡实验，观察 block 输出和词表 logits 的区别，再对照完整两头手算。',
      ],
    ],
    '运行 python week08_bridge.py。先复现上一周单头，再逐项加部件；下方完整 block 使用另行注明的固定两头参数，不把它当成上一周训练产物。Encoder/Decoder 分类、GELU 特殊函数和新位置方案属于选读。',
  ),
  roadmap(
    'o0318-week-9-tokenizer-gpt',
    '本周重点不是实现四套 tokenizer，而是让数据可靠地进入已经学过的模型。主线沿用五词表与 course_data.py；字符和 BPE 是解释替代方案的独立实验。先学会一个可靠入口，再比较更复杂方案。',
    [
      [
        '一：稳定的文字接口',
        '固定分词规则、ID 顺序和未知词行为；重复编码不能重新随机编号。',
      ],
      [
        '二：真的构造数据',
        '同一数据函数从文档构造 T+1 窗口；先分训练/验证，再各自切窗。',
      ],
      [
        '三：判断实验是否可信',
        '检查文档重复、长片段重叠和有效目标数，分清流程演示与独立验证。',
      ],
      [
        '四：按需要比较方案',
        '先可读字符 BPE 的两轮合并，再选读字节、特殊 token 和 padding；不要求这些成为五词模型的前置。',
      ],
    ],
    '运行 python week09_data_protocol.py；它直接产生 Week 10 能接收的五词 inputs/targets。最终项目会明确新建字符词表，不会把另一套 ID 悄悄送进已有 checkpoint。',
  ),
  roadmap(
    'o0350-week-10-gpt-architecture',
    '这周的目标是组装预测函数，不是先掌握全部 checkpoint 工具。保留五词输入，逐步把 embedding、Attention、FFN、残差和归一化接起来；最后仍返回 logits 和可选 loss。',
    [
      [
        '一：最小模型',
        '先只有 token/position embedding 与输出层，定位输入、参数和输出。',
      ],
      [
        '二：逐项组装',
        '单头 → 多头 → 完整 Pre-Norm block → 多层；每阶段观察新增参数与 shape。',
      ],
      [
        '三：看清轴与参数',
        '用有编号的元素追踪 split/transpose/merge；检查 ModuleList 注册和参数数量。',
      ],
      [
        '四：交给训练循环',
        '模型只负责 forward；完整保存格式与权重共享是后面的工程选读。',
      ],
    ],
    '运行 python week10_stages.py --stage embedding，依次换成 single、multi、block、full；完整默认模型与 mini_gpt_walkthrough.py 一致。520 是指定配置的参数量，不是所有 MiniGPT 的固定大小。',
  ),
  roadmap(
    'o0378-week-11-training-inference-mini-gpt',
    'Week 10 返回的是一次预测。本周让它重复学习，并区分训练、验证和生成。先读单 batch 的最小循环；梯度累积及严格恢复检查保留在选读小节，不是理解一次更新的门槛。',
    [
      [
        '一：完成一次更新',
        '区分参数、梯度和 optimizer 状态；用一个参数算两步 AdamW。',
      ],
      [
        '二：重复与测量',
        '先学固定数据，再用不参与更新的文档验证；日志明确在什么时候测量。',
      ],
      [
        '三：保存和加载',
        '保存模型配置、词表和权重；能恢复推理不等于精确复现中断后的训练。',
      ],
      [
        '四：生成',
        '只取当前最后位置的 logits，调温度、限制候选、抽样、追加，再 forward。',
      ],
    ],
    '运行 python week11_adamw_numbers.py 观察两步计算。独立文档训练命令在下一周完整项目；不要把固定三句的 Loss 下降称为泛化。数值比较先看概率表，不凭一条随机续写判断温度效果。',
  ),
  roadmap(
    'o0413-week-12-mini-gpt-text-training-generation',
    '最后一周不是再背一遍部件清单，而是完成三个可交付的小任务。沿用 Week 10 的同一个 MiniGPT 类；机制演示和独立文档实验各有明确的数据、配置和保存格式。',
    [
      [
        '任务 A：追踪',
        '运行五词演示，记录一个输入、目标、表示、logits、loss、梯度、更新与新增 token。',
      ],
      [
        '任务 B：独立文档实验',
        '运行 week12_generalization.py，用随包提供的原创小文档训练和验证，保存实际 CSV、曲线与生成样例。',
      ],
      [
        '任务 C：控制变量',
        '先写预期，再只改变学习率、head 数或层数中的一项；保持其余数据和评估不变。',
      ],
      [
        '最终复述',
        '解释何时只是流程正确、何时学到训练数据、何时才有独立验证证据。',
      ],
    ],
    '所有运行结果必须由实际命令产生。新实验不会预置“训练成功”的日志或曲线；没有改善也应如实记录。完成后应能从一个 prompt 追踪到一个新增 token，并说明小语料和短上下文的局限。',
  ),
];
