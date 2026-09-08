# 十二周课程：连贯性修订记录

基线：`0a7d797`；标签：`pre-course-clarity-revision-2026-09-08`。
修改范围：当前 V1 / main 网站及配套课程文件；不包含 AstroCourse，不推送远端。

## 执行顺序

1. Week 1–5：把已有补充放到首次需要的位置，修正公式/总结，补连续数值实验与独立练习。
2. Week 6–9：统一训练题与词表，修正相同上下文概率表；连接表示、Attention 与 Transformer；分开必修数据入口与 tokenizer 比较实验。
3. Week 10–12：突出模型/训练主干，工程实现细节移到选读；提供独立文档划分、训练和验证记录的完整小项目。
4. 同步中文词汇表、阅读路线、示例下载；运行内容校验与网站构建。

## 保留原则

- 保留已有的有效详细推导和所有旧章节链接；改变阅读顺序时保留稳定 ID。
- 原始导入内容保留在 course.generated.json。基础章节的正文替换通过既有 beginner 编辑入口完成，不在旧正文后继续叠加相互矛盾的解释。
- 预期数值与真实运行记录分开。用户要求不新增、不运行测试；构建及内容结构检查不等于训练验证。

## 逐周实际修改

| 周次 | 修改内容 | 读者现在能顺着完成的任务 |
|---|---|---|
| Week 1 | 补同一组 X/W/b 的循环与矩阵例子；分清输入、参数、特征顺序、batch 和轴。 | 手算两个样本、两个输出，解释交换特征后为什么 shape 没变而结果变了。 |
| Week 2 | 重写 MSE 与导数入口；先微调参数再引入变化率，明确 mean reduction；补三个学习率的真实纯 Python 日志。 | 从 L(1)=9、L(1.001)=8.988004 走到单样本与四样本更新，观察过大步长发散。 |
| Week 3 | 原 58 个主节重组为四个学习单元；ReLU 放在 XOR 前；统一行样本矩阵约定，合并碎片公式，补完整题干与折叠答案。 | 算完两层网络、参数数目和负值输出，区别给定参数的 XOR 演示与训练。 |
| Week 4 | 补旧参数、梯度、新参数、重新 forward 的完整表格；说明不能中途用已更新参数算旧图的梯度。 | 从 loss=9 算到更新后 prediction=2.636、loss=5.588496，区分 backward 与 update。 |
| Week 5 | 补确定初值的独立 PyTorch 一步示例与状态表，解释 target shape 的广播风险及分类目标的不同约定。 | 将相同的四样本手算对应到 Tensor、梯度和 optimizer，不把“能运行”当作语义正确。 |
| Week 6 | 数据/目标先于表示与概率；保留 logits、Softmax、CE 的细算；增加 h 的可见前缀均值例子；将重复路线改为串联练习。 | 用同一五词表构造六题，再计算表示、评分、概率、loss 和 Bigram 更新。 |
| Week 7 | 保留同一组 Q/K/V，新增小输出头和 CE 的具体数字，追踪一个 query 参数的梯度；修复示例打印中的换行语法。 | 明确 Attention 输出如何影响最终词表 loss，以及 Q/K 和 Value 的不同梯度路径。 |
| Week 8 | 用 Week 7 的数据建立 Pre-Norm 桥接实验；增加只改一个 FFN 权重、缩放输入后 LayerNorm 的对照；修复代码打印格式。 | 区分 Attention、FFN、残差、归一化的职责，而非只记组件名单。 |
| Week 9 | 五词主线数据入口前置；特殊 token/Unicode/BPE 比较标为独立实验；补两轮 BPE 频次与并列规则。 | 继续沿用同一 ID 协议，理解 T+1、未知输入、文档边界和 tokenizer/checkpoint 配套。 |
| Week 10 | 增加 embedding→单头→多头→block→完整模型阶段入口；增加具体元素的拆头轴追踪；共享权重和复杂恢复后置。 | 看到每阶段新增什么代码，追踪一个元素的位置及参数注册。 |
| Week 11 | 补给定两次梯度的 AdamW 中间值，新增不含梯度累积/复杂恢复的最小训练循环；工程选读后置。 | 先看清训练主干，再理解 m/v、偏差修正、衰减及额外状态。 |
| Week 12 | 项目 A 复用共同数据入口；补项目 B 的独立文档训练/验证、真实日志与图、保存加载；项目 C 明确一次只改一项。 | 分开“流程跑通”“学会固定题”“独立评估”，提交实际观察而非假定训练成功。 |

共用修改：45 个中文术语条目；每周前置知识、分次路线与运行入口；同步网页导出的代码、实验 README 与 LEARNING_ROUTE；内容版本更新为 `2026-09-08-clear-learning-path-v21`。沿用项目已有的内容换版存储重置机制，重要笔记应先导出。

### 关键勘误与边界

- Week 6 两行同样只看见“我”时，固定模型的输出分布必须相同；正确答案不同只改变所取的概率与损失。现使用同一 logits `[0,2,1,-1,0]`：喜欢的概率约 0.592299、loss 0.523744；学习的概率约 0.029489、loss 3.523744。
- h 的前缀平均是独立的临时表示演示，不冒充 Bigram 或完整 GPT；其输出不包含未来目标。
- 数值 Attention 的小输出头用于说明梯度来源，不声称已经训练了完整 GPT。
- Week 7/8/10 的固定手算、桥接模型、完整模型分别注明参数与用途；随机阶段结果不用于性能排名。
- 五词流程语料与 30 字符独立文档任务使用同一 MiniGPT 类，但配置与 tokenizer 不同，checkpoint 不互换。
- 新文档项目只承诺保存加载推理，不将其称为精确恢复训练。
- 收尾检查发现旧 beginner 编辑层会覆盖 Week 12 runner 的共享数据改动；已同时修正覆盖层，保留旧版有效的参数变化与实际输出记录。重新导出后，网页、Python 文件和 ZIP 均引用共同数据入口。

## 实际验证记录（2026-09-08）

环境：Windows；标准 Python 实验使用 Python 3.12.10。另有 Python 3.14.7；两者均未安装 PyTorch。未安装新 Python 依赖，保留已有依赖版本约定，并明确该版本本轮未复验。

| 检查 / 实际命令 | 实际结果 | 范围与限制 |
|---|---|---|
| `pnpm build` | 通过；原内容校验 461 节、0 unresolved warnings；curated 校验 7 周、2,286 块；生产构建完成。 | 构建仍提示部分客户端包超过 500 kB，不影响构建完成；本轮未做打包性能优化。 |
| `pnpm exec tsc --noEmit` | 通过，退出码 0。 | TypeScript 静态类型检查，不代表浏览器行为全部实测。 |
| `pnpm exec oxlint`，限定本次修改的 TypeScript 内容文件及导出脚本 | 通过，退出码 0。 | 最后一轮修复了 Week 12 CLI 字符串的无用转义。 |
| `py -3.12 -m compileall -q course_examples` | 通过，退出码 0。 | 语法编译不导入 PyTorch、不运行训练。 |
| 对最终 runtime 内容调用 KaTeX 与 Lezer Python parser | 493 个公式渲染、139 个 Python 代码块解析，错误均为 0。 | 检查排版语法与代码语法，不以此替代数值、语义或训练验证。 |
| 对原 `course.generated.json` 的全部章节 ID 调用当前 `findSection` | 461 个旧 ID 均可定位，缺失 0。 | Week 3 合并的碎片以 alias 保留，原文数据文件未覆盖。 |
| `py -3.12 course_examples/week01_linear_layer.py` | F01 两行输出约 `[1.4,1.1]`、`[3.2,2.1]`；交换输入后约 `[1.5,0]`。 | 标准 Python 实算，浮点微差保留。 |
| `py -3.12 course_examples/week02_loss_gradient.py` | 一步 mean MSE：41→28.45315，dw=-35、db=-12；lr=0.01 的 1,000 步后 w=2.0048610157、b=0.9857080211。 | 同一玩具直线的梯度下降，不是 PyTorch 训练。lr=0.2 在第 415 次更新后的检查发现 non-finite 并停止，没有隐藏发散。 |
| `py -3.12 course_examples/week03_xor.py` | ReLU 输出 0/1/1/0；去掉 ReLU 输出 2/1/1/0。 | 给定参数的表达能力演示，不是训练成功证明。 |
| `py -3.12 course_examples/week09_data_protocol.py` | 六个位置的 x/y 正确移位；未知“狗”和不足 T+1 的片段明确报错。 | 初次执行发现 Windows 控制台编码错误，加入显式 UTF-8 设置后重跑成功。 |
| `py -3.12 course_examples/week11_adamw_numbers.py` | 给定 g=2、4 的两步参数约 0.98900000005、0.978359179822。 | 普通 Python 算术，梯度是题设，不是网络实测梯度。 |
| 对 `data/documents` 进行只读字符/划分/重叠核对 | 8 篇训练、3 篇验证；30 字符词表；非法字符 0；完整验证文档包含 0；48 字符规范化重叠 0；stride=24 时 80/34 个窗口。 | 有效目标 1,920/816；不能排除所有近似重复、同文风偏差或小样本不稳定。 |
| HTTP 读取 `http://127.0.0.1:8787/week/week-06` 与 `/week/week-12` | 返回 200；包含更新后的串联练习、概率更正和独立文档项目入口。 | 实际服务仍在 0.0.0.0:8787；不替代手机浏览器人工验收。 |
| `git diff --check` | 通过。 | 未改动 AstroCourse。 |

### 未运行与下一步

- 按用户要求，没有新增或运行自动化测试；未运行 Vitest、Playwright、`verify_learning.py` 或有限差分测试工具。
- 新增/改动的 PyTorch Bigram、Attention、Transformer、训练与 checkpoint 实验均未执行。环境缺少 PyTorch，因此不宣称 loss、梯度或加载行为已实测通过。
- 安装依赖后可按 `course_examples/README.md` 逐周运行，尤其是 `week06_bigram.py`、`week07_attention.py`、`week08_bridge.py`、`week10_stages.py`、`week11_minimal_loop.py` 和 `week12_generalization.py`。新项目的 CSV、SVG、样例与 checkpoint 仅在真实执行后生成，本次不附模拟日志。
- 本次没有生成新 PDF，没有发布 Azure，没有 push。修改后网站已由现有本地开发服务提供；手机布局仍需用户试读。

## 交付状态

实施前 checkpoint commit/tag 已完成。12 周网页内容、配套实验、词汇表与路线文档已更新；以上静态/数值检查和网站构建完成。PyTorch 运行验证仍受依赖缺失限制。正文修改暂未另建提交，便于审阅。

下载包 `public/downloads/course-examples.zip` 已重新生成并检查：共 37 个文件，包含 README、完整实验入口及 11 篇数据文档；保留 `course_examples/` 目录层级，不包含 node_modules、虚拟环境、缓存、runs、checkpoint 或 AstroCourse。大小 45,560 字节，SHA-256：`c6ae9939431b7feb3daadc5696b48c1fda585057bed3634e1f5de80f0eb3ca71`。打包使用 .NET ZipArchive 从明确筛选的课程源文件生成，不包含未执行实验的虚构产物。
