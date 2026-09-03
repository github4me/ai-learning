export type LineRangeCorrection = {
  candidateId: string;
  pdfPage: number;
  lineIndexes: number[];
  sourceChecksum: string;
  reviewer: string;
  status: 'reviewed';
};

export type FormulaCorrection = LineRangeCorrection & {
  latex: string;
};

export type CodeCorrection = LineRangeCorrection & {
  language: string;
  filename?: string;
};

export type TableCorrection = LineRangeCorrection & {
  caption: string;
  headers: string[];
  rows: string[][];
};

const reviewed = {
  reviewer: 'Codex rendered-source correction review',
  status: 'reviewed' as const,
};

export const HEADING_LINE_CORRECTIONS: Readonly<
  Record<number, { pdfPage: number; lineIndex: number }>
> = {
  21: { pdfPage: 16, lineIndex: 16 },
  132: { pdfPage: 59, lineIndex: 37 },
  144: { pdfPage: 63, lineIndex: 16 },
  164: { pdfPage: 69, lineIndex: 4 },
  165: { pdfPage: 69, lineIndex: 12 },
  166: { pdfPage: 69, lineIndex: 16 },
  266: { pdfPage: 107, lineIndex: 25 },
  272: { pdfPage: 109, lineIndex: 1 },
  358: { pdfPage: 132, lineIndex: 1 },
  431: { pdfPage: 156, lineIndex: 1 },
};

export const FORMULA_CORRECTIONS: FormulaCorrection[] = [
  {
    candidateId: 'formula-math-p012-g000',
    pdfPage: 12,
    lineIndexes: [21, 22, 23, 24, 25],
    sourceChecksum:
      '88f1e4723afb82f3d21da26b5f8ae79772d0b8e603e43369ecb91d3d54b796a4',
    latex: 'x = \\begin{bmatrix} 100 \\\\ 3 \\\\ 8 \\end{bmatrix}',
    ...reviewed,
  },
  {
    candidateId: 'formula-p021-l0020',
    pdfPage: 21,
    lineIndexes: [20],
    sourceChecksum:
      '1bf8d1533056e4bb9fb9d75258ea5cd3e255706b096bdc4fc7f7061d9f9a0ed9',
    latex: 'y = 2x + 1',
    ...reviewed,
  },
  {
    candidateId: 'formula-p021-l0025',
    pdfPage: 21,
    lineIndexes: [25],
    sourceChecksum:
      '2c93fcce6a4c6f2fe2c3fed46b9dd57225c3948090e8d2cf4de421ab0e4bef8a',
    latex: '\\hat{y} = wx + b',
    ...reviewed,
  },
  {
    candidateId: 'formula-p032-l0015',
    pdfPage: 32,
    lineIndexes: [15],
    sourceChecksum:
      'f80f12c09a3076d8e0a672d0f32d396e168d450f0359ce71b89b213dfa6adf99',
    latex: '\\hat{y} = wx + b',
    ...reviewed,
  },
  {
    candidateId: 'formula-p032-l0017',
    pdfPage: 32,
    lineIndexes: [17],
    sourceChecksum:
      'c5ac039befe67ef63e6408e92c37a5267e891bc3cbc2a17e85826b8c54b31220',
    latex: '\\mathrm{MSE} = \\frac{1}{n} \\sum_i (\\hat{y}_i-y_i)^2',
    ...reviewed,
  },
  {
    candidateId: 'formula-p032-l0019-21',
    pdfPage: 32,
    lineIndexes: [19, 20, 21],
    sourceChecksum:
      'c81eac149679697b93a80f057de82c22b0c48eb5decb71a8b2ab116053712d1d',
    latex: '\\frac{\\partial \\mathrm{Loss}}{\\partial w} = 2(\\hat{y}-y)x',
    ...reviewed,
  },
  {
    candidateId: 'formula-p032-l0023-25',
    pdfPage: 32,
    lineIndexes: [23, 24, 25],
    sourceChecksum:
      '1432c71092e4138db595eec9caea9c978c2e0935bf2583603fbddc0a044f24e5',
    latex: '\\frac{\\partial \\mathrm{Loss}}{\\partial b} = 2(\\hat{y}-y)',
    ...reviewed,
  },
  {
    candidateId: 'formula-p032-l0027',
    pdfPage: 32,
    lineIndexes: [27],
    sourceChecksum:
      '8f58898214e7de3ed873a39b7cdcb6ce1cd428e86ed61b1006461b59d5bd70a2',
    latex:
      '\\mathrm{Parameter}_{new} = \\mathrm{Parameter}_{old} - \\mathrm{LearningRate} \\times \\mathrm{Gradient}',
    ...reviewed,
  },
  {
    candidateId: 'formula-p036-l0007',
    pdfPage: 36,
    lineIndexes: [7],
    sourceChecksum:
      'b1f129af04ab44b3431cc1c18f00fdea46b5daf092e44cc76495e5b10929d065',
    latex: '\\hat{y} = wx + b',
    ...reviewed,
  },
  {
    candidateId: 'formula-p069-l0005',
    pdfPage: 69,
    lineIndexes: [5],
    sourceChecksum:
      'cfccd56ff9e5f6b539700779ffaf140ae76aab58852567a091d05f2b0185291d',
    latex: 'z = Wx + b',
    ...reviewed,
  },
  {
    candidateId: 'formula-p069-l0013',
    pdfPage: 69,
    lineIndexes: [13],
    sourceChecksum:
      '43a0d13d3577f6a5e359554d917e2baa6c41a70d24e7d35f765f979791e620ee',
    latex: 'a = f(z)',
    ...reviewed,
  },
  {
    candidateId: 'formula-p069-l0015',
    pdfPage: 69,
    lineIndexes: [15],
    sourceChecksum:
      '5a7c331823561b9d636b41ea51337ffeb9aea6fd825be6653c70dd59700c6327',
    latex: 'a = \\operatorname{ReLU}(z)',
    ...reviewed,
  },
  {
    candidateId: 'formula-p069-l0018',
    pdfPage: 69,
    lineIndexes: [18],
    sourceChecksum:
      '95755e382e08dcef88bbbd83bbc81bf3dd14e56a298f0c982179daf3f8f148b2',
    latex: 'a = f(Wx+b)',
    ...reviewed,
  },
  {
    candidateId: 'formula-p074-l0039',
    pdfPage: 74,
    lineIndexes: [39],
    sourceChecksum:
      '105e1d07cc1f46d26a90444f8182a2a69b415d36ad8355611cd5632d3d57a2ae',
    latex: 'z = w_1x+b_1',
    ...reviewed,
  },
  {
    candidateId: 'formula-p074-l0040',
    pdfPage: 74,
    lineIndexes: [40],
    sourceChecksum:
      '83a9e45345853c7bf1080f68befbec3272960f5f2ce854eecd0a27b636ad0607',
    latex: 'h = \\operatorname{ReLU}(z)',
    ...reviewed,
  },
  {
    candidateId: 'formula-p107-l0003-05',
    pdfPage: 107,
    lineIndexes: [3, 4, 5],
    sourceChecksum:
      '2d8d74b8fe3f563f91c9c215164a896b8bcfec8b165d1fd4c2edd4855941e908',
    latex:
      '\\operatorname{Attention}(Q,K,V)=\\operatorname{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V',
    ...reviewed,
  },
  {
    candidateId: 'formula-p107-l0017',
    pdfPage: 107,
    lineIndexes: [17],
    sourceChecksum:
      'f1582939cd4306a77edfd839a131c6f0b73ef822422dc32e759f9db269fb133c',
    latex: 'S=QK^T',
    ...reviewed,
  },
  {
    candidateId: 'formula-p107-l0018-20',
    pdfPage: 107,
    lineIndexes: [18, 19, 20],
    sourceChecksum:
      '5e3e45face08b3f5ba4db3119200070e2d0006de1389a90745ee78d3241741be',
    latex: 'S_{scaled}=\\frac{S}{\\sqrt{d_k}}',
    ...reviewed,
  },
  {
    candidateId: 'formula-p107-l0021',
    pdfPage: 107,
    lineIndexes: [21],
    sourceChecksum:
      'a1be937c96ca6b3720973f09ea7b5d55abde56cc1bbce0bfb0f72f6ef981bbeb',
    latex: 'A=\\operatorname{softmax}(S_{scaled})',
    ...reviewed,
  },
  {
    candidateId: 'formula-p107-l0022',
    pdfPage: 107,
    lineIndexes: [22],
    sourceChecksum:
      '7e78feaafed9567ca694697015993976b98e757801deb94e3e14110ca6604e52',
    latex: 'O=AV',
    ...reviewed,
  },
  {
    candidateId: 'formula-p109-l0005',
    pdfPage: 109,
    lineIndexes: [5],
    sourceChecksum:
      '0762fed5e90446fb3ee25509e4d56b686d7cd19d35baa3e81ba0d4e87d85b4c2',
    latex: 'e^{-\\infty}=0',
    ...reviewed,
  },
];

export const TABLE_CORRECTIONS: TableCorrection[] = [
  {
    candidateId: 'table-p010-chapter-index',
    pdfPage: 10,
    lineIndexes: Array.from({ length: 52 }, (_, index) => index + 13),
    sourceChecksum:
      'd1f11ccf11de53abf5a81daf72b00e9ac76e7535f0f7889a1aabcead9b02a30a',
    caption: '章节索引',
    headers: ['周次', '章节', '本周回答的核心问题'],
    rows: [
      ['Week 1', '必要数学直觉', '怎样把 AI 公式翻译成数据、shape 和代码？'],
      ['Week 2', 'Linear Regression', '模型怎样根据错误学习 parameters？'],
      ['Week 3', 'Neural Network', '怎样从一个 wx+b 扩展成多层网络？'],
      ['Week 4', 'Backpropagation', 'Loss 怎样把责任传回每个 weight？'],
      [
        'Week 5',
        'Tensor 与 PyTorch',
        '怎样让计算机自动执行大规模 forward/backward？',
      ],
      [
        'Week 6',
        'Embedding 与 Language Model',
        '文字怎样变成 next-token prediction？',
      ],
      ['Week 7', 'Attention', '当前 token 怎样动态寻找相关 context？'],
      ['Week 8', 'Transformer', 'Attention 怎样组成可堆叠的训练架构？'],
      ['Week 9', 'Tokenizer', '文字怎样稳定转换为模型 IDs？'],
      ['Week 10', 'GPT Architecture', '怎样把所有组件组合成 Mini GPT？'],
      ['Week 11', 'Training 与 Inference', '怎样训练、验证、保存并生成文本？'],
      [
        'Week 12',
        '完整 Mini GPT',
        '整个系统怎样从 corpus 运行到 generated text？',
      ],
    ],
    ...reviewed,
  },
  {
    candidateId: 'table-p021-linear-data',
    pdfPage: 21,
    lineIndexes: Array.from({ length: 10 }, (_, index) => index + 9),
    sourceChecksum:
      'eac8b6bb46f7b480eb579be8026d63a87e1073c1b3b6f2124ab494ba97944333',
    caption: '线性回归示例数据',
    headers: ['x（面积）', 'y（房价）'],
    rows: [
      ['1', '3'],
      ['2', '5'],
      ['3', '7'],
      ['4', '9'],
    ],
    ...reviewed,
  },
  {
    candidateId: 'table-p032-vocabulary',
    pdfPage: 32,
    lineIndexes: Array.from({ length: 12 }, (_, index) => index + 1),
    sourceChecksum:
      'afdefd96ffa269d508ec2f35e466316a08c675433c2463c706d562b8dcada4dc',
    caption: 'Week 2 核心词汇',
    headers: ['English', '中文', '核心理解'],
    rows: [
      ['Forward Pass', '前向传播', 'Input → Prediction → Loss'],
      ['Backward Pass', '反向传播', 'Loss → Gradients'],
      ['Chain Rule', '链式法则', '沿依赖关系求导'],
    ],
    ...reviewed,
  },
];

export const CODE_CORRECTIONS: CodeCorrection[] = [
  {
    candidateId: 'code-p021-predict',
    pdfPage: 21,
    lineIndexes: [34, 35],
    sourceChecksum:
      '5e870906dae1896787ea17ecc85d0fb2a7b3f9fb069231114af6376dd738f3fb',
    language: 'python',
    ...reviewed,
  },
  {
    candidateId: 'code-p109-attention-head',
    pdfPage: 109,
    lineIndexes: Array.from({ length: 26 }, (_, index) => index + 11),
    sourceChecksum:
      '435fad7c2003817a853b30e1b6841eeaeb23e41e598c06a3d67f6f6e665217be',
    language: 'python',
    ...reviewed,
  },
  {
    candidateId: 'code-p129-gpt-config',
    pdfPage: 129,
    lineIndexes: Array.from({ length: 9 }, (_, index) => index + 17),
    sourceChecksum:
      '6c933e6a0267a31778ee774cd6282a0d61904f5a4a4a6035e06b45537122513e',
    language: 'python',
    ...reviewed,
  },
];

export const APPENDIX_CORRECTION = {
  candidateId: 'code-appendix-a-mini-gpt',
  pdfPages: Array.from({ length: 10 }, (_, index) => index + 161),
  sourceChecksum:
    '4b91eaf6a31efd9210ed503a927c13e783162bca9aed8cd2131fc34faa014e3e',
  language: 'python',
  filename: 'mini_gpt.py',
  expectedLineCount: 472,
  expectedCharacterCount: 18411,
  expectedCodeSha256:
    '0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd',
  ...reviewed,
};

export const KNOWLEDGE_CHECK_OUTLINE_INDEXES = [37, 167, 199, 458] as const;
