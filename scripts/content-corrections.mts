import { createHash } from 'node:crypto';

import type { InlineNode } from '../src/content/schema';
import type { CandidateReviewDecision } from './candidate-review-ledger.mts';
import {
  formulaSourceGeometryChecksum,
  type FormulaReviewLedger,
  type ReviewedFormula,
} from './formula-review-ledger.mts';
import {
  spanChecksum,
  spansForLines,
  type SourceAudit,
} from './source-audit.mts';

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

export type PageLinesSourceEvidence = {
  kind: 'pageLines';
  pdfPage: number;
  lineIndexes: number[];
  sourceSpanIds: string[];
  sourceChecksum: string;
  sourceGeometryChecksum: string;
};

export type CrossPageSelectorSourceEvidence = {
  kind: 'crossPageSelector';
  pageRange: [161, 169];
  selector: 'textRaw-includes-U+2011';
  lineIndexesByPage: Record<string, number[]>;
  sourceSpanIds: string[];
  sourceChecksum: string;
  sourceGeometryChecksum: string;
};

export type SourceEvidence =
  | PageLinesSourceEvidence
  | CrossPageSelectorSourceEvidence;

export type ParagraphPatch = {
  sectionId: string;
  blockId: string;
  children: readonly InlineNode[];
};

export type SourceProjectionTargetFragment =
  | {
      blockId: string;
      field: 'children' | 'steps' | 'accessibleText';
    }
  | { blockId: string; field: 'item'; itemIndex: number }
  | { sectionId: string; field: 'title' };

export type ReviewedTarget =
  | {
      kind: 'paragraph';
      patches: readonly ParagraphPatch[];
      guardBlockIds?: readonly string[];
    }
  | {
      kind: 'list';
      sectionId: string;
      blockId: string;
      ordered: boolean;
      items: readonly (readonly InlineNode[])[];
    }
  | {
      kind: 'listItem';
      sectionId: string;
      blockId: string;
      itemIndex: number;
      children: readonly InlineNode[];
    }
  | { kind: 'sectionTitle'; sectionId: string; title: string }
  | {
      kind: 'conceptChain';
      sectionId: string;
      blockId: string;
      steps: readonly string[];
    }
  | {
      kind: 'formulaAbsorption';
      sectionId: string;
      formulaBlockId: string;
      absorbedBlockIds: readonly string[];
      latex: string;
      accessibleText: string;
    }
  | {
      kind: 'formulaReference';
      blockIds: readonly string[];
      action: 'assertFormulaReviewLedger';
    }
  | { kind: 'excludedNavigation'; reason: string }
  | {
      kind: 'sourceOnlyNoop';
      sectionId: string;
      comparisonBlockIds: readonly string[];
      reason: string;
    };

export type ReviewedCourseCorrection = {
  correctionId: string;
  category: 'fidelity' | 'inlineMath' | 'correctness';
  candidateId?: string;
  contentCorrectionId?: `CC-${string}`;
  sourceEvidence: readonly SourceEvidence[];
  sourceProjection:
    | {
        kind: 'replace';
        sourceSpanIds: readonly string[];
        targetFragments: readonly SourceProjectionTargetFragment[];
      }
    | {
        kind:
          | 'formulaReviewLedger'
          | 'unchangedSemanticBlock'
          | 'excludedNavigation'
          | 'sourceOnlyNormalization';
      };
  expectedTargetFingerprint: string | null;
  target: ReviewedTarget;
  reviewer: string;
  status: 'reviewed';
};

export type CourseCorrectionOutcome =
  | 'applied'
  | 'assertedFormulaReference'
  | 'semanticNoop'
  | 'excludedNavigation'
  | 'sourceOnlyNoop';

export type CorrectionAuditEntry = {
  correctionId: string;
  category: 'fidelity' | 'inlineMath' | 'correctness';
  candidateId?: string;
  contentCorrectionId?: string;
  outcome: CourseCorrectionOutcome;
  target: {
    kind: ReviewedTarget['kind'];
    sectionIds: string[];
    blockIds: string[];
    itemIndex?: number;
  };
  sourceEvidence: readonly SourceEvidence[];
  expectedTargetFingerprint: string | null;
  actualTargetFingerprint: string | null;
  replacementFingerprint: string | null;
  reviewer: string;
  status: 'reviewed';
};

const BODY_REVIEWER = 'Codex body/inline correction design';
const INLINE_REVIEWER = 'Codex rendered-source candidate review';
const CORRECTNESS_REVIEWER = 'Codex content-correctness independent rereview';
const PRINTED_TOC_REASON =
  'Printed table of contents replaced by recursive web navigation';

function numberedIds(
  prefix: string,
  first: number,
  last: number,
  width = 5,
): string[] {
  return Array.from(
    { length: last - first + 1 },
    (_, offset) => `${prefix}${String(first + offset).padStart(width, '0')}`,
  );
}

function spanIds(pdfPage: number, first: number, last: number): string[] {
  return numberedIds(`p${String(pdfPage).padStart(3, '0')}-s`, first, last);
}

function lineEvidence(
  pdfPage: number,
  lineIndexes: readonly number[],
  sourceSpanIds: readonly string[],
  sourceChecksum: string,
  sourceGeometryChecksum: string,
): PageLinesSourceEvidence {
  return {
    kind: 'pageLines',
    pdfPage,
    lineIndexes: [...lineIndexes],
    sourceSpanIds: [...sourceSpanIds],
    sourceChecksum,
    sourceGeometryChecksum,
  };
}

function text(value: string): InlineNode {
  return { type: 'text', value };
}

function inlineMath(value: string, accessibleText: string): InlineNode {
  return { type: 'inlineMath', value, accessibleText };
}

function inlineCode(value: string): InlineNode {
  return { type: 'inlineCode', value };
}

function paragraphPatch(
  sectionId: string,
  blockId: string,
  children: readonly InlineNode[],
): ParagraphPatch {
  return { sectionId, blockId, children };
}

function childFragment(blockId: string): SourceProjectionTargetFragment {
  return { blockId, field: 'children' };
}

function itemFragment(
  blockId: string,
  itemIndex: number,
): SourceProjectionTargetFragment {
  return { blockId, field: 'item', itemIndex };
}

function titleFragment(sectionId: string): SourceProjectionTargetFragment {
  return { sectionId, field: 'title' };
}

function stepsFragment(blockId: string): SourceProjectionTargetFragment {
  return { blockId, field: 'steps' };
}

function accessibleTextFragment(
  blockId: string,
): SourceProjectionTargetFragment {
  return { blockId, field: 'accessibleText' };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

const BODY_INLINE_CORRECTIONS: ReviewedCourseCorrection[] = [
  {
    correctionId: 'body-fraction-p023-gradient',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        23,
        [31, 32, 33],
        spanIds(23, 43, 46),
        '5757992eb30d56407ec7e13ba45b40751f55f06efe28e72bb656383364e8e0f7',
        '053181612e7fe1f46bd11d5f5c63ba823c3e54b6c18a608e73dc9a3a294a790b',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(23, 43, 46),
      targetFragments: [accessibleTextFragment('formula-math-p023-g001')],
    },
    expectedTargetFingerprint:
      '3d21eeb35e2bff3f100d7f1214058da1ce20fb4dce18ee11fe8fe2cb74eaf032',
    target: {
      kind: 'formulaAbsorption',
      sectionId: 'o0047-8-gradient',
      formulaBlockId: 'formula-math-p023-g001',
      absorbedBlockIds: ['body-00374', 'body-00375'],
      latex: '\\mathrm{Gradient} = \\frac{d\\,\\mathrm{Loss}}{dw}',
      accessibleText: 'Gradient = (d Loss)/(dw)',
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'body-fraction-p025-chain-rule',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        25,
        [20, 21, 22],
        spanIds(25, 35, 41),
        '6fd72e8dd1bf52f52e3583f5603d2adfef02f71bad39b4960a0833202f77c074',
        'a9e1510853357ebff68eb95e092cc82630e05b9f666e40f0af9b5297960d7708',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(25, 35, 41),
      targetFragments: [accessibleTextFragment('formula-math-p025-g005')],
    },
    expectedTargetFingerprint:
      '33f05bc788b068f52628e971b445b94beac6522c98bd388a47eeded86eac7b58',
    target: {
      kind: 'formulaAbsorption',
      sectionId: 'o0053-step-3-gradient',
      formulaBlockId: 'formula-math-p025-g005',
      absorbedBlockIds: ['body-00417', 'body-00418'],
      latex:
        '\\frac{d\\,\\mathrm{Loss}}{dw} = \\left(\\frac{d\\,\\mathrm{Loss}}{d\\hat{y}}\\right) \\times \\left(\\frac{d\\hat{y}}{dw}\\right)',
      accessibleText: '(d Loss)/(dw) = ((d Loss)/(dŷ)) × ((dŷ)/(dw))',
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'body-fraction-p025-result',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        25,
        [30, 31, 32],
        spanIds(25, 52, 54),
        'c6bf739af0ca735fadbf28a1edab7cf2324ae125e2271d7f1093895b033ef1d1',
        '9831af281862a6fac7fdbde325a6ed1551ab08481658a2006dd0112d9dd464cc',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(25, 52, 54),
      targetFragments: [accessibleTextFragment('formula-math-p025-g007')],
    },
    expectedTargetFingerprint:
      '2af126704410f31fa205b0f89aa109f4e881954d3a584a1ea06cbcf93a409df8',
    target: {
      kind: 'formulaAbsorption',
      sectionId: 'o0053-step-3-gradient',
      formulaBlockId: 'formula-math-p025-g007',
      absorbedBlockIds: ['body-00425', 'body-00426'],
      latex: '\\frac{d\\,\\mathrm{Loss}}{dw} = -6 \\times 2 = -12',
      accessibleText: '(d Loss)/(dw) = -6 × 2 = -12',
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'body-neuron-nodes-p071',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        71,
        [36, 38],
        ['p071-s00038', 'p071-s00039', 'p071-s00041'],
        'aedada828114bc1af3fe7b4c45b75e4b5f9c4197380dc3b3b130c623dd07265d',
        'ba4176a3fa24824a4f77635fa28d0eb2ff5f532176e7916c92d5b8cbe1c36345',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p071-s00038', 'p071-s00039', 'p071-s00041'],
      targetFragments: [
        childFragment('body-01786'),
        childFragment('body-01788'),
      ],
    },
    expectedTargetFingerprint:
      '4540a9eab916f8886ae31b6cba274fb1fc9d413da0cc23cfc9c5411635b5ba9c',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0169-58-week-3-week-4', 'body-01786', [
          text('x1 ──w1──□'),
        ]),
        paragraphPatch('o0169-58-week-3-week-4', 'body-01788', [
          text('x2 ──w2──□'),
        ]),
      ],
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'body-value-dv-p108',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        108,
        [3, 14, 16],
        [
          'p108-s00007',
          'p108-s00008',
          'p108-s00026',
          'p108-s00027',
          'p108-s00029',
        ],
        '508681c2e0494861c793578a3d1beae3f5b1b4e88dac63f0bc39311903c5896f',
        '63de24a999cec4f9b175431d0060f2020cc08da4dca3cb3c5bad21f501a0f68a',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: [
        'p108-s00007',
        'p108-s00008',
        'p108-s00026',
        'p108-s00027',
        'p108-s00029',
      ],
      targetFragments: [
        childFragment('body-02859'),
        childFragment('body-02870'),
        childFragment('body-02872'),
      ],
    },
    expectedTargetFingerprint:
      'efae2e33e9cd84c6618bf620278ba80ba202066a087a044e446e8005f7f95b75',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0268-9-self-attention-shape', 'body-02859', [
          text('V: [B, T, '),
          inlineMath('d_v', 'd_v'),
          text(']'),
        ]),
        paragraphPatch('o0268-9-self-attention-shape', 'body-02870', [
          text('[B, T, T] @ [B, T, '),
          inlineMath('d_v', 'd_v'),
          text(']'),
        ]),
        paragraphPatch('o0268-9-self-attention-shape', 'body-02872', [
          text('[B, T, '),
          inlineMath('d_v', 'd_v'),
          text(']'),
        ]),
      ],
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'body-row42-p125',
    category: 'fidelity',
    sourceEvidence: [
      lineEvidence(
        125,
        [11, 12, 13],
        spanIds(125, 13, 15),
        '1144826892ff919bbd02009a5dddc8675639bce5388aebdec91a2001b6be7866',
        '7026fdd8a300672da376191a88f1428140889f097bf53eed24aca7b82ff10091',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(125, 13, 15),
      targetFragments: [childFragment('body-03355')],
    },
    expectedTargetFingerprint:
      '6369fc843e3dcd84263b05587a7b2eb5660eda39ba7a0e9ad6e56b37860e8e1b',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0340-9-tokenizer-model', 'body-03355', [
          text(
            'Embedding row 42 学到的是“训练tokenizer 中ID 42 的使用方式”。如果加载另一个tokenizer，row 42 的数值还在，却被错误地赋给另一token。程序常常不会shape error，但输出会严重异常，这是一种语义层面的schema mismatch。',
          ),
        ]),
      ],
    },
    reviewer: BODY_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p006-g000',
    category: 'inlineMath',
    candidateId: 'math-p006-g000',
    sourceEvidence: [
      lineEvidence(
        6,
        [90],
        spanIds(6, 2223, 2300),
        '127e25ee4bd9182eea985770bb1c267a2bf877841bb5469ee09372dc2e3896cd',
        '915d9fc4b65bbe621390f45b9c2773c7844ff98832dafc48382fdcc2aa64fac6',
      ),
    ],
    sourceProjection: { kind: 'excludedNavigation' },
    expectedTargetFingerprint: null,
    target: { kind: 'excludedNavigation', reason: PRINTED_TOC_REASON },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p006-g001',
    category: 'inlineMath',
    candidateId: 'math-p006-g001',
    sourceEvidence: [
      lineEvidence(
        6,
        [103],
        spanIds(6, 2638, 2641),
        '7bea6dc05b1c7dd14a5d266a153ecf70baa2331e0209ee1cc3e3dd65940bec8f',
        '177bbd62d4fa02dc86cbebd84345cc70e18b87a6cf54b705198a32babc3e93bf',
      ),
    ],
    sourceProjection: { kind: 'excludedNavigation' },
    expectedTargetFingerprint: null,
    target: { kind: 'excludedNavigation', reason: PRINTED_TOC_REASON },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p105-g003',
    category: 'inlineMath',
    candidateId: 'math-p105-g003',
    sourceEvidence: [
      lineEvidence(
        105,
        [8],
        spanIds(105, 11, 20),
        'f3b1fe993cc969389cae39e10c8b5c127ad6bb7af9713a4edccfa58d239a219c',
        '6a7a7bfe8e699ab3c370eebc8247ab8a8dda3caa0d8f980dd236e8bf2bd39721',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(105, 11, 20),
      targetFragments: [childFragment('body-02792')],
    },
    expectedTargetFingerprint:
      '1556dbb42a749c66160925877a1fa2ccf649fada828bf1c36fa6983acaa2e7e9',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0258-2-q-k-v', 'body-02792', [
          text('其中'),
          inlineMath('W_Q', 'W_Q'),
          text('、'),
          inlineMath('W_K', 'W_K'),
          text('、'),
          inlineMath('W_V', 'W_V'),
          text('都是parameters。'),
        ]),
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p107-g005',
    category: 'inlineMath',
    candidateId: 'math-p107-g005',
    sourceEvidence: [
      lineEvidence(
        107,
        [25],
        spanIds(107, 43, 47),
        'f4858d8055c3ca3932969c7099ab34655b236e6f3b48e0e9a092c00391517306',
        '4e5bc7e365b2a53c59e840ec00597c4754db6104be77ffc995fc278d4c3b6326',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(107, 43, 47),
      targetFragments: [titleFragment('o0266-8-sqrt-d-k')],
    },
    expectedTargetFingerprint:
      'cc72dc1fd3ad6cc393ed9d05e497e994762ba1ec8b920b848e7e69cc1123e743',
    target: {
      kind: 'sectionTitle',
      sectionId: 'o0266-8-sqrt-d-k',
      title: '8. 为什么除以√𝑑ₖ',
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p107-g006',
    category: 'inlineMath',
    candidateId: 'math-p107-g006',
    sourceEvidence: [
      lineEvidence(
        107,
        [28],
        spanIds(107, 50, 53),
        '8c066da858a193e2073dd67dc3489ecd5a3c5c0a98cf6fc5f0f05bfd496035fc',
        'a86877e90b253936fcb252adff23b344c316686844a2392cc880d8e8480e0fc6',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(107, 50, 53),
      targetFragments: [childFragment('body-02848')],
    },
    expectedTargetFingerprint:
      'de4f38a945f653093ce424ad1f3489048008a17503ee09e44556cdcba7853d7b',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0266-8-sqrt-d-k', 'body-02848', [
          text('除以'),
          inlineMath('\\sqrt{d_k}', 'sqrt(d_k)'),
          text('是一个尺度校正：让不同dimension 下的score 范围更稳定。'),
        ]),
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p109-g000',
    category: 'inlineMath',
    candidateId: 'math-p109-g000',
    sourceEvidence: [
      lineEvidence(
        109,
        [1],
        spanIds(109, 1, 4),
        '56792573046f69176b8513043327511c8bb39676ac2d3fe501c0cfd54fb51816',
        'f20d6c49d5338304478066a5ac197be4a86a856fc8957fe6eeb0b3d05dff13d5',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(109, 1, 4),
      targetFragments: [titleFragment('o0272-11-mask-softmax-infty')],
    },
    expectedTargetFingerprint:
      'c57a2005038f363377f858f7c6712de62e561dccccfe918769a5ecf653470e18',
    target: {
      kind: 'sectionTitle',
      sectionId: 'o0272-11-mask-softmax-infty',
      title: '11. 为什么Mask 在Softmax 前使用−∞',
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p110-g003',
    category: 'inlineMath',
    candidateId: 'math-p110-g003',
    sourceEvidence: [
      lineEvidence(
        110,
        [23],
        spanIds(110, 63, 72),
        '8cb4761bacf0f7c8ee4531560d6b611601035648b0e9377e973e13a0ee929b98',
        '10d729ee6353fd1cc63fb6c6b583c73ff7d502b6a5282c388023797cf6ae37ab',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(110, 63, 72),
      targetFragments: [childFragment('body-02914')],
    },
    expectedTargetFingerprint:
      '74ea9b6fe5b04e4ff2727f996a81b890bddeecd6d9df13c4a12108828d2c402b',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0279-15-multi-head-attention', 'body-02914', [
          text('一个attention head 只有一套'),
          inlineMath('W_Q', 'W_Q'),
          text('、'),
          inlineMath('W_K', 'W_K'),
          text('、'),
          inlineMath('W_V', 'W_V'),
          text('。'),
        ]),
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p116-g001',
    category: 'inlineMath',
    candidateId: 'math-p116-g001',
    sourceEvidence: [
      lineEvidence(
        116,
        [6],
        spanIds(116, 9, 13),
        '73e61a2cc073754ff07a981ce2212257dae337bb022adf6ad1d07c5ab7d5b7f4',
        '27843b8d6c4cd47389b6f5f984c41e506fd1279d66113f67a3f320e896e0a3b1',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(116, 9, 13),
      targetFragments: [childFragment('body-03052')],
    },
    expectedTargetFingerprint:
      '9d25a3bd9ac3c2d1da1065c7417d7c7375268e84321eca00f6c1ab52b04d748f',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0299-7-residual-connection', 'body-03052', [
          text('即使'),
          inlineMath('F', 'F'),
          text('的gradient 很弱，仍然有identity path 中的1。'),
        ]),
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p149-g000',
    category: 'inlineMath',
    candidateId: 'math-p149-g000',
    sourceEvidence: [
      lineEvidence(
        149,
        [5],
        spanIds(149, 17, 21),
        '4ced7e6bb66a475dd61faec0590c83f98cdbab58e0a76557d6d3e83b57f219df',
        '1445468b86ae4347d47f5e707d7ebf80bbaf477d36860bc5d155743c5c643abb',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(149, 17, 21),
      targetFragments: [itemFragment('list-body-04164', 3)],
    },
    expectedTargetFingerprint:
      '00fb96688a011c119d526a146e7a1beda5f7f1a9ef79f2f9dc85da50b954535a',
    target: {
      kind: 'listItem',
      sectionId: 'o0411-21-week-11-7',
      blockId: 'list-body-04164',
      itemIndex: 3,
      children: [
        text('初始random loss 约为'),
        inlineMath('\\log(V)', 'log(V)'),
        text('。'),
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'inline-math-p154-g000',
    category: 'inlineMath',
    candidateId: 'math-p154-g000',
    sourceEvidence: [
      lineEvidence(
        154,
        [30],
        ['p154-s00046'],
        '760eae5f5c27435ac2c5f9d282a424ad86e5bde9da555e7e02a584c2ad4dc1a9',
        '9abbee88c1dbb6caa2818c76efe8a014ea36c406096de333791b328addf70327',
      ),
    ],
    sourceProjection: { kind: 'unchangedSemanticBlock' },
    expectedTargetFingerprint:
      '949998a1d3b67b6e8960c02f419a340a9606ed17af5e0cb247985a623d15417f',
    target: {
      kind: 'conceptChain',
      sectionId: 'o0426-12-optimizer-step',
      blockId: 'chain-body-04382',
      steps: [
        '𝑃𝑎𝑟𝑎𝑚𝑒𝑡𝑒𝑟𝑠',
        '𝑃𝑟𝑒𝑑𝑖𝑐𝑡𝑖𝑜𝑛',
        '𝐿𝑜𝑠𝑠',
        '𝐺𝑟𝑎𝑑𝑖𝑒𝑛𝑡𝑠',
        '𝐵𝑒𝑡𝑡𝑒𝑟𝑃𝑎𝑟𝑎𝑚𝑒𝑡𝑒𝑟𝑠',
      ],
    },
    reviewer: INLINE_REVIEWER,
    status: 'reviewed',
  },
];

const CORRECTNESS_CORRECTIONS_01_10: ReviewedCourseCorrection[] = [
  {
    correctionId: 'CC-01',
    category: 'correctness',
    contentCorrectionId: 'CC-01',
    sourceEvidence: [
      lineEvidence(
        18,
        [30],
        ['p018-s00053'],
        'dec78fd1be9145204d4324781bdad4a3b55ce26dfefde04f334de5d27f239c73',
        '8ee27aa45f6b147a58ae660f85f97d2f7504e065305f66c68a645660597275ce',
      ),
    ],
    sourceProjection: { kind: 'formulaReviewLedger' },
    expectedTargetFingerprint:
      '7c84778f07c6a95bdb72d5a3033bc1607de9e87db7ba79fdfed55301e546ff0e',
    target: {
      kind: 'formulaReference',
      blockIds: ['formula-math-p018-g003'],
      action: 'assertFormulaReviewLedger',
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-02',
    category: 'correctness',
    contentCorrectionId: 'CC-02',
    sourceEvidence: [
      lineEvidence(
        30,
        [10, 11, 12, 13, 14, 15, 16],
        spanIds(30, 12, 18),
        '1bf5990fdd0e6c1908575ca8ff83da95997611ae4b9d7cc25991cb9fa5e0ef1f',
        '17c42cb1c8604a145731445879fbcefa0077b67440007be98acfafc5a8ff4fa3',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(30, 12, 18),
      targetFragments: numberedIds('body-', 547, 553).map(childFragment),
    },
    expectedTargetFingerprint:
      '4b0b250e5fdf6e32982f3848c8eb6d5ddc7cf1f942a9d79fd4bb2779e6e27342',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0062-19-forward-pass-backward-pass', 'body-00547', [
          text('Backward Pass / Backpropagation：'),
        ]),
        paragraphPatch('o0062-19-forward-pass-backward-pass', 'body-00552', [
          text('Optimizer / Gradient Descent：'),
        ]),
        paragraphPatch('o0062-19-forward-pass-backward-pass', 'body-00553', [
          text('Gradients → Updated Parameters'),
        ]),
      ],
      guardBlockIds: numberedIds('body-', 547, 553),
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-03',
    category: 'correctness',
    contentCorrectionId: 'CC-03',
    sourceEvidence: [
      lineEvidence(
        30,
        [22],
        ['p030-s00031'],
        '8b8bc2772f242677172b5bb357a647630d1a1298fcc105bd78cf627ef699e348',
        '2a08bb80c5b324397f4f8a396a4bab02d2ff25a4030ebdf891f7dcfe4fb94f52',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p030-s00031'],
      targetFragments: [stepsFragment('chain-body-00558')],
    },
    expectedTargetFingerprint:
      'a1df46a322f53d144478a18b2ed7463886c12cb8d40a5f3ae9a04036a346c722',
    target: {
      kind: 'conceptChain',
      sectionId: 'o0063-20-epoch-batch',
      blockId: 'chain-body-00558',
      steps: [
        'Batch 是一次forward/loss/backward/update 所处理的一组样本。它可以是整个训练集（full batch），也可以是其中一部分（mini-batch；实际训练更常见）。',
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-04',
    category: 'correctness',
    contentCorrectionId: 'CC-04',
    sourceEvidence: [
      lineEvidence(
        32,
        [17, 19, 20, 21, 23, 24, 25],
        [
          ...spanIds(32, 26, 32),
          ...spanIds(32, 36, 39),
          ...spanIds(32, 43, 46),
        ],
        'c8db5ccc405dcda619a91a2e66b4cb4b9ff8db7250a5db5652d0fda4f90e6568',
        '9584e8adc660c65d629bce5c2ab476586ee0ec04d67fabc9de0ec6d99a9b60ee',
      ),
    ],
    sourceProjection: { kind: 'formulaReviewLedger' },
    expectedTargetFingerprint:
      'cce8400b57b946a987bf1f85a47709e8c8d7c061c10241b5583b239630ec15f8',
    target: {
      kind: 'formulaReference',
      blockIds: [
        'formula-p032-l0017',
        'formula-p032-l0019-21',
        'formula-p032-l0023-25',
      ],
      action: 'assertFormulaReviewLedger',
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-05',
    category: 'correctness',
    contentCorrectionId: 'CC-05',
    sourceEvidence: [
      lineEvidence(
        63,
        [17],
        ['p063-s00019'],
        '3089b03fd7f1cea0bf5c12a86d3d4081c15d20ce8af6644786bfc0a05e4bb338',
        '3c170928127b720b5a773d3a406c11a4ae1b3d7606357110b237b06095c4b074',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p063-s00019'],
      targetFragments: [childFragment('body-01518')],
    },
    expectedTargetFingerprint:
      '72ea05419f31a2ffb6ff25aec0e521beb8c128a3cb0982d3be29b028375f3001',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0144-wx-b', 'body-01518', [
          text('Affine Transformation（当'),
          inlineMath('b \\ne 0', 'b ≠ 0'),
          text('时；ML frameworks 通常仍称为“Linear layer”）'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-06',
    category: 'correctness',
    contentCorrectionId: 'CC-06',
    sourceEvidence: [
      lineEvidence(
        58,
        [6],
        ['p058-s00006'],
        'a9c8e7dbf48c0f9ddaff29ab8e231f1e95df12c7ee52ccbc937e21487b85d0b4',
        'c5da5a5c3eedd62147fff1395d24082c89398a97b6aaa78e1dcfc5c88a4af301',
      ),
      lineEvidence(
        59,
        [8],
        ['p059-s00008'],
        '70d76680106cdd556152a95a9a36e9764e22ccf583253786e9f3279a44021dac',
        '97f4cd94a4ec7a74604eb83c94452eab8df39cd03caf03feae958f9aa606caa8',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p058-s00006', 'p059-s00008'],
      targetFragments: [
        childFragment('body-01342'),
        childFragment('body-01380'),
      ],
    },
    expectedTargetFingerprint:
      '19c250a5f563f1299e5b1dbdb76ffd4bde461a393bc46999ddc3c81d9d7a5211',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0128-37-python-neuron', 'body-01342', [
          text('1.4000000000000001'),
        ]),
        paragraphPatch('o0129-38-layer', 'body-01380', [
          text('[1.4000000000000001, 1.1]'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-07',
    category: 'correctness',
    contentCorrectionId: 'CC-07',
    sourceEvidence: [
      lineEvidence(
        68,
        [51],
        spanIds(68, 53, 55),
        '5e0b59aa7ce67265d8e89c392eca2c1c91cbf99055b84dee1deff4cf606d3283',
        '9b55e424e49ec1a048b1faab9bf0df93827d93aaee09d5a79db33e014ff1b68e',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(68, 53, 55),
      targetFragments: [itemFragment('list-body-01709', 0)],
    },
    expectedTargetFingerprint:
      '380f3afa10c5c41404dcaf7cb5d2e07090aacb2bce82fd2ca36de334bb99ba99',
    target: {
      kind: 'list',
      sectionId: 'o0162-54-week-3-7',
      blockId: 'list-body-01709',
      ordered: true,
      items: [
        [
          text('Neuron 的pre-activation 是'),
          inlineMath('z = Wx + b', 'z = Wx + b'),
          text('；包含activation 时，完整输出是'),
          inlineMath('a = f(z) = f(Wx + b)', 'a = f(z) = f(Wx + b)'),
          text('。'),
        ],
        [text('Weight 决定输入怎样影响neuron。')],
        [text('Bias 给neuron 一个额外可学习的偏移。')],
        [text('只堆Linear Layer 没用，因为整体仍然Linear。')],
        [text('Activation Function 引入Non-linearity。')],
        [text('多个Neurons 组成Layer，多层组成Neural Network。')],
        [text('Neural Network 学习，本质仍然是调整Parameters 来降低Loss。')],
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-08',
    category: 'correctness',
    contentCorrectionId: 'CC-08',
    sourceEvidence: [
      lineEvidence(
        72,
        [19],
        spanIds(72, 21, 29),
        'a2d1fc5ba9a47d3b7e53a9be591aa2f2607d12b83be862a09d3811dc406f3c42',
        'f350fe496197832cbf7cb01d7fc7f18dcd4b307a01539db35072df3022e66f1b',
      ),
    ],
    sourceProjection: { kind: 'formulaReviewLedger' },
    expectedTargetFingerprint:
      '9adc8539d9019977db7747c94d4aae12f0589daf12bb8952483ab7435045d452',
    target: {
      kind: 'formulaReference',
      blockIds: ['formula-math-p072-g000'],
      action: 'assertFormulaReviewLedger',
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-09',
    category: 'correctness',
    contentCorrectionId: 'CC-09',
    sourceEvidence: [
      lineEvidence(
        76,
        [16],
        ['p076-s00043'],
        '9b51f359341a87f499677dd3a0479fe9956b9a31d1d0727ccabbdf41b532f621',
        '969300b154a9362457a03a4566180ecc9ec0c33b655b990e09296e3d96881d4d',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p076-s00043'],
      targetFragments: [childFragment('body-01932')],
    },
    expectedTargetFingerprint:
      '24b13c18af8186726f429aa61bf90cbd3c9378f3fa52500c85348195ec19a191',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0184-4-local-derivative', 'body-01932', [
          text('我的某个input 稍微变化时，我的output 会变化多快？'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-10',
    category: 'correctness',
    contentCorrectionId: 'CC-10',
    sourceEvidence: [
      lineEvidence(
        87,
        [21],
        spanIds(87, 80, 82),
        'a41df04dcc8411fce5187f3f409634140d3ed03503dc987951e81500959ab25c',
        '3d975c4e2c6ddbbcdda1498c9fd687553271518f19755381fc57a606c3a559ae',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(87, 80, 82),
      targetFragments: [childFragment('body-02252')],
    },
    expectedTargetFingerprint:
      'ba848790b401e1fc3aed9ec720295f60e658c241e13a3f419dc1e9e31b52c60f',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0206-4-tensor-layer', 'body-02252', [
          text('print(Z.shape) # torch.Size([4, 2])'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
];

const CC25_SOURCE_SPAN_IDS = [
  'p161-s00000',
  'p161-s00001',
  'p161-s00004',
  'p161-s00005',
  'p161-s00038',
  'p161-s00118',
  'p161-s00150',
  'p162-s00006',
  'p162-s00012',
  'p162-s00052',
  'p162-s00065',
  'p162-s00110',
  'p162-s00120',
  'p162-s00164',
  'p162-s00167',
  'p162-s00175',
  'p163-s00009',
  'p163-s00015',
  'p163-s00045',
  'p163-s00066',
  'p163-s00074',
  'p163-s00093',
  'p163-s00111',
  'p164-s00003',
  'p164-s00038',
  'p164-s00103',
  'p164-s00135',
  'p164-s00168',
  'p164-s00176',
  'p164-s00190',
  'p165-s00004',
  'p165-s00014',
  'p165-s00020',
  'p165-s00042',
  'p165-s00073',
  'p165-s00087',
  'p165-s00109',
  'p166-s00002',
  'p166-s00066',
  'p166-s00090',
  'p167-s00011',
  'p167-s00021',
  'p167-s00031',
  'p168-s00120',
  'p168-s00127',
  'p169-s00044',
  'p169-s00068',
  'p169-s00075',
  'p169-s00087',
  'p169-s00095',
  'p169-s00103',
  'p169-s00111',
  'p169-s00119',
  'p169-s00127',
  'p169-s00135',
  'p169-s00143',
  'p169-s00148',
  'p169-s00151',
  'p169-s00159',
  'p169-s00167',
  'p169-s00175',
  'p169-s00183',
  'p169-s00191',
  'p169-s00199',
  'p169-s00207',
  'p169-s00215',
  'p169-s00223',
  'p169-s00242',
  'p169-s00249',
  'p169-s00254',
  'p169-s00262',
  'p169-s00270',
  'p169-s00278',
  'p169-s00286',
  'p169-s00298',
];

const CC25_LINE_INDEXES_BY_PAGE = {
  p161: [0, 1, 4, 5, 25, 41, 49],
  p162: [3, 5, 11, 14, 28, 30, 49, 50],
  p163: [3, 5, 13, 21, 24, 30, 35],
  p164: [1, 12, 28, 41, 49, 51, 53],
  p165: [1, 4, 6, 12, 20, 30, 38],
  p166: [1, 29, 42],
  p167: [4, 6, 9],
  p168: [45, 47],
  p169: [
    14, 18, 20, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 47, 48, 49, 50, 51, 52, 53, 56,
  ],
};

const CC25_SOURCE_SPAN_ID_CHECKSUM =
  '704586b0ec112462218d592f21a8b1e064312aa41682c02a87e77dc4b1ddb1b3';
const CC25_EXPECTED_SPAN_COUNT = 75;
const CC25_EXPECTED_LINE_COUNT = 73;
const CC25_EXPECTED_OCCURRENCE_COUNT = 129;

const CC25_SOURCE_EVIDENCE: CrossPageSelectorSourceEvidence = {
  kind: 'crossPageSelector',
  pageRange: [161, 169],
  selector: 'textRaw-includes-U+2011',
  lineIndexesByPage: CC25_LINE_INDEXES_BY_PAGE,
  sourceSpanIds: CC25_SOURCE_SPAN_IDS,
  sourceChecksum:
    'd738e50f29670ec57f26f1f33999608dfd0ea7abe6f19ea0d79b3200dcb29312',
  sourceGeometryChecksum:
    'f42023a6976106fc0708117bfd4716b841316929657a19b0dfc4b9762bd6854b',
};

const CORRECTNESS_CORRECTIONS_11_25: ReviewedCourseCorrection[] = [
  {
    correctionId: 'CC-11',
    category: 'correctness',
    contentCorrectionId: 'CC-11',
    sourceEvidence: [
      lineEvidence(
        90,
        [13, 14, 15],
        spanIds(90, 26, 33),
        'e32583224ae7916c19c590f46b156dcc239382797e8529c13990f822cd5f1e67',
        'bcaa224e06c7cb59bad543b493b6c48abfb9522d45eec600ad42d9415d2fa9f3',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(90, 26, 33),
      targetFragments: [childFragment('body-02344')],
    },
    expectedTargetFingerprint:
      '43ed88178a6493c95de132ab8d6b969ffecc940733af1c13b42cb3c3303d7d0f',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0212-10-parameter', 'body-02344', [
          text(
            '这里的w 是requires_grad=True 的leaf tensor；在torch.no_grad() 之外执行原地更新w -= ... 会被autograd 拒绝并抛出RuntimeError。若改写成非原地的w = w - ...，新w 才可能携带历史并把迭代连接起来（同时它不再是leaf）。参数更新应放在torch.no_grad() 中，或交给optimizer.step()。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-12',
    category: 'correctness',
    contentCorrectionId: 'CC-12',
    sourceEvidence: [
      lineEvidence(
        95,
        [47],
        spanIds(95, 72, 74),
        '3f24dc01b3e7b06a878396d7da3e28f21c48b9a84d708b1b03593e0c3acbbec3',
        'cccf6b4db0d9332a49d90e7c88208d9ee9819795e1ebde899c0ac50030d45e60',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(95, 72, 74),
      targetFragments: [childFragment('body-02526')],
    },
    expectedTargetFingerprint:
      '8944fb394f1cbdb9d2dbeb420a6daa8d57ee5804fd6dd308bce56903212bcb07',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0228-3-embedding-matrix', 'body-02526', [
          text('Token ID 2 会选择索引为2 的row，也就是显示矩阵中的第3 行：'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-13',
    category: 'correctness',
    contentCorrectionId: 'CC-13',
    sourceEvidence: [
      lineEvidence(
        96,
        [1],
        spanIds(96, 1, 3),
        '81c1234681557e2a5fba1cf6920b58102df33db5f85d8e2c394fb0295df217c5',
        'a4fed46f22d719d3f54bf06c47d1e616efd105406e2ac25859cf982feb054cc8',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(96, 1, 3),
      targetFragments: [childFragment('body-02535')],
    },
    expectedTargetFingerprint:
      '5397129a9b9c9177d6de628f075029cc8e10dc14b935e9c045e4c2f2c7f82241',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0228-3-embedding-matrix', 'body-02535', [
          text('print(x.shape) # torch.Size([3, 3])'),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-14',
    category: 'correctness',
    contentCorrectionId: 'CC-14',
    sourceEvidence: [
      lineEvidence(
        98,
        [12],
        spanIds(98, 16, 20),
        '00786ab561f7ae16a46363497bc96a8ba4d0fe95937c36b67ffe061b1c74c4f2',
        '2bfee90d86ef4375870099410c6d205497bedb3fa76167580930b296f13b40b3',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(98, 16, 20),
      targetFragments: [childFragment('body-02608')],
    },
    expectedTargetFingerprint:
      'f3bff9177a230447555d37845cf4bd2e38bb30a00988ea8d51fbd8c8fa72275a',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0235-8-input-target', 'body-02608', [
          text(
            '一个包含T 个token 的原始sequence，在只使用sequence 内部的next token 时提供T−1 个训练目标。要得到长度为T 的input/target tensors，需要从原文取T+1 个连续token（或另有一个BOS/next token）。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-15',
    category: 'correctness',
    contentCorrectionId: 'CC-15',
    sourceEvidence: [
      lineEvidence(
        108,
        [27],
        ['p108-s00051'],
        '069dfbbcb55ca6bb2bdaa6af500221e3ffdf82fb4fb5bc3c582db2012ced9bf1',
        'd99533cb30265e32402936d77f091ec9dcd10df14c839a8e3528a4f203e8771e',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p108-s00051'],
      targetFragments: [childFragment('body-02881')],
    },
    expectedTargetFingerprint:
      '9fbddbade618f98c715728437edd1df6c70d1c0633fa3c327d4e1ab5d151785b',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0270-10-gpt-causal-mask', 'body-02881', [
          text(
            '使用紧接下来的zero-based positions：位置0 的input “我”负责预测target “喜欢”，因此不能看到位置1 的input “喜欢”或位置2 的input “AI”。位置1 负责预测“AI”，不是“喜欢”。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-16',
    category: 'correctness',
    contentCorrectionId: 'CC-16',
    sourceEvidence: [
      lineEvidence(
        113,
        [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
        spanIds(113, 5, 15),
        'f1450a4ef2c4a35376a51cd5749c8045575d2e2d70b804266d23af285a379793',
        '2580f3775473965d559516bf8ab1eb95a3064d06440ded68e1c36b82a5888194',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(113, 5, 15),
      targetFragments: numberedIds('body-', 2959, 2969).map(childFragment),
    },
    expectedTargetFingerprint:
      '98fd34166b175b4402c5747234fb0d7890f3586393d793bdf08de92b90fec4eb',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0286-week-8', 'body-02961', [
          text('LayerNorm → Self-Attention'),
        ]),
        paragraphPatch('o0286-week-8', 'body-02963', [
          text('Residual add with x'),
        ]),
        paragraphPatch('o0286-week-8', 'body-02965', [
          text('LayerNorm → Feed-Forward Network'),
        ]),
        paragraphPatch('o0286-week-8', 'body-02967', [text('Residual add')]),
      ],
      guardBlockIds: numberedIds('body-', 2959, 2969),
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-17',
    category: 'correctness',
    contentCorrectionId: 'CC-17',
    sourceEvidence: [
      lineEvidence(
        113,
        [37, 38, 39],
        spanIds(113, 57, 59),
        '3692e7a00e371dba5ff9b6e8983619a799c7973065b82e1420f33c20c1fd414d',
        '42a984390916dc4aa6db1ea70e00dab27fa78b82e786065f960424922691f408',
      ),
      lineEvidence(
        114,
        [1, 2],
        spanIds(114, 1, 2),
        'ef45e6e81a4fd6f1b54c7197a03a2b98af10525f9e22e74010a2e203af1f6b0d',
        '28d67fc9f7274265c09052a800513aa935fc772c739ea4ab24ff5546ba43df7f',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: [...spanIds(113, 57, 59), ...spanIds(114, 1, 2)],
      targetFragments: [
        childFragment('body-02988'),
        childFragment('body-02991'),
      ],
    },
    expectedTargetFingerprint:
      'e2e55cdce3df3ac6582ef92079d054e28b6a0b138987358de6115f484f6a8660',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0289-attention', 'body-02988', [
          text(
            '不带位置输入且不带位置相关mask 的self-attention 对token-row permutation 是equivariant。',
          ),
        ]),
        paragraphPatch('o0289-attention', 'body-02991', [
          text(
            'GPT 的固定causal mask 本身不对任意permutation 保持不变，因此已经提供了一部分顺序/前缀信息；显式position embeddings 或RoPE 仍然用于给模型直接、稳定的绝对或相对位置坐标。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-18',
    category: 'correctness',
    contentCorrectionId: 'CC-18',
    sourceEvidence: [
      lineEvidence(
        118,
        [42],
        ['p118-s00070'],
        '6b122894b45b95aa00b7e70ae450486a91fa55f9b6fab13d62c67b733bb94f0d',
        '646542b46a76df61b8fd0fb082dc53933fbeba844f89c5b9ec115b428613a89c',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p118-s00070'],
      targetFragments: [childFragment('body-03151')],
    },
    expectedTargetFingerprint:
      '623168c85bd74aaa5e060e6e6848d9e709b0a6135834ba6ae9d2eaa5ed923acf',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch(
          'o0308-13-transformer-output-vocabulary-logits',
          'body-03151',
          [
            text(
              '这是每个batch/position 都有V 个class logits 的模型输出布局。调用PyTorch cross_entropy 前，应reshape 为[B*T, V] 并把targets reshape 为[B*T]；也可把logits permute 为[B, V, T]，配合targets [B, T]。',
            ),
          ],
        ),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-19',
    category: 'correctness',
    contentCorrectionId: 'CC-19',
    sourceEvidence: [
      lineEvidence(
        125,
        [35, 36, 37, 38, 39],
        spanIds(125, 53, 61),
        '7f1e7378cbdd3425d86e826e3d33a55945f12c8227d6b25fc5cd4940aa945028',
        'bb004ce7ee3e7ba05e20a6c4c14aa521558299441c50c34c0345a89d367128a4',
      ),
      lineEvidence(
        126,
        [1, 2, 3],
        spanIds(126, 1, 5),
        '0c824527321afd2fcf31c2d21f71e3218bcb859189eb6ffa3f068e5a2d55b76d',
        '6cf94fb170eb90380184b374a91f9b4deff653fa4630a7858824e8facec9e964',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(126, 1, 5),
      targetFragments: [childFragment('body-03382')],
    },
    expectedTargetFingerprint:
      'aab8f465f3a99ae557f99636bdc8aa38cc00f533ceeac34bbe1ac20986d5e960',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0342-11-padding-attention-mask', 'body-03382', [
          text(
            'Padding mask 与causal mask 可能同时存在。前者处理batch 的矩形对齐，后者处理时间方向的信息边界。一个位置即使属于过去，如果它只是<PAD> 也不应被读取；一个位置即使是真实token，如果位于未来也不应被读取。以上padding mask 处理的是attention 的读取边界。若target tensors 也包含<PAD>，训练loss 还必须排除这些positions，例如使用cross_entropy(..., ignore_index=pad_id) 或显式per-token loss mask；否则普通mean cross entropy 会把PAD targets 计入训练与平均值。若保留PAD query positions，也应保证这些outputs 不参与目标loss。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-20',
    category: 'correctness',
    contentCorrectionId: 'CC-20',
    sourceEvidence: [
      lineEvidence(
        134,
        [32, 33],
        spanIds(134, 56, 62),
        'f1da683b4111846a281cb4a405c7811fbfd966d27398dbc1f706b874da9e3594',
        '1cb1baed809fb78a2078be309fe6294042f8751a5f0e3f0589d7e43f7d78602c',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(134, 56, 62),
      targetFragments: [childFragment('body-03699')],
    },
    expectedTargetFingerprint:
      '018f1887a0d69d70ebeac56d76847c818f914200f8640f270b9035c67b54db3e',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0363-8-modulelist', 'body-03699', [
          text(
            '子modules 通过赋值给Module attribute，或放入ModuleList/ModuleDict 来注册；可训练tensors 必须作为nn.Parameter 赋值给module，或放入ParameterList/ParameterDict；非parameter 状态用register_buffer。普通Python list 不会自动注册其中的modules 或tensors。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-21',
    category: 'correctness',
    contentCorrectionId: 'CC-21',
    sourceEvidence: [
      lineEvidence(
        145,
        [32, 33, 34],
        spanIds(145, 52, 58),
        '4a63d87544e0397afda6377d4940a3c7892c742d3bed72050e4fd47d01cea7d4',
        'fee42c69134e9d925bf80a16a2a77c3b53dd5ae95e15401dade214a51ec10fa7',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(145, 52, 58),
      targetFragments: [childFragment('body-04058')],
    },
    expectedTargetFingerprint:
      'ec6b3689e4692d188e23f38825c297c61b4b41c568c30a0d40e418036ae67c11',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0397-12-checkpoint', 'body-04058', [
          text(
            'Checkpoint 可以保存恢复训练所需的核心状态，但本附录只提供从头train 和从checkpoint generate，不承诺精确resume。若要在同一受支持环境中恢复到相同的下一步随机状态，除model、optimizer、已完成step、config 和tokenizer 外，还必须保持相同的corpus bytes/token stream、train/validation split、training hyperparameters 与control-flow schedule（包括evaluation 时机），恢复training mode、scheduler/GradScaler 等状态，并恢复训练路径实际消耗的所有RNG states。本例中get_batch 使用CPU torch RNG，dropout 使用活动device/backend RNG；当前代码没有sampler cursor，Python random 虽被seed 但训练后未被消耗。PyTorch 不保证跨release、平台或不同nondeterministic backend 的完全复现。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-22',
    category: 'correctness',
    contentCorrectionId: 'CC-22',
    sourceEvidence: [
      lineEvidence(
        147,
        [4],
        spanIds(147, 6, 8),
        'f47c6be8a2b013a9a7df30d4d9bf094bacd3ab5c40444426f9410bd6aae90130',
        'b92858498a051db5f48e950883769a2abfb2e62bda1f2d1f274a8f93a4b7a22c',
      ),
      lineEvidence(
        147,
        [5, 6, 7, 8, 9, 10],
        spanIds(147, 9, 30),
        'cd04bc06ed5519c0fa66ea27d8290766b73723d51812ce5341e2ab8c663f6ec4',
        '9019708c4ab371033330671c20ac94d52816a8cdb01d3893d1b52459803d20b1',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(147, 6, 8),
      targetFragments: [childFragment('body-04098')],
    },
    expectedTargetFingerprint:
      'b84dd62dcccff681330d8711459a8c39cdb3b66313711818dcbe83fe34a8a5d2',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0402-17-top-k-sampling', 'body-04098', [
          text(
            '保留所有不低于第k 大logit cutoff 的候选；若cutoff 处并列，可能超过k 个，其余设置为负无穷：',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-23',
    category: 'correctness',
    contentCorrectionId: 'CC-23',
    sourceEvidence: [
      lineEvidence(
        96,
        [26],
        ['p096-s00045'],
        'aeebfdcd9b83e3580b290f52e915c3d08a727a9aa1d7a8e4e9f16b3d0351bd29',
        '5525198aa9fcb051f2cf106bb815df9b44430edacd53c8767fa5a398d270c82e',
      ),
      lineEvidence(
        154,
        [13],
        ['p154-s00019'],
        'b53c586143b897955da46b4ea0a52c53f3f6962d1e42a6c472d48c6934be74e8',
        '672ffb68d848d6a51758ed601c48d93f2dd6acea521a1aa5691d1751066d54c2',
      ),
      lineEvidence(
        154,
        [15, 16, 17],
        spanIds(154, 21, 23),
        '6fe3273366b4535c4b2cdde3636e466f9bcffae603aa42a0fa4bbb911788bea1',
        '036ef54fe40a1997d1894c2e6f299939a394325b02b92c17b0ced4b98f901e0c',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: ['p096-s00045', 'p154-s00019', ...spanIds(154, 21, 23)],
      targetFragments: [
        childFragment('body-02556'),
        childFragment('body-04366'),
        childFragment('body-04368'),
      ],
    },
    expectedTargetFingerprint:
      'e227b6e861424af335bc64702faa617339314c2769fdfeeb5634e387349ab58e',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0230-5-embedding', 'body-02556', [
          text(
            'Embedding lookup 这条路径只给被索引的rows 产生lookup gradient。',
          ),
        ]),
        paragraphPatch('o0425-11-embedding-rows', 'body-04366', [
          text(
            'Embedding lookup 这条路径只给被索引的rows 产生lookup gradient。',
          ),
        ]),
        paragraphPatch('o0425-11-embedding-rows', 'body-04368', [
          text(
            '但本课程参考模型把embedding weight 与LM-head weight tying；作为输出矩阵时，所有vocabulary rows 通常都会从cross-entropy 收到dense gradient。即使没有tying，AdamW 的decoupled weight decay（以及既有optimizer moments）也可能改变当前lookup gradient 为零的rows。因此不能把“未被lookup”直接等同于“该step 参数不更新”。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-24',
    category: 'correctness',
    contentCorrectionId: 'CC-24',
    sourceEvidence: [
      lineEvidence(
        157,
        [6, 7],
        spanIds(157, 6, 9),
        'b4ff48627e126e1e18dc373e903f0674950b54565f162c89eafa4785055f386c',
        'b0814757b9128682d7821f76bd04af5db3f75db54b61b67d3a0d9294f6493978',
      ),
    ],
    sourceProjection: {
      kind: 'replace',
      sourceSpanIds: spanIds(157, 6, 9),
      targetFragments: [childFragment('body-04472')],
    },
    expectedTargetFingerprint:
      '39a16bd59646e3d92a75d4a5497c904f149ac61b860c60725feabed6b03c1a62',
    target: {
      kind: 'paragraph',
      patches: [
        paragraphPatch('o0435-18-character-tokenizer-subword', 'body-04472', [
          text(
            '独立意味着可以替换实现；耦合意味着替换时必须同步更新V、embedding 的vocabulary rows、LM Head 的vocabulary axis（数学记号',
          ),
          inlineMath(
            'W_{\\mathrm{vocab}} \\in \\mathbb{R}^{C \\times V}',
            'W_vocab ∈ R^(C×V)',
          ),
          text('中是columns；PyTorch 的'),
          inlineCode('lm_head.weight'),
          inlineMath('\\in \\mathbb{R}^{V \\times C}', '∈ R^(V×C)'),
          text(
            '中是rows），以及checkpoint metadata。接口独立不等于语义可以任意互换。',
          ),
        ]),
      ],
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
  {
    correctionId: 'CC-25',
    category: 'correctness',
    contentCorrectionId: 'CC-25',
    sourceEvidence: [CC25_SOURCE_EVIDENCE],
    sourceProjection: { kind: 'sourceOnlyNormalization' },
    expectedTargetFingerprint:
      '3555afd5e8200838625ef40a67bef1029eb21df34a063452b2ef944fb2ec6803',
    target: {
      kind: 'sourceOnlyNoop',
      sectionId: 'o0460-a-mini-gpt',
      comparisonBlockIds: ['body-04576', 'code-appendix-a-mini-gpt'],
      reason:
        'The website already normalizes source U+2011 non-breaking hyphens to ASCII U+002D.',
    },
    reviewer: CORRECTNESS_REVIEWER,
    status: 'reviewed',
  },
];

export const COURSE_CONTENT_CORRECTIONS: readonly ReviewedCourseCorrection[] =
  deepFreeze([
    ...BODY_INLINE_CORRECTIONS,
    ...CORRECTNESS_CORRECTIONS_01_10,
    ...CORRECTNESS_CORRECTIONS_11_25,
  ]);

export type CourseContentCorrectionIndex = {
  byCorrectionId: ReadonlyMap<string, ReviewedCourseCorrection>;
  byInlineCandidateId: ReadonlyMap<string, ReviewedCourseCorrection>;
  formulaByBlockId: ReadonlyMap<string, ReviewedFormula>;
};

function failCorrection(message: string): never {
  throw new Error(`Course content correction ledger: ${message}`);
}

function sameValues<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export function courseContentCorrectionFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function courseContentCorrectionOutcome(
  correction: ReviewedCourseCorrection,
): CourseCorrectionOutcome {
  if (correction.target.kind === 'formulaReference')
    return 'assertedFormulaReference';
  if (correction.target.kind === 'excludedNavigation')
    return 'excludedNavigation';
  if (correction.target.kind === 'sourceOnlyNoop') return 'sourceOnlyNoop';
  if (correction.sourceProjection.kind === 'unchangedSemanticBlock')
    return 'semanticNoop';
  return 'applied';
}

export function isPageLinesSourceEvidence(
  evidence: SourceEvidence,
): evidence is PageLinesSourceEvidence {
  return evidence.kind === 'pageLines';
}

export function isCrossPageSelectorSourceEvidence(
  evidence: SourceEvidence,
): evidence is CrossPageSelectorSourceEvidence {
  return evidence.kind === 'crossPageSelector';
}

function hasExactKeys(value: object, expectedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value).sort();
  return sameValues(actualKeys, [...expectedKeys].sort());
}

function assertPageLinesEvidence(
  evidence: PageLinesSourceEvidence,
  pagesByNumber: ReadonlyMap<number, SourceAudit['pages'][number]>,
): void {
  if (
    !hasExactKeys(evidence, [
      'kind',
      'pdfPage',
      'lineIndexes',
      'sourceSpanIds',
      'sourceChecksum',
      'sourceGeometryChecksum',
    ])
  ) {
    failCorrection(`page ${evidence.pdfPage} evidence wire shape changed`);
  }
  const page =
    pagesByNumber.get(evidence.pdfPage) ??
    failCorrection(`missing source page ${evidence.pdfPage}`);
  const spans = spansForLines(page, [...evidence.lineIndexes]);
  if (
    !sameValues(
      spans.map((span) => span.id),
      evidence.sourceSpanIds,
    )
  ) {
    failCorrection(
      `ordered source spans changed on page ${evidence.pdfPage} lines ${evidence.lineIndexes.join(',')}`,
    );
  }
  if (spanChecksum(spans) !== evidence.sourceChecksum) {
    failCorrection(
      `historical source checksum changed on page ${evidence.pdfPage}`,
    );
  }
  if (
    formulaSourceGeometryChecksum(spans) !== evidence.sourceGeometryChecksum
  ) {
    failCorrection(
      `source geometry checksum changed on page ${evidence.pdfPage}`,
    );
  }
}

function selectedLineIndexes(
  audit: SourceAudit,
  sourceSpanIds: ReadonlySet<string>,
  firstPage: number,
  lastPage: number,
): Record<string, number[]> {
  return Object.fromEntries(
    audit.pages
      .filter((page) => page.pdfPage >= firstPage && page.pdfPage <= lastPage)
      .map((page) => ({
        pdfPage: page.pdfPage,
        lineIndexes: page.lines
          .map((line, lineIndex) =>
            line.spanIds.some((spanId) => sourceSpanIds.has(spanId))
              ? lineIndex
              : -1,
          )
          .filter((lineIndex) => lineIndex >= 0),
      }))
      .filter(({ lineIndexes }) => lineIndexes.length > 0)
      .map(({ pdfPage, lineIndexes }) => [`p${pdfPage}`, lineIndexes]),
  );
}

function assertCrossPageSelectorEvidence(
  evidence: CrossPageSelectorSourceEvidence,
  audit: SourceAudit,
): void {
  if (
    !hasExactKeys(evidence, [
      'kind',
      'pageRange',
      'selector',
      'lineIndexesByPage',
      'sourceSpanIds',
      'sourceChecksum',
      'sourceGeometryChecksum',
    ]) ||
    evidence.pageRange.length !== 2 ||
    evidence.pageRange[0] !== 161 ||
    evidence.pageRange[1] !== 169 ||
    evidence.selector !== 'textRaw-includes-U+2011'
  ) {
    failCorrection('CC-25 cross-page selector wire shape changed');
  }
  const [firstPage, lastPage] = evidence.pageRange;
  const spans = audit.pages
    .filter((page) => page.pdfPage >= firstPage && page.pdfPage <= lastPage)
    .flatMap((page) =>
      page.spans.filter((span) => span.textRaw.includes('\u2011')),
    );
  const sourceSpanIds = spans.map((span) => span.id);
  const lineIndexesByPage = selectedLineIndexes(
    audit,
    new Set(sourceSpanIds),
    firstPage,
    lastPage,
  );
  const occurrenceCount = spans.reduce(
    (count, span) => count + span.textRaw.split('\u2011').length - 1,
    0,
  );

  if (
    spans.length !== CC25_EXPECTED_SPAN_COUNT ||
    Object.values(lineIndexesByPage).reduce(
      (count, lineIndexes) => count + lineIndexes.length,
      0,
    ) !== CC25_EXPECTED_LINE_COUNT ||
    occurrenceCount !== CC25_EXPECTED_OCCURRENCE_COUNT ||
    !sameValues(sourceSpanIds, evidence.sourceSpanIds) ||
    courseContentCorrectionFingerprint(sourceSpanIds) !==
      CC25_SOURCE_SPAN_ID_CHECKSUM ||
    spanChecksum(spans) !== evidence.sourceChecksum ||
    formulaSourceGeometryChecksum(spans) !== evidence.sourceGeometryChecksum ||
    JSON.stringify(lineIndexesByPage) !==
      JSON.stringify(evidence.lineIndexesByPage)
  ) {
    failCorrection('CC-25 cross-page selector source evidence changed');
  }
}

const MULTI_PAGE_LINE_EVIDENCE_COUNTS = new Map<string, number>([
  ['CC-06', 2],
  ['CC-17', 2],
  ['CC-19', 2],
  ['CC-22', 2],
  ['CC-23', 3],
]);

export function assertCourseCorrectionSourceEvidence(
  correction: ReviewedCourseCorrection,
  audit: SourceAudit,
): void {
  const pagesByNumber = new Map(
    audit.pages.map((page) => [page.pdfPage, page]),
  );
  if (correction.sourceEvidence.length === 0) {
    failCorrection(`${correction.correctionId} has no source evidence`);
  }
  const pageLinesEvidence = correction.sourceEvidence.filter(
    isPageLinesSourceEvidence,
  );
  const crossPageSelectorEvidence = correction.sourceEvidence.filter(
    isCrossPageSelectorSourceEvidence,
  );
  const isCrossPageCorrection = correction.correctionId === 'CC-25';
  const expectedPageLinesCount = isCrossPageCorrection
    ? 0
    : (MULTI_PAGE_LINE_EVIDENCE_COUNTS.get(correction.correctionId) ?? 1);
  if (
    pageLinesEvidence.length !== expectedPageLinesCount ||
    crossPageSelectorEvidence.length !== (isCrossPageCorrection ? 1 : 0) ||
    correction.sourceEvidence.length !==
      expectedPageLinesCount + (isCrossPageCorrection ? 1 : 0)
  ) {
    failCorrection(
      `${correction.correctionId} source-evidence cardinality or kind changed`,
    );
  }
  for (const evidence of correction.sourceEvidence) {
    if (isPageLinesSourceEvidence(evidence)) {
      assertPageLinesEvidence(evidence, pagesByNumber);
    } else if (isCrossPageSelectorSourceEvidence(evidence)) {
      assertCrossPageSelectorEvidence(evidence, audit);
    } else {
      failCorrection(
        `${correction.correctionId} has an unknown source-evidence kind`,
      );
    }
  }

  if (correction.sourceProjection.kind === 'replace') {
    const guardedSpanIds = correction.sourceEvidence.flatMap(
      (evidence) => evidence.sourceSpanIds,
    );
    const projectedSpanIds = correction.sourceProjection.sourceSpanIds;
    let guardedIndex = -1;
    const isOrderedSubsequence = projectedSpanIds.every((spanId) => {
      guardedIndex = guardedSpanIds.indexOf(spanId, guardedIndex + 1);
      return guardedIndex >= 0;
    });
    if (
      new Set(guardedSpanIds).size !== guardedSpanIds.length ||
      projectedSpanIds.length === 0 ||
      new Set(projectedSpanIds).size !== projectedSpanIds.length ||
      !isOrderedSubsequence ||
      correction.sourceProjection.targetFragments.length === 0
    ) {
      failCorrection(
        `${correction.correctionId} has an invalid source-side replacement projection`,
      );
    }
  }
}

const EXPECTED_INLINE_CANDIDATE_IDS = [
  'math-p006-g000',
  'math-p006-g001',
  'math-p105-g003',
  'math-p107-g005',
  'math-p107-g006',
  'math-p109-g000',
  'math-p110-g003',
  'math-p116-g001',
  'math-p149-g000',
  'math-p154-g000',
] as const;

const EXPECTED_BODY_CORRECTION_IDS = [
  'body-fraction-p023-gradient',
  'body-fraction-p025-chain-rule',
  'body-fraction-p025-result',
  'body-neuron-nodes-p071',
  'body-value-dv-p108',
  'body-row42-p125',
] as const;

const EXPECTED_INLINE_CORRECTION_IDS = [
  'inline-math-p006-g000',
  'inline-math-p006-g001',
  'inline-math-p105-g003',
  'inline-math-p107-g005',
  'inline-math-p107-g006',
  'inline-math-p109-g000',
  'inline-math-p110-g003',
  'inline-math-p116-g001',
  'inline-math-p149-g000',
  'inline-math-p154-g000',
] as const;

const EXPECTED_FORMULA_REFERENCES = new Map<string, readonly string[]>([
  ['CC-01', ['formula-math-p018-g003']],
  [
    'CC-04',
    ['formula-p032-l0017', 'formula-p032-l0019-21', 'formula-p032-l0023-25'],
  ],
  ['CC-08', ['formula-math-p072-g000']],
]);

function assertFormulaReferences(
  byCorrectionId: ReadonlyMap<string, ReviewedCourseCorrection>,
  formulaByBlockId: ReadonlyMap<string, ReviewedFormula>,
): void {
  for (const [correctionId, expectedBlockIds] of EXPECTED_FORMULA_REFERENCES) {
    const correction =
      byCorrectionId.get(correctionId) ??
      failCorrection(`missing ${correctionId}`);
    if (
      correction.target.kind !== 'formulaReference' ||
      correction.target.action !== 'assertFormulaReviewLedger' ||
      !sameValues(correction.target.blockIds, expectedBlockIds)
    ) {
      failCorrection(`${correctionId} formula-reference target changed`);
    }
    for (const blockId of expectedBlockIds) {
      const formula =
        formulaByBlockId.get(blockId) ??
        failCorrection(`${correctionId} references missing formula ${blockId}`);
      const expectedContentCorrectionId =
        blockId === 'formula-p032-l0017' ? undefined : correctionId;
      if (formula.contentCorrectionId !== expectedContentCorrectionId) {
        failCorrection(
          `${blockId} has an unexpected content-correction assignment`,
        );
      }
    }
  }
}

export function assertCourseContentCorrectionLedger(
  audit: SourceAudit,
  candidateDecisions: readonly CandidateReviewDecision[],
  formulaReviewLedger: FormulaReviewLedger,
): CourseContentCorrectionIndex {
  const expectedCorrectionIds = [
    ...EXPECTED_BODY_CORRECTION_IDS,
    ...EXPECTED_INLINE_CORRECTION_IDS,
    ...Array.from(
      { length: 25 },
      (_, index) => `CC-${String(index + 1).padStart(2, '0')}`,
    ),
  ];
  const actualCorrectionIds = COURSE_CONTENT_CORRECTIONS.map(
    (correction) => correction.correctionId,
  );
  if (
    COURSE_CONTENT_CORRECTIONS.length !== 41 ||
    !sameValues(actualCorrectionIds, expectedCorrectionIds) ||
    new Set(actualCorrectionIds).size !== COURSE_CONTENT_CORRECTIONS.length
  ) {
    failCorrection('record count, order, or correction IDs changed');
  }

  const byCorrectionId = new Map(
    COURSE_CONTENT_CORRECTIONS.map((correction) => [
      correction.correctionId,
      correction,
    ]),
  );
  const inlineCorrections = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) => correction.category === 'inlineMath',
  );
  const byInlineCandidateId = new Map(
    inlineCorrections.map((correction) => [
      correction.candidateId!,
      correction,
    ]),
  );
  const formulaByBlockId = new Map(
    formulaReviewLedger.formulas.map((formula) => [formula.blockId, formula]),
  );
  const categoryCounts = new Map<ReviewedCourseCorrection['category'], number>([
    ['fidelity', 0],
    ['inlineMath', 0],
    ['correctness', 0],
  ]);
  const outcomeCounts = new Map<CourseCorrectionOutcome, number>([
    ['applied', 0],
    ['assertedFormulaReference', 0],
    ['semanticNoop', 0],
    ['sourceOnlyNoop', 0],
    ['excludedNavigation', 0],
  ]);
  for (const correction of COURSE_CONTENT_CORRECTIONS) {
    categoryCounts.set(
      correction.category,
      categoryCounts.get(correction.category)! + 1,
    );
    const outcome = courseContentCorrectionOutcome(correction);
    outcomeCounts.set(outcome, outcomeCounts.get(outcome)! + 1);
    const isCorrectness = correction.category === 'correctness';
    if (
      correction.status !== 'reviewed' ||
      !correction.reviewer.trim() ||
      (isCorrectness
        ? correction.contentCorrectionId !== correction.correctionId ||
          correction.candidateId !== undefined ||
          correction.reviewer !== CORRECTNESS_REVIEWER
        : correction.contentCorrectionId !== undefined) ||
      (correction.category === 'fidelity' &&
        (correction.candidateId !== undefined ||
          correction.reviewer !== BODY_REVIEWER)) ||
      (correction.category === 'inlineMath' &&
        (!correction.candidateId || correction.reviewer !== INLINE_REVIEWER)) ||
      (correction.expectedTargetFingerprint === null) !==
        (outcome === 'excludedNavigation')
    ) {
      failCorrection(`${correction.correctionId} metadata changed`);
    }
    assertCourseCorrectionSourceEvidence(correction, audit);
  }

  const allSourceEvidence = COURSE_CONTENT_CORRECTIONS.flatMap(
    (correction) => correction.sourceEvidence,
  );
  if (
    allSourceEvidence.filter(isPageLinesSourceEvidence).length !== 46 ||
    allSourceEvidence.filter(isCrossPageSelectorSourceEvidence).length !== 1 ||
    allSourceEvidence.length !== 47
  ) {
    failCorrection('expected exactly 46 page-lines and 1 cross-page evidence');
  }

  if (
    categoryCounts.get('fidelity') !== 6 ||
    categoryCounts.get('inlineMath') !== 10 ||
    categoryCounts.get('correctness') !== 25 ||
    outcomeCounts.get('applied') !== 34 ||
    outcomeCounts.get('assertedFormulaReference') !== 3 ||
    outcomeCounts.get('semanticNoop') !== 1 ||
    outcomeCounts.get('sourceOnlyNoop') !== 1 ||
    outcomeCounts.get('excludedNavigation') !== 2
  ) {
    failCorrection('category or outcome counts changed');
  }

  const reviewedInlineCandidateIds = candidateDecisions
    .filter(
      (decision) =>
        decision.category === 'formula' &&
        decision.disposition === 'inlineMath',
    )
    .map((decision) => decision.candidateId);
  if (
    byInlineCandidateId.size !== EXPECTED_INLINE_CANDIDATE_IDS.length ||
    !sameValues(
      inlineCorrections.map((correction) => correction.candidateId!),
      EXPECTED_INLINE_CANDIDATE_IDS,
    ) ||
    !sameValues(reviewedInlineCandidateIds, EXPECTED_INLINE_CANDIDATE_IDS)
  ) {
    failCorrection('inline-math candidate coverage changed');
  }

  const excludedIds = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) =>
      courseContentCorrectionOutcome(correction) === 'excludedNavigation',
  ).map((correction) => correction.candidateId);
  const excludedCorrections = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) => correction.target.kind === 'excludedNavigation',
  );
  const sourceOnlyCorrection = byCorrectionId.get('CC-25');
  const semanticNoop = byInlineCandidateId.get('math-p154-g000');
  if (
    !sameValues(excludedIds, ['math-p006-g000', 'math-p006-g001']) ||
    excludedCorrections.some(
      (correction) =>
        correction.target.kind !== 'excludedNavigation' ||
        correction.target.reason !== PRINTED_TOC_REASON ||
        correction.sourceProjection.kind !== 'excludedNavigation' ||
        correction.sourceEvidence.some(
          (evidence) => evidence.kind !== 'pageLines' || evidence.pdfPage !== 6,
        ),
    ) ||
    !sourceOnlyCorrection ||
    courseContentCorrectionOutcome(sourceOnlyCorrection) !== 'sourceOnlyNoop' ||
    sourceOnlyCorrection.sourceProjection.kind !== 'sourceOnlyNormalization' ||
    !semanticNoop ||
    courseContentCorrectionOutcome(semanticNoop) !== 'semanticNoop' ||
    semanticNoop.sourceProjection.kind !== 'unchangedSemanticBlock'
  ) {
    failCorrection('reviewed no-op/exclusion dispositions changed');
  }

  assertFormulaReferences(byCorrectionId, formulaByBlockId);
  return { byCorrectionId, byInlineCandidateId, formulaByBlockId };
}

const reviewed = {
  reviewer: 'Codex rendered-source correction review',
  status: 'reviewed' as const,
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
