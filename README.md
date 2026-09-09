# AI Made Simple · 轻松学 AI

[English README](README_EN.md) · 中文说明

本版本提供完整中英文课程：原中文地址不变，英文入口为 `/en`。顶部的 **中文 / English** 可切换到对应章节，进度、书签和笔记共用，不因切换语言而重置。英文部署到线上需要发布本次修改；仅有本地英文版本不代表线上已更新。

面向有编程经验、希望补齐数学基础的学习者的 12 周 AI 课程网站。从加权求和与梯度下降开始，通过中文讲解、具体数值和 Python 例子理解神经网络、语言模型、Attention，最终完成教学版 Mini GPT 的训练与生成。

正文、公式、表格和代码直接在网页中阅读，支持手机与桌面。从基础概念到 Mini GPT，用一步一步的解释理解 AI 如何工作。

## 在线学习 / Live course

[打开公开课程网站 / Open the course](https://ai-learning-geadc0g3f5c9h3ek.australiasoutheast-01.azurewebsites.net/)

无需安装，使用手机或电脑浏览器即可阅读，也可以直接分享以上链接。学习进度和笔记保存在各自浏览器中，不会随链接分享。

## 快速启动

需要 Node.js **22.13.0 或以上**和项目指定的 **pnpm 11.19.0**。Python 仅用于配套实验，启动网站不需要 Python 或 GPU。

```sh
git clone --branch main https://github.com/github4me/ai-learning.git
cd ai-learning
pnpm install --frozen-lockfile
pnpm dev --hostname 0.0.0.0 --port 8787
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
| `/appendix/mini-gpt` | Mini GPT 附录 |
| `/review` | 笔记与书签复习 |
| `/downloads/course-examples.zip` | Python 示例下载 |

## 学习数据与备份

学习状态保存在当前浏览器的 `localStorage` 中，没有账号、云同步或学习数据服务端数据库。不同浏览器、设备、IP 或端口不会自动共享进度。

阅读设置提供 JSON 备份导出与导入。清理浏览器数据、使用隐私模式或更新课程内容版本可能导致状态重置，重要笔记请先备份。`src/content/content-version.ts` 控制课程版本，当前实现会重置与新版本不匹配的学习状态。

## Python 实验

Week 1–4 基础数值例子、Week 9 数据协议及 Week 11 AdamW 数值镜头只需 Python；框架和 GPT 实验按 [配套说明](course_examples/README.md) 安装兼容的 PyTorch。网站本身不在浏览器里运行 Python。

```sh
cd course_examples
python week03_neuron.py
python week04_gradient_check.py
# 安装 PyTorch 后：
python week06_probability.py
python week06_bigram.py
python week12_generalization.py --steps 200 --output runs/first
```

下载示例与附录可能使用不同的 tokenizer、模型配置和 checkpoint，运行时应遵循各自说明。

## 技术与目录

React 19、TypeScript、Vinext/Vite、Tailwind CSS、KaTeX、MiniSearch 和 Zustand 构成网站主体；生产环境使用 Node.js 服务，无需数据库。

```text
app/                      页面与路由
src/
  components/             阅读界面与交互组件
  content/
    course.generated.json 基础课程数据
    curated/              各周扩展与修订正文
    beginner/             初学者补充与内容覆盖逻辑
    course-runtime.ts     最终显示内容的组合入口
    content-version.ts    内容版本
  learning/               学习状态与备份逻辑
course_examples/           Python 示例与学习说明
public/downloads/          下载文件
scripts/                   内容校验与示例导出工具
```

## 维护课程

维护时以当前网站显示的完整课程为准，保持讲解、公式、数值例子与可下载代码一致。

`course-runtime.ts` 组合基础课程数据、curated 内容、代码块修正与 beginner 讲解。基础章节在 `beginner/foundation-revisions.ts`，各周导读在 `language-roadmaps.ts`，阅读顺序在 `learning-order.ts`。编辑前检查内容组合规则；保留已有 section ID 可维持外部链接。

```sh
pnpm export:examples
```

此命令从最终课程重新导出 Week 9–12 的部分 Python 模块，不会自动生成 ZIP。修改实验后需重新打包 `public/downloads/course-examples.zip`，排除虚拟环境、缓存和临时 checkpoint。

## 构建与检查

```sh
pnpm build
pnpm start
```

`build` 先校验内容，再生成 Node.js 构建产物；`start` 使用 `vinext start` 启动生产服务，默认端口 3000，也可以由环境变量 `PORT` 指定。

| 命令 | 用途 |
| --- | --- |
| `pnpm validate:content` | 基础课程数据完整性校验 |
| `pnpm validate:curated` | 修订内容校验 |
| `pnpm lint` | 静态代码检查 |
| `pnpm exec tsc --noEmit` | TypeScript 类型检查 |
| `pnpm test` | 已有单元/组件测试 |
| `pnpm test:e2e` | 已有浏览器端测试 |

这些是仓库提供的检查入口，不代表每次文案更新均执行过全部检查。

## 许可证与引用

课程正文、翻译、练习和原创图解采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh-hans)：任何人均可免费使用、分享、修改，包括商业用途；分享时须注明作者 Chao Wang、链接到本项目及许可证，并说明是否作过修改。

网站代码、脚本和课程代码示例采用 [MIT](LICENSE-MIT)，分发时保留版权和许可声明。第三方材料遵循其各自许可。完整适用范围与引用范例见 [LICENSE](LICENSE)。

## Azure 发布

已提供 `.github/workflows/azure-app-service.yml`，使用 Linux、Node 24 和 OIDC 部署到 Azure App Service。完整设置步骤见 [Azure 部署指南](docs/AZURE_DEPLOYMENT.md)。

先在 Azure 创建 Web App 并设置 GitHub 身份授权，然后添加三个 Azure ID secrets 和 `AZURE_WEBAPP_NAME` repository variable。在 GitHub Actions 手动运行首次部署；配置完成后，推送 `main` 会自动构建和发布。尚未设置应用名称时，只构建，不部署。
