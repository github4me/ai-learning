# AI First Principles：十二周配套实验

先看 LEARNING_ROUTE.md，然后按每周的一条明确命令运行；不要把网页里的所有函数片段直接拼接成脚本。模型用于学习机制，不是聊天产品。

## 安装与运行位置

以下命令在解压后的 course_examples 目录执行。Week 1、2、3、9 数据协议和 Week 11 AdamW 数值镜头只需标准 Python；框架、Attention 和 GPT 实验需要 PyTorch。建议使用 Python 3.12 环境。

Windows PowerShell：

~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
~~~

若激活被本机策略阻止，不必修改全局策略，直接使用 .\.venv\Scripts\python.exe 替代后面的 python。

macOS / Linux：

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
~~~

已有其他设备的 PyTorch 环境时，按 [官方安装说明](https://pytorch.org/get-started/locally/) 选择安装方式；不要求 GPU。依赖文件保留课程已有版本约定，可用性以安装和实际运行结果为准。

## 每周入口

下表是运行目标，不是对所有程序已经实测通过的声明。

| 命令 | 观察目标 |
|---|---|
| python week01_linear_layer.py | 同一 X/W/b 算出两行输出；交换特征后约 [1.5,0]。 |
| python week02_loss_gradient.py | L(1)、L(1.001)、四样本一步更新、三个学习率；发散明确报告。 |
| python week03_neuron.py | 两隐藏单元、线性输出、负值反例。 |
| python week03_xor.py | ReLU 表达 XOR；去掉它变成 2−x1−x2，不是训练日志。 |
| python week04_gradient_check.py | 已有手算/有限差分学习工具；理解梯度的局部意义。 |
| python week05_three_ways.py | Python、Tensor、Module 使用相同初值与 mean MSE。 |
| python week06_probability.py | 已有 logits/CE 数值例子与梯度。 |
| python week06_bigram.py | 六道题、全零评分表、一步与重复更新，再生成。 |
| python week07_attention.py | 同一组 Q/K/V 接到词表 CE，再只改一个 query 参数。 |
| python week08_bridge.py | 复用 Week 7 输入，观察归一化、分支、残差；改变一个 FFN 权重。 |
| python week09_data_protocol.py | 五词编号不变，未知词和 T+1 边界有明确提示。 |
| python week10_stages.py --stage embedding | 依次换成 single、multi、block、full，看新增计算。 |
| python mini_gpt_walkthrough.py | 默认完整模型：V=5、C=4、H=2、2 层、不共享权重、520 参数。 |
| python week11_adamw_numbers.py | 给定两次梯度，逐项算 m/v、偏差修正和新参数。 |
| python week11_minimal_loop.py | 不带梯度累积和复杂恢复的最小训练主干。 |
| python week12_end_to_end.py | 项目 A：固定三句，训练、保存、加载、生成。 |
| python week12_generalization.py --steps 200 --output runs/first | 项目 B：独立文档、实际 CSV/SVG、加载推理与实验记录。 |

新入口显式使用 UTF-8 输出。旧工具如遇 Windows 中文控制台编码错误，可使用 python -X utf8 文件名.py，不需要改文件内容。

## 同一份数据继续使用

course_data.py 维护五词主线：我=0、喜欢=1、AI=2、学习=3、猫=4，按空格切分。三句原文形成输入 [[0,1],[4,1],[0,3]]，目标 [[1,2],[1,0],[3,2]]。从 Bigram 换成 MiniGPT 不改目标。

w09_readable_v1.py 是特殊 token 的独立比较，不接替主线词表。原附录的字符模型也是另一历史实现，checkpoint 不互换。

Week 7 为手算指定简单输入和投影；Week 8 bridge 直接复用它们，完整两头手算另有明确参数。随机阶段示例不用于给架构性能排名。

## 最终项目：机制演示与独立文档分开

项目 A 会在当前目录写入/覆盖 mini-gpt-training.pt；保留旧演示请先另存。固定三句的学习不能证明泛化。

项目 B 使用 data/documents 的原创 8 篇训练文档、3 篇验证文档。字符表独立规定；按文档划分后才切窗。仍使用同一 MiniGPT 类，显式新建字符任务配置：V=30、T=24、C=32、H=4、2 层。

~~~sh
python week12_generalization.py --steps 200 --eval-every 20 --seed 7 --output runs/first
python week12_generalization.py --generate-only runs/first/inference.pt --prompt "a " --new-tokens 80
~~~

运行后才生成 config.json、data_report.json、loss.csv、loss.svg、samples.json、inference.pt、experiment_record.md。输出目录必须不存在，重复实验请换名字。没有随包伪造的“训练成功”曲线。

两条曲线都用 eval/no_grad，按全部固定窗口的有效目标数平均。训练抽样使用独立 RNG，不因评估频率改变而改变。有限重复审查包含完整文档和 48 字符片段，不证明不存在全部近似重复。

字符实验文件用于推理加载，不承诺精确续训，也不交给旧五词实验恢复器。只加载自己创建或可信来源的 checkpoint。

项目 C 先写预期，再只改一项，例如：

~~~sh
python week12_generalization.py --steps 200 --eval-every 20 --seed 7 --learning-rate 0.001 --output runs/lower-lr
~~~

## 本轮验证范围（2026-09-08）

已进行 Python 语法编译、标准 Python 数值实验、网站公式/代码语法及内容结构检查。检查机 Python 3.12/3.14 均未安装 PyTorch；新增 PyTorch 实验与训练未运行，不宣称结果通过。详见网站仓库 docs/COURSE_CLARITY_REVISION.md。

旧版曾记录五词、seed=7、CPU、100 次更新的同一 batch loss 约 1.582396→1.198047。这是历史观察，不是本轮重跑，也不是新独立文档项目结果。原 verify_learning.py 维护工具保留，本轮未运行测试。

## 维护同步

网站仓库根运行 pnpm export:examples，从最终显示内容导出 Week 9–12 定义及最小训练循环；其余文件是独立实验。打包 public/downloads/course-examples.zip 时保留 README 与 data，排除虚拟环境、缓存、runs 和 checkpoint。

