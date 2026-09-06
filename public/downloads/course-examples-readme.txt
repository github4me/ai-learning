# AI First Principles：原章节配套代码

这套代码保留 course.zip 的 12 周组织，与本次修订的中文网站内容配套。先读各周“本周怎么读”，再运行对应例子。它面向学习计算过程，不是可用聊天模型或语言质量基准。

## 最小环境

Week 3、Week 4 只需要 Python。其余文件需要 PyTorch。代码使用 Python 3.10 以上语法；本次实际验证环境是 Python 3.12.13、PyTorch 2.14.0+cpu。所选 PyTorch 发行版对 Python 的要求应以官方安装页为准。

在当前目录建立独立环境：

```sh
python -m venv .venv
```

macOS / Linux 激活：

```sh
source .venv/bin/activate
```

Windows PowerShell 激活：

```powershell
.venv\Scripts\Activate.ps1
```

按 [PyTorch 官方安装页](https://pytorch.org/get-started/locally/) 选择系统和 CPU/GPU 对应命令。CPU 即可完成全部练习；不需要下载额外数据。若系统只有 python3 命令，下列 python 相应替换为 python3。

## 按课程顺序运行

| 文件 / 命令 | 对应章节 | 应观察什么 |
|---|---|---|
| `python week03_neuron.py` | Week 3 §37–39 | hidden≈[1.4,1.1]；回归输出≈1.3 和 -1.4 |
| `python week04_gradient_check.py` | Week 4 §3–14 | 中央差分接近 [-12,-6,-12,-6]；更新后 loss≈5.588496 |
| `python week05_three_ways.py` | Week 2 §17、Week 5 §6–14 | 三种实现同一步得到 w≈0.35、b=0.12；MSE 41→28.45315 |
| `python week06_probability.py` | Weeks 6–8 | CE≈0.523744；梯度 p−one-hot；LayerNorm 均值 2.5、方差 1.25 |
| `python w09_readable_v1.py` | Week 9 §8 | 固定文本 encode/decode 自检；无输出表示断言通过 |
| `python mini_gpt_walkthrough.py` | Week 10 | 520 参数；logits [2,2,5]；因果检查通过 |
| `python week12_end_to_end.py` | Week 12 §13、附录 | 100 次更新、前后概率、checkpoint 恢复一致、生成 ID 和文字 |
| `python verify_learning.py` | 复习 / 维护核对 | 数值、因果、恢复后下一步、验证聚合、采样边界通过 |

`week11_training_and_generation.py` 是提供函数的模块，直接运行不会训练。Week 12 导入它执行训练与生成。不要将所有正文演示语句堆进这两个定义模块。

## 本次运行的观察值

固定 seed=7、CPU、100 次 AdamW 更新：同一三句 batch 的 loss 约从 1.582396 降到 1.198047，保存恢复后 logits 一致。一次生成是“我 喜欢 我 喜欢 喜欢”。这不是推荐输出，也不是语言能力证据；它显示了教学模型与真实语言模型的距离。换平台、版本或随机状态，具体数值和抽样文字可能不同。

`verify_learning.py` 另开独立诊断：相同五词模型，lr=0.01，800 次更新。不要把这次结果当作上面 lr=0.001、100 次演示的同一条轨迹。

`week12_end_to_end.py` 在当前工作目录写入 `mini-gpt-training.pt`。再次运行会重新训练并覆盖该演示文件；要保留一次实验，先另存 checkpoint。验证程序使用临时目录，不覆盖这个演示文件。

## 两套 tokenizer 不互换

- Week 9：`w09-readable-v1`，V=11，有 BOS/EOS/PAD/UNK，用于展示编码和数据窗口。
- Weeks 10–12：`mini-gpt-v1`，词表 [我,喜欢,AI,学习,猫]，V=5，无特殊 token；最多看两个 token。
- 当前 MiniGPT：C=4，H=2，两层，untied，无 dropout，共 520 参数。

原上传附录的字符级 tokenizer、tied 权重、dropout 配置和 checkpoint 属于另一套实现，不是这些文件的兼容替代。

## 学习方法

先写下你预期的数或 shape，再运行；若不一致，先检查数据、初始权重、平均方式和步长是否相同。每周完成标准与回读入口见 `LEARNING_ROUTE.md`。所有修改先固定一个基线，再只改变一项条件。

公式中的“下界”是由数据可区分的上下文推导的理想参照。Bigram 约 0.462；带上下文模型约 0.231。相同 [我] 前缀对应不同答案，所以不应要求训练 loss=0；也不能把重复三句训练的下降称为 held-out 泛化。

## 维护同步

维护者在网站仓库根目录运行：

```sh
node --import tsx scripts/export-course-examples.mts
```

该命令从当前显示内容中选取完整定义，重建 Week 9–12 文件，避免正文和下载代码分叉。Week 3–6 小实验是独立的数值对照。修改后运行代码核对，再重新打包网站的 `public/downloads/course-examples.zip`。


