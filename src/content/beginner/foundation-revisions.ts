import type { SectionReview } from './apply-beginner-review';
import type { CuratedBodyBlock as Block } from '../curated/types';

const p = (text: string): Block => ({ type: 'paragraph', text });
const f = (latex: string, accessibleText: string): Block => ({
  type: 'formula',
  latex,
  accessibleText,
});
const code = (code: string): Block => ({
  type: 'code',
  language: 'python',
  code,
});
const table = (
  headers: string[],
  rows: string[][],
  caption?: string,
): Block => ({ type: 'table', headers, rows, ...(caption ? { caption } : {}) });
const list = (...items: string[]): Block => ({ type: 'list', items });

export const FOUNDATION_REVISIONS: SectionReview[] = [
  {
    sectionId: 'o0002-week-1-ai',
    rationale: '用一个程序问题替代术语罗列；给出真实实验入口。',
    body: [
      p(
        '本周的问题：怎样把“根据几个输入预测一个数”写成可计算的程序？你已经会函数和列表，暂时不需要矩阵知识。先运行一个函数，再为已经看见的数字结构命名。',
      ),
      code(
        'def predict(x, w, b):\n    return sum(value * weight for value, weight in zip(x, w)) + b\n\nx = [1.0, 2.0]\nw = [0.5, 0.4]\nb = 0.1\nprint(predict(x, w, b))  # 1.4\nprint(predict([2.0, 1.0], w, b))  # 1.5',
      ),
      p(
        '上面是可独立运行的最小演示，约定 x 与 w 长度相同。x 是一次送来的输入；w 和 b 是我们暂时指定的规则。换 x 是换一道题，换 w 或 b 是改规则。程序现在会计算，还没有从数据学习。',
      ),
      table(
        ['学习单元', '完成的具体动作'],
        [
          [
            '一：输入和规则',
            '读数字、向量、特征顺序；解释为什么交换输入会改变结果。',
          ],
          ['二：一行怎样算', '逐项相乘、求和、加偏置；把 Σ 翻成循环。'],
          [
            '三：多行与多输出',
            '把两个样本、两个输出排成表；从循环得到 X @ W + b。',
          ],
          [
            '四：独立完成',
            '运行 course_examples/week01_linear_layer.py，再换输入预测结果。',
          ],
        ],
      ),
      p(
        '本周需掌握：一个数字叫标量；一组有序数字叫向量；多组排成表叫矩阵。shape 说明每条轴有多少项，不能代替“这条轴是什么”的说明。四个学习单元可分次完成，阅读与实验交替进行。',
      ),
      p(
        '完成标准：不看答案写出 [4,3] 的输入、[3,2] 的权重和 [2] 的偏置怎样得到 [4,2]；说明为什么参数还需要下一周自动调整。指数和概率先定位用途，详细计算留到 Week 6。',
      ),
    ],
  },
  {
    sectionId: 'o0023-10-matrix',
    rationale: '从同一函数扩展到 batch 和两个输出，统一各轴及参数共享的意义。',
    body: [
      p(
        '一个 predict 只能给一个输出。如果我们想让同一组输入产生两种分数，不是复制输入的含义，而是为每个输出准备一套权重。两个样本仍使用同一套参数；参数不会因为样本排在第几行而改变。',
      ),
      table(
        ['量', '数值', '行与列的意义'],
        [
          ['X', '[[1,2],[3,4]]', '两行是两个样本；每行两个特征，顺序固定。'],
          [
            'W',
            '[[0.5,−0.3],[0.4,0.8]]',
            '每行对应一个输入特征；每列对应一个输出。',
          ],
          ['b', '[0.1,−0.2]', '每个输出各有一个偏置；所有样本共用。'],
        ],
      ),
      p(
        '先只算第一行第一个输出：1×0.5+2×0.4+0.1=1.4。再算第一行第二个输出：1×(−0.3)+2×0.8−0.2=1.1。第二行用 [3,4] 替换输入，参数不动，得到 [3.2,2.1]。',
      ),
      f(
        String.raw`Z=XW+b=\begin{bmatrix}1.4&1.1\\3.2&2.1\end{bmatrix}`,
        'Z = XW + b；结果两行是样本，两列是输出。',
      ),
      code(
        'X = [[1, 2], [3, 4]]\nW = [[0.5, -0.3], [0.4, 0.8]]\nb = [0.1, -0.2]\nZ = [[sum(row[i] * W[i][j] for i in range(2)) + b[j]\n      for j in range(2)] for row in X]\nprint(Z)  # 约 [[1.4, 1.1], [3.2, 2.1]]',
      ),
      p(
        '这是可独立运行的标准 Python。矩阵乘法只是把这些相同的乘加运算一起表示。X 的列数必须与 W 的行数一致，因为每个输入都需要对应权重；外侧两个数决定结果有多少样本、多少输出。下一节把这条规则扩展到任意 shape。',
      ),
    ],
    check: {
      prompt:
        'EX01：把第一行输入从 [1,2] 改为 [2,1]，参数保持不变。两个输出各是多少？再写出四个样本、三个特征、两个输出时 X/W/b/Z 的 shape。',
      answer: [
        p(
          '两个输出是 2×0.5+1×0.4+0.1=1.5，2×(−0.3)+1×0.8−0.2=0。shape 依次为 [4,3]、[3,2]、[2]、[4,2]。交换输入不改变 shape，却改变特征含义与结果；回顾本节各轴的意义。',
        ),
      ],
    },
  },
  {
    sectionId: 'o0039-week-2-linear-regression-prediction-gradient-descent',
    rationale: '把预测、微调和批量学习组织成连续问题。',
    body: [
      p(
        'Week 1 的参数由人指定。本周让程序根据答案调整参数。我们先学习 x=[1,2,3,4]、y=[3,5,7,9] 这四个点；它们恰好满足 y=2x+1，但训练程序只读取数据，不直接抄这条答案。',
      ),
      p(
        '本周沿四个问题学习：预测错多少 → 轻轻改一个参数会怎样 → 怎样选方向和步长 → 怎样合并四个样本的建议。中间为方便手算，暂时只看 x=2、y=5 这一项，并把初值设为 w=1、b=0；回到四样本时会明确重置 w=b=0。',
      ),
      table(
        ['分次安排', '离开教材能完成什么'],
        [
          ['一：预测与损失', '计算误差，解释为何平方、为何平均。'],
          ['二：微调与导数', '算 L(1) 和 L(1.001)，解释 −12 的含义。'],
          ['三：偏导与更新', '区分只改 w 和同时改 w/b；全部梯度用旧参数。'],
          [
            '四：重复学习与诊断',
            '运行 course_examples/week02_loss_gradient.py，对照三个学习率。',
          ],
        ],
      ),
      p(
        '前置只需会加减乘除和平方。二阶导数、正规方程是选读，不是写训练循环的前提。本周输出是一条真正改参数的训练循环；Week 3 保留这个学习原则，只让预测函数变得更灵活。',
      ),
    ],
  },
  {
    sectionId: 'o0044-5-mse',
    title: '5. MSE：先逐项平方，再明确平均哪些项',
    rationale: '替换单样本/多样本口诀，任务与 reduction 分开。',
    body: [
      p(
        '如果一项误差是 +2，另一项是 −2，直接相加等于 0，却不表示预测全对。平方误差把它们变成 4 和 4。我们再取平均，得到每项通常错到什么程度。这个选择适合本周的数值回归示例，不是所有任务的唯一计分方式。',
      ),
      f(
        String.raw`\hat y_i=wx_i+b,\quad l_i=(\hat y_i-y_i)^2,\quad L=\frac{1}{n}\sum_{i=1}^{n}l_i`,
        '每项预测 y_hat_i；每项平方误差 l_i；n 项的平均 L。',
      ),
      p(
        'i 是样本编号，n 是参与平均的样本数。Σ 表示把每项相加；1/n 表示除以项数。n=1 时 MSE 就是这一项平方误差，不需要换一种公式。选择平方误差取决于你要优化什么；mean/sum 则决定怎样汇总。',
      ),
      table(
        ['x', '目标 y', 'w=b=0 时预测', '平方误差'],
        [
          ['1', '3', '0', '9'],
          ['2', '5', '0', '25'],
          ['3', '7', '0', '49'],
          ['4', '9', '0', '81'],
        ],
      ),
      p(
        '总和是 164，平均 L=164/4=41。若报告 sum loss 应写 164；若报告 mean loss 应写 41。梯度也必须对应同一种汇总，不能报告平均损失却不小心按总和梯度更新。',
      ),
      p(
        'MSE 的单位是目标单位的平方；异常的大误差会受到更强惩罚。下一节的问题是：41 只告诉我们当前结果不好，还没告诉我们 w 应该增加还是减少。',
      ),
    ],
    check: {
      prompt:
        'EX02-A：只有一个样本，预测为 2、目标为 5，MSE 是多少？若同一个样本复制四次，mean loss 与 sum loss 各是多少？',
      answer: [
        p(
          '单样本 MSE=(2−5)²=9。复制四次后 mean 仍是 9，sum 是 36。样本数不决定能否使用 MSE；它影响汇总范围。常见错因是忘记除以 n。',
        ),
      ],
    },
  },
  {
    sectionId: 'o0046-7-derivative',
    title: '7. 导数：把 w 微调一点，Loss 会怎样改变？',
    rationale: '导数首次出现即使用实际回归损失，不再先换成另一个函数。',
    body: [
      p(
        '先固定 x=2、y=5、b=0，只允许改 w。预测是 2w，因此损失函数是 L(w)=(2w−5)²。这里横轴是参数 w，不是输入 x；我们研究的是改规则，而不是换题目。',
      ),
      code(
        'def loss(w):\n    return (w * 2 + 0 - 5) ** 2\n\nprint(loss(1.0))      # 9\nprint(loss(1.001))    # 8.988004\nprint((loss(1.001) - loss(1.0)) / 0.001)  # 约 -11.996',
      ),
      p(
        '这是可独立运行的微调实验。w 增加 0.001，Loss 改变 8.988004−9=−0.011996。除以参数改变量，得到每单位参数变化对应的局部损失变化率，约 −11.996。负号说明在这里向右挪一点会下降。',
      ),
      f(
        String.raw`\frac{\Delta L}{\Delta w}=\frac{-0.011996}{0.001}\approx-11.996,\qquad \frac{dL}{dw}\bigg|_{w=1}=-12`,
        '有限差分约 −11.996；w=1 处的导数为 −12。',
      ),
      p(
        'Δ 读作“变化量”；dL/dw 是把试探步长不断缩小时得到的局部变化率，也叫导数。它不是 Loss 的值：此时 Loss 是 9，导数是 −12。它也不是保证移动一整步就减少 12；局部近似只适用于足够小的变化。',
      ),
      p(
        '为什么解析结果是 −12？把计算拆成两段。w 增加 δ，预测 wx+b 增加 xδ=2δ；当前误差 e=2−5=−3，平方 e² 对误差的局部变化率是 2e=−6。两段倍率相乘：−6×2=−12。Week 4 会把这种“沿依赖路径相乘”推广到整个网络。',
      ),
      f(
        String.raw`\frac{dL}{dw}=\underbrace{2(\hat y-y)}_{\text{误差改变对损失的影响}}\underbrace{x}_{\text{权重改变对预测的影响}}`,
        '损失对权重的导数 = 两倍误差 × 输入。',
      ),
      p(
        '若 x=0，改 w 不改变预测，这一项对 w 的梯度便是 0；此时偏置 b 仍可能影响预测。这不是模型一定学好了，只是这条路径没有提供 w 的学习信号。下一节把多个参数各自的导数装成一组梯度。',
      ),
    ],
    check: {
      prompt:
        'EX02-B：本例只把 w 改为 1.002。先用 −12×0.002 预测 Loss 的变化，再算真实变化。两者为什么不完全相等？',
      answer: [
        p(
          '局部预测变化 −0.024，所以预测 Loss≈8.976。实际 (2.004−5)²=8.976016，差 0.000016。有限步长存在二阶余项；导数不是任意步长的精确变化。回顾本节 Δ 与 d 的区别。',
        ),
      ],
    },
  },
  {
    sectionId: 'o0077-week-3-neural-network-neuron',
    rationale: '重组长篇原稿，保留原锚点及有效详细内容。',
    body: [
      p(
        '上一周已经会训练一条直线。本周先不换优化方法，只问：如果目标规律不是一条直线，该怎样改预测函数？沿“单个神经元 → 非线性 → 两层网络 → 代码与任务输出”四个学习单元前进。',
      ),
      p(
        '先回忆 y_hat=wx+b：输入是这一题给出的数，w/b 是训练要修改的规则。神经网络把多个这样的乘加单元连接起来；真正新增的关键不是名称，而是层间的非线性。先运行 ReLU，再做 XOR，最后手算并实现 2→2→1 网络。',
      ),
      table(
        ['本周实验', '固定条件', '观察目标'],
        [
          [
            '两层 forward',
            '输入 [1,2]；隐藏层两单元；线性输出',
            '隐藏值 [1.4,1.1]，预测 1.3，目标 2 时损失 0.49。',
          ],
          [
            '负输出对照',
            '只换输出权重为 [−1,0]、偏置 0',
            '预测应是 −1.4，不应被通用 layer 函数偷偷截成 0。',
          ],
          [
            'XOR',
            '人为指定两条 ReLU 分支',
            '四种输入都可手算；这是表达能力示范，不是训练成功记录。',
          ],
        ],
      ),
      p(
        '运行入口：course_examples/week03_neuron.py；XOR 独立实验在 course_examples/week03_xor.py。完成后应能解释参数量、隐藏层激活和输出层选择；还不要求凭空推导所有梯度。Week 4 专门解决“每个参数对最终错误贡献了多少”。',
      ),
    ],
  },
  {
    sectionId: 'o0140-45',
    title: '45. 把一层写成公式：所有符号都对应刚才的循环',
    rationale: '统一旧子标题中的矩阵方向；一次完整替换碎片，保留其锚点为别名。',
    collapseChildren: true,
    body: [
      f(
        String.raw`Z=XW+b,\qquad A=f(Z)`,
        '先加权求和得到 Z，再按任务应用激活得到 A。',
      ),
      table(
        ['符号', 'shape', '代码中做什么'],
        [
          ['X', '[B,in]', 'B 个样本，每行是有固定顺序的输入。'],
          ['W', '[in,out]', '第 j 列给第 j 个输出分配各输入权重。'],
          ['b', '[out]', '每个输出一个偏置，沿 batch 复用。'],
          ['Z、A', '[B,out]', 'Z 是激活前结果，A 是应用函数后的结果。'],
        ],
      ),
      p(
        '矩阵公式统一一行一个样本。PyTorch Linear 的内部 weight 存储为 [out,in]，因此 X @ layer.weight.T + layer.bias 才与这里的公式对应；转置只是在两种存储排列之间翻译，不是另一种学习算法。',
      ),
      p(
        '带偏置的乘加在数学上叫仿射变换；线性变换是偏置为零的特例。框架通常统称 Linear。隐藏层可以用 ReLU；数值回归的输出层可以直接返回 Z。f 在这里不是强制每一层都用同一个激活。',
      ),
    ],
  },
  {
    sectionId: 'o0161-53-week-2-gpt',
    title: '53. 从回归到 GPT：哪里保留，哪里改变？',
    rationale: '替换碎片 ASCII 地图和旧 Wx 约定。',
    body: [
      table(
        ['阶段', '仍然保留', '新增的难题'],
        [
          [
            '线性回归',
            '输入、参数、预测、损失、更新',
            '一个乘加规则只能表达有限关系。',
          ],
          ['神经网络', '损失指导参数更新', '隐藏层和非线性提供更灵活的表示。'],
          [
            '语言模型',
            '同样的反向传播和更新',
            '输出不是一个连续数，而是对词表候选打分。',
          ],
          [
            'GPT',
            '许多 XW+b 及可微运算组成模型',
            'Attention 允许当前位置读取左侧上下文。',
          ],
        ],
      ),
      p(
        '本周只要求你解释前两行。语言模型不是与回归完全无关的新世界：预测函数变大、输入输出改变，训练仍在追踪“参数变化怎样影响损失”。后续每周只替换或增加一个部件。',
      ),
    ],
  },
  {
    sectionId: 'o0162-54-week-3-7',
    title: '54. 合上教材，复述这七个关系',
    rationale: '同步修正过度绝对化的线性总结。',
    body: [
      list(
        '一个神经元先算加权和与偏置；多个神经元可以接收同一个输入。',
        '一层的行样本公式是 Z=XW+b，激活后的表示是 A=f(Z)。',
        '连续仿射层仍可合并成仿射层，单靠堆叠不能表达 XOR；不是说改变参数化在任何意义上都没用。',
        '非线性让输入不同区域经过不同响应规则；ReLU 是 max(0,z)。',
        '隐藏单元的人为语义标签只是类比，不能保证训练后某维就代表那个含义。',
        '输出层由任务决定：回归可输出负数；分类分数和损失在 Week 6 讲。',
        'forward 只算结果；梯度和 optimizer 更新才组成学习步骤。参数更多不保证更好泛化。',
      ),
    ],
  },
  {
    sectionId: 'o0167-56',
    title: '56. 独立练习：先预测，再展开答案',
    rationale: '给定条件和题干放在答案之外；不把跟读演算当成独立练习。',
    body: [
      p(
        'EX03-A：输入 x=[2,3]，权重 w=[0.5,−0.2]，偏置 b=0.1。先算 z，再算 a=ReLU(z)。EX03-B：只把第二个权重改为 −1，再算两项。EX03-C：若这是允许负预测的回归输出层，第二次应该返回 z 还是 ReLU(z)？',
      ),
      code(
        'def neuron(x, w, b, activation):\n    z = sum(v * weight for v, weight in zip(x, w)) + b\n    # 练习片段：补上如何按 activation 返回结果。\n    # activation=None 表示线性输出；"relu" 表示截断负值。',
      ),
      p(
        '回忆题 EX03-D：3 个输入进入 4 个带偏置的神经元，一共有多少个参数？输入的 3 个数是否也计入模型参数量？',
      ),
    ],
    check: {
      prompt: '写下 A–D 的结果与理由后，再看参考答案。',
      answer: [
        p(
          'A：z=2×0.5+3×(−0.2)+0.1=0.5，a=0.5。B：z=1−3+0.1=−1.9，a=0。C：回归输出要保留 z=−1.9；否则永远不能预测负目标。D：(3+1)×4=16，输入不是模型参数。',
        ),
        code(
          'def neuron(x, w, b, activation=None):\n    if len(x) != len(w):\n        raise ValueError("input and weight lengths must match")\n    z = sum(v * weight for v, weight in zip(x, w)) + b\n    if activation is None:\n        return z\n    if activation == "relu":\n        return max(0.0, z)\n    raise ValueError("unknown activation")',
        ),
        p(
          '常见错因：漏掉偏置、把参数量乘以 batch 大小、在所有输出上强制 ReLU。分别回顾本周偏置、参数量和输出层小节。',
        ),
      ],
    },
  },
  {
    sectionId: 'o0179-week-4-backpropagation',
    rationale: '给已有完整手算建立一条明确依赖链及共同旧状态。',
    body: [
      p(
        'Week 3 已经能算一个网络的预测；本周的问题是：最终 Loss 只有一个数，怎样分别知道每个参数该往哪边调？不靠每个参数轮流试很多次，而是复用 forward 的中间结果计算局部影响。',
      ),
      table(
        ['分次安排', '本次产物'],
        [
          [
            '一：保存依赖',
            '固定 x=2、y=5、w1=w2=1、b1=b2=0；算出 z=h=prediction=2、Loss=9。',
          ],
          [
            '二：逐条反传',
            '得到 dw2=−12、db2=−6，再向前传得 dw1=−12、db1=−6。',
          ],
          [
            '三：分支与更新',
            '解释梯度沿路径相乘、在汇合处相加；一起更新后再预测。',
          ],
          [
            '四：独立核对',
            '运行 course_examples/week04_gradient_check.py；补做提前更新的错误对照。',
          ],
        ],
      ),
      p(
        '前置：Week 2 的局部变化率和 Week 3 的 ReLU。本周只使用一个隐藏神经元，减少算术负担；这不是上一周两隐藏单元的参数被悄悄改变，而是同一算法的更小演示。',
      ),
    ],
  },
  {
    sectionId: 'o0191-11-parameters',
    title: '11. 全部梯度算完，才一起更新参数',
    rationale: '用提前更新反例说明 backward 与 optimizer 分工。',
    body: [
      p(
        '到这里我们还没有改动任何参数。所有梯度都描述同一次旧 forward 的 Loss。学习率设为 0.01，现在才执行“旧参数减去学习率乘梯度”。',
      ),
      table(
        ['参数', '旧值', '本次梯度', '更新后'],
        [
          ['w1', '1', '−12', '1.12'],
          ['b1', '0', '−6', '0.06'],
          ['w2', '1', '−12', '1.12'],
          ['b2', '0', '−6', '0.06'],
        ],
      ),
      p(
        '为什么不能算完 dw2 就先更新 w2？旧 forward 中 dL/dprediction=−6，向隐藏值传递时应乘旧 w2=1，所以 dL/dh=−6。若偷用新 w2=1.12，会得到 −6.72，再乘输入 2 得到错误 dw1=−13.44；正确是 −12。你混合了两个时刻的计算。',
      ),
      f(
        String.raw`\theta_{\mathrm{new}}=\theta_{\mathrm{old}}-\alpha\nabla L(\theta_{\mathrm{old}})`,
        '用同一旧参数处的梯度，一起得到新参数。',
      ),
      p(
        'θ 只是四个参数的统称；∇L 表示这四个对应梯度。backward 负责计算它们，optimizer 负责按选定规则改变参数。它们不是同一动作。',
      ),
      p(
        '下一节重新 forward：z=1.12×2+0.06=2.30，h=2.30，prediction=1.12×2.30+0.06=2.636，Loss=(2.636−5)²=5.588496。Loss=9 的旧变量不会自己刷新，必须重算。',
      ),
    ],
    check: {
      prompt:
        'EX04：如果某次隐藏 z<0，ReLU 让这一条隐藏路径梯度为 0，能否断言输出偏置 b2 的梯度也为 0？',
      answer: [
        p(
          '不能。b2 直接进入 prediction，dL/db2=2(prediction−y)，不经过隐藏 ReLU。只有穿过这条关闭的 ReLU 路径的贡献为 0；回顾计算图的实际依赖。',
        ),
      ],
    },
  },
  {
    sectionId: 'o0201-week-5-tensor-pytorch',
    rationale: '用已有手算对照框架，而不是重新从 API 名词开始。',
    body: [
      p(
        '本周不换数据、不换损失、不换学习率，只把已经会的计算交给 PyTorch。共同基线是 Week 2 四样本：x=[1,2,3,4]、y=[3,5,7,9]、w=b=0、mean MSE、learning_rate=0.01。',
      ),
      p(
        '先记住可核对的一步：Loss=41，dw=−35、db=−12；更新后 w=0.35、b=0.12，再 forward 的 Loss=28.45315。框架如果给出别的数，先检查初值、shape、平均方式与数据，而不是认为自动求导使用另一种数学。',
      ),
      table(
        ['分次安排', '把什么交给 PyTorch'],
        [
          [
            '一：Tensor 与接口',
            '明确各轴、dtype、device；区分逐元素乘法与矩阵乘法。',
          ],
          [
            '二：Autograd',
            '对照手算，看 requires_grad、graph、.grad 各保存什么。',
          ],
          ['三：完整一步', '清梯度、forward、backward、step；用状态表核对。'],
          [
            '四：Module 与诊断',
            '运行 course_examples/week05_three_ways.py，制造并解释一次错误广播。',
          ],
        ],
      ),
      p(
        'CPU 足够。安装方式见下载包 README。完成后你应能指出哪一行改变参数，并解释为什么 eval() 和 no_grad() 不是同一个开关。下一周输入变成 token ID，但这套训练步骤不变。',
      ),
    ],
  },
  {
    sectionId: 'o0216-14-pytorch-training-loop',
    title: '14. 标准训练循环：每一行究竟改变了什么',
    rationale: '以同一批数据和确定初值替换孤立 API 循环。',
    body: [
      p(
        '现在把 Tensor、自动求导、Module 和 optimizer 放回同一件事。下面程序可独立运行；Linear 默认随机初始化，所以先显式设为零，才能与 Week 2 比较。',
      ),
      code(
        'import torch\n\nX = torch.tensor([[1.0], [2.0], [3.0], [4.0]])\ny = torch.tensor([[3.0], [5.0], [7.0], [9.0]])\nmodel = torch.nn.Linear(1, 1)\nwith torch.no_grad():\n    model.weight.zero_()\n    model.bias.zero_()\noptimizer = torch.optim.SGD(model.parameters(), lr=0.01)\n\noptimizer.zero_grad(set_to_none=True)\nprediction = model(X)\nif prediction.shape != y.shape:\n    raise ValueError("prediction and target must describe the same pairs")\nloss = torch.nn.functional.mse_loss(prediction, y, reduction="mean")\nloss.backward()\nprint("before step", loss.item(), model.weight.grad, model.bias.grad)\noptimizer.step()\nwith torch.no_grad():\n    new_loss = torch.nn.functional.mse_loss(model(X), y)\nprint("after step", model.weight.item(), model.bias.item(), new_loss.item())',
      ),
      table(
        ['时刻', 'w / b', 'loss', 'grad(w) / grad(b)'],
        [
          ['清梯度后', '0 / 0', '本轮还未计算', 'None / None'],
          ['forward 后', '0 / 0', '41', 'None / None'],
          ['backward 后', '0 / 0', '旧 forward 的 41', '−35 / −12'],
          ['step 后', '0.35 / 0.12', '旧变量仍是 41', '仍保留 −35 / −12'],
          [
            '重新 forward',
            '0.35 / 0.12',
            'new_loss≈28.45315',
            'no_grad 不会清除原有梯度',
          ],
        ],
      ),
      p(
        '表中近似值来自同一固定输入的数学计算。实际浮点打印会有尾数差异。把这些步骤放进循环后，每轮第一步清除旧梯度，避免上一轮贡献混入。zero_grad 不会把学到的参数清零；optimizer.step 也不会自动把 grad 清零。',
      ),
      p(
        '能运行不代表配对正确：prediction 的 shape 是 [4,1]，若把 y 写成 [4]，广播可能把它们扩成 [4,4]，得到样本之间的两两比较。原本只该比较四对数据，却算了十六对。保留显式 shape 检查，比只盯着 scalar loss 更可靠。',
      ),
      p(
        '下一周预测会变成 [B,T,Vocab]，目标是 [B,T]，这是分类接口有意规定的不同 shape，不沿用回归的“完全相等”检查。每种检查都要先说明轴的含义和损失函数的输入约定。',
      ),
    ],
    check: {
      prompt:
        'EX05：先预测三种改动的后果：A 删除 step；B 第二轮不清 grad；C 只调用 eval，正常计算 loss.backward。哪些参数或梯度会改变？',
      answer: [
        p(
          'A：会算出梯度，但参数没有更新。B：新的梯度贡献叠加到旧 grad，除非你有意设计累积，否则不是期望的一步。C：eval 只影响 Dropout/BatchNorm 等层的行为，不关闭自动求导，backward 仍可计算梯度；参数仍要等 step 才改变。回顾本节状态表和 train/eval 小节。',
        ),
      ],
    },
  },
];
