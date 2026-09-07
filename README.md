# AI First Principles · AI 第一性原理

面向有编程经验、希望补齐数学基础的学习者的 12 周 AI 课程网站。从加权求和与梯度下降开始，通过中文讲解、具体数值和 Python 例子理解神经网络、语言模型、Attention，最终完成教学版 Mini GPT 的训练与生成。

正文、公式、表格和代码直接在网页中阅读，支持手机与桌面。`main` 收录当前 V1 课程，`feature/v1-course` 保留其开发分支。

## 快速启动

需要 Node.js **22.13.0 或以上**和项目指定的 **pnpm 11.19.0**。Python 仅用于配套实验，启动网站不需要 Python 或 GPU。

```sh
git clone --branch main https://github.com/github4me/ai-learning.git
cd ai-learning
pnpm install --frozen-lockfile
pnpm dev --host 0.0.0.0 --port 8787
```

电脑访问 [http://localhost:8787](http://localhost:8787)。以启动终端实际显示的端口为准；端口被占用时，停止占用它的课程服务或选择其它端口。

手机与电脑连接同一局域网后，访问 `http://<电脑的局域网 IPv4>:8787`。Windows 使用 `ipconfig` 查找当前网络适配器的 IPv4。手机上的 `localhost` 指向手机自身，需要换成电脑 IP。

无法连接时，检查服务是否绑定 `0.0.0.0`、防火墙是否允许 TCP 8787 入站，以及 Wi-Fi 是否启用客户端隔离。开发服务器用于可信本地网络。

## 课程路线

| 周次 | 核心内容 |
| --- | --- |
| 1 | 向量、矩阵、shape、点积与 bias |
| 2 | Linear Regression、Loss、梯度与参数更新 |
| 3 | Neuron、非线性、ReLU 与多层网络 |
| 4 | Chain Rule、Backpropagation 与梯度传播 |
| 5 | Tensor、PyTorch、Autograd 与训练循环 |
| 6 | Token、Embedding、Logits、Softmax、Cross Entropy、Bigram |
| 7 | Q/K/V、Attention、causal mask 与多头计算 |
| 8 | Position、Residual、LayerNorm、FFN 与 Transformer |
| 9 | Tokenizer、数据窗口、输入协议与目标对齐 |
| 10 | 组装 GPT、追踪张量形状与模型参数 |
| 11 | 训练、评估、保存加载、采样与生成 |
| 12 | Mini GPT 项目整合、实验与结果解释 |

建议每周约 7–10 小时，将阅读、手算与实验交替进行。参阅 [学习路线](course_examples/LEARNING_ROUTE.md) 和 [实验说明](course_examples/README.md)。教学语料很小，训练 Loss 下降不能单独证明泛化或语言质量。

## 阅读功能

- 可折叠课程目录、稳定的小节链接、中英文全文搜索。
- 数学公式、代码块、表格、例题与自我检查。
- 学习进度、书签、分节笔记和复习页。
- 深色/浅色主题及阅读设置；`Ctrl+K` / `Cmd+K` 打开搜索。

| 地址 | 页面 |
| --- | --- |
| `/` | 课程总览与继续学习 |
| `/week/week-06` | 第 6 周；其它周使用 `week-01` 至 `week-12` |
| `/appendix/mini-gpt` | 历史 Mini GPT 附录 |
| `/review` | 笔记与书签复习 |
| `/downloads/course-examples.zip` | Python 示例下载 |

## 学习数据与备份

学习状态保存在当前浏览器的 `localStorage` 中，没有账号、云同步或学习数据服务端数据库。不同浏览器、设备、IP 或端口不会自动共享进度。

阅读设置提供 JSON 备份导出与导入。清理浏览器数据、使用隐私模式或更新课程内容版本可能导致状态重置，重要笔记请先备份。`src/content/content-version.ts` 控制课程版本，当前实现会重置与新版本不匹配的学习状态。

## Python 实验

Week 3、4 基础例子只需 Python；其它实验按 [配套说明](course_examples/README.md) 安装兼容的 PyTorch。网站本身不在浏览器里运行 Python。

```sh
cd course_examples
python week03_neuron.py
python week04_gradient_check.py
# 安装 PyTorch 后：
python week06_probability.py
```

下载示例与历史附录可能使用不同的 tokenizer、模型配置和 checkpoint，运行时应遵循各自说明。

## 技术与目录

React 19、TypeScript、Vinext/Vite、Tailwind CSS、KaTeX、MiniSearch 和 Zustand 构成网站主体；构建预览使用 Cloudflare Workers 工具链。Vite 读取 `.openai/hosting.json`，当前 D1/R2 绑定为空，本地阅读不要求数据库或云账号。

```text
app/                      页面与路由
src/
  components/             阅读界面与交互组件
  content/
    course.generated.json 原始转换底稿
    curated/              各周扩展与修订正文
    beginner/             初学者补充与内容覆盖逻辑
    course-runtime.ts     最终显示内容的组合入口
    content-version.ts    内容版本
  learning/               学习状态与备份逻辑
course_examples/           Python 示例与学习说明
public/downloads/          下载文件
scripts/                   内容转换、校验与示例导出工具
```

## 维护课程

课程最初由 PDF 转换而来，网页正文已经持续扩展与修订。维护时以当前网站内容为准，历史 PDF 和转换底稿用于追溯来源。

`course-runtime.ts` 依次应用生成底稿、curated 修订、代码块修正与 beginner 补充。编辑前检查对应周文件及覆盖规则，避免只改底稿而未改变显示内容。保留已有 section ID，可维持外部链接。

```sh
pnpm export:examples
```

此命令从最终课程重新导出 Week 9–12 的部分 Python 模块，不会自动生成 ZIP。修改实验后需重新打包 `public/downloads/course-examples.zip`，排除虚拟环境、缓存和临时 checkpoint。

## 构建与检查

```sh
pnpm build
pnpm start
```

`build` 先校验内容，再生成构建产物；`start` 使用 `dist/server/wrangler.json` 启动本地 Workers 预览，地址由终端显示。

| 命令 | 用途 |
| --- | --- |
| `pnpm validate:content` | 原始转换内容与来源完整性校验 |
| `pnpm validate:curated` | 修订内容校验 |
| `pnpm lint` | 静态代码检查 |
| `pnpm exec tsc --noEmit` | TypeScript 类型检查 |
| `pnpm test` | 已有单元/组件测试 |
| `pnpm test:e2e` | 已有浏览器端测试 |

这些是仓库提供的检查入口，不代表每次文案更新均执行过全部检查。`pnpm normalize:content` 属于历史转换维护操作；正常编辑课程不需要重跑 PDF 提取流程。

推送到 GitHub 不会自动发布网站。当前课程通过本地启动命令运行，公网发布需要另外配置托管。
