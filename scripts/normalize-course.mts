import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import type {
  ContentBlock,
  Course,
  InlineNode,
  PageManifestEntry,
  SectionNode,
} from '../src/content/schema';
import {
  APPENDIX_CORRECTION,
  CODE_CORRECTIONS,
  FORMULA_CORRECTIONS,
  KNOWLEDGE_CHECK_OUTLINE_INDEXES,
  TABLE_CORRECTIONS,
  type LineRangeCorrection,
} from './content-corrections.mts';
import {
  assertCorrectionBackedDecision,
  candidateFingerprint,
  decisionMap,
  readCandidateReviewLedger,
  type CandidateCategory,
  type CandidateReviewDecision,
} from './candidate-review-ledger.mts';
import { CONTENT_REVIEW_TRUST_ROOT } from './content-review-trust-root.mts';
import { deriveSourceHeadingAnchors } from './source-heading-anchors.mts';
import { transcribeOneLineFormula } from './formula-transcription.mts';
import {
  detectCodeCandidates,
  detectFormulaCandidates,
  detectKnowledgeCandidates,
  detectTableCandidates,
  formulaGeometryChecksum,
  readSourceAudit,
  type DetectedCandidate,
  type FormulaCandidate,
  type RawSpan,
  type SourceAudit,
} from './source-audit.mts';

const EXPECTED_SHA256 =
  '3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52';
const SOURCE_PATH =
  'C:\\Users\\Chao\\Desktop\\AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf';
const SOURCE_AUDIT_PATH = path.resolve(
  'src/content/source-audit.generated.json.gz',
);
const REVIEW_LEDGER_PATH = path.resolve(
  'src/content/candidate-review-ledger.json',
);
const PUBLIC_FILENAME =
  'AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf';
const GENERATED_AT = '2026-09-03';
const EXPECTED_FORMULA_GEOMETRY_SHA256 =
  '6cec7a69ffed7bf9d204d0fa311309f0c56bb763cd1f2e3af1892df1b9e0e269';

const MISSING_HAT_SOURCE_CHECKSUMS: Readonly<Record<string, string>> = {
  'math-p020-g003':
    '86da7c2fa2cd49ca43c42fd35562519b3bd0b893182569f86396d77aa5d2879f',
  'math-p022-g000':
    '41b3040e84fc65e64fa952982b46371aa0295adbd369ed9a08e6558c1df9c618',
  'math-p025-g000':
    'c7389e27311bac8bfdfd383fa7b43d4eaaa3abb849002a86893ca7f41c475a1a',
  'math-p025-g001':
    'd991f8afea4d54adeba0df3e88d627f21e285c8d7dd58ba718003f7f1e407313',
  'math-p025-g004':
    'b8dc53a6ddf1420313e82df95d00d8d7c8d383e8d88558d14851386e3d1f554a',
  'math-p026-g002':
    'dd87a5e819a5d01350486454c0245cc8ee71b4fd89ea8af2551b25afb2fe797f',
  'math-p026-g003':
    'e71b9e8f571c16a58ab7c2b82fcf45e332b7a90c63b77d61e14bd3dfb4b462ef',
  'math-p027-g002':
    '2f208956ae31a394434f8e8ee84f6d85cf599afdb03c90fad9cf271756fdc16c',
  'math-p029-g001':
    '343c5f513edbf182bea79c0193bc4d589b5502507999d5d8c24faf47b2deb169',
  'math-p029-g002':
    '4734e3392dc6a5bea06d2d0af1f7dc298734c685bb6379d002178a2f2cd1e50e',
  'math-p030-g000':
    '80d8dd044a4fb4976287a770977891ab5a7c20df082209b369f52ea21f77f785',
  'math-p036-g001':
    '92c5bc400056210756d1adbe85a1f5c82a2341bdb952a370c88695e647309ab5',
  'math-p037-g000':
    '8193a0d169abde92b5d6f9474b5505f9ab6a0445ce0bd0fb6a75db6540cf0193',
  'math-p052-g001':
    '67157c3e841b0caa60f0c045389ba62a2c3be931a764ad1ff5dda4e13a2e7677',
  'math-p054-g000':
    'a05f25ca993aa8b7e07346f02f89b264b6d92fab4a3efc09195be565dc60d9fc',
  'math-p062-g000':
    '494ef46a1c61184fb5c0fe5c943a9d8d70aaceeb66727949ecf0e36ee3e20305',
  'math-p062-g002':
    '8fb0fa230909119eedd0cd658771a846c058a31083b93c907cb56b728bf978b5',
  'math-p075-g000':
    '6ae7109c858ccd86db060454a33d05a7594663fb3ee393a5b8d3623c38efe3ee',
  'math-p076-g002':
    'a19391f2ef7d30aefc679b0e131bcc2e9cebc9dc79c1e45deee25f38165b0657',
  'math-p079-g002':
    '245e59c1a49d62ca29f8a285e13c6f94605d12e9631f410abeaa1b9772ed5832',
  'math-p081-g005':
    'fa39f1a2f220351fdde28f0ecb97ded138ae1e49451717151cfc497674689080',
  'math-p088-g001':
    'e5b65e9449743f8de88eb4c424eddb39b07fd725a4ebcd87f8f219434d62b72c',
  'math-p137-g000':
    'cc54429c0875086f246c239d2cd8ca481d0bda1acdc014de67caa4a07ae2483b',
};

const TRAILING_CIRCUMFLEX_SOURCE_CHECKSUMS: Readonly<Record<string, string>> = {
  'math-p076-g001':
    'a1c073d285c9697cb3ccb695de31899f58e04ae04a94b2a3133a47b7a1b082d4',
  'math-p081-g004':
    '4b0b410ec71d9b864dac2dfdd61b49d66ddb07fc655bee9c71e141917fe5b196',
};

type RawLine = {
  id: string;
  spanIds: string[];
  lineRaw: string;
  bbox: [number, number, number, number];
};
type RawPage = {
  pdfPage: number;
  rawText: string;
  printedPageLabel: string | null;
  spans: RawSpan[];
  lines: RawLine[];
};
type RawOutline = {
  outlineIndex: number;
  parentOutlineIndex: number | null;
  depth: number;
  titleRaw: string;
  pdfPage: number;
};
type RawExtraction = {
  source: {
    filename: string;
    sha256: string;
    pageCount: number;
    extractorVersions: Record<string, string>;
  };
  outline: RawOutline[];
  pages: RawPage[];
};
type SpecialCandidate = {
  candidateId: string;
  type: 'formula' | 'table' | 'code' | 'knowledgeCheck';
  pdfPages: number[];
  sourceSpanIds: string[];
  sourceChecksum: string;
  reviewer: string;
  status: 'reviewed';
  disposition: string;
  blockId?: string;
};

type CandidateAudit = {
  candidateId: string;
  category: 'formula' | 'table' | 'code' | 'knowledgeCheck';
  pdfPage: number;
  lineIndexes: number[];
  sourceSpanIds: string[];
  sourceChecksum: string;
  detector: string;
  reviewer: string;
  status: 'reviewed';
  disposition:
    | 'structuredFormula'
    | 'inlineMath'
    | 'table'
    | 'notTable'
    | 'code'
    | 'notCode'
    | 'knowledgeCheck'
    | 'notKnowledgeCheck';
  rationale: string;
  blockId?: string;
};

const raw = readSourceAudit(SOURCE_AUDIT_PATH) as RawExtraction;
const reviewLedgerBytes = readFileSync(REVIEW_LEDGER_PATH);
if (
  sha256(reviewLedgerBytes) !== CONTENT_REVIEW_TRUST_ROOT.candidateLedgerSha256
) {
  fail('Pinned review ledger bytes changed');
}
const reviewLedger = readCandidateReviewLedger(REVIEW_LEDGER_PATH);

function fail(message: string): never {
  throw new Error(message);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHyphens(value: string): string {
  return value.replace(/[‐‑–−]/g, '-').replaceAll('\u00a0', ' ');
}

function runtimeText(value: string): string {
  return normalizeHyphens(value)
    .replaceAll('\u0000', '')
    .replace(/\s*→\s*/g, ' → ')
    .trim();
}

function joinWrappedText(left: string, right: string): string {
  if (left.endsWith('-') && /^\p{L}/u.test(right))
    return `${left.slice(0, -1)}${right}`;
  if (/\p{Script=Latin}$/u.test(left) && /^\p{Script=Latin}/u.test(right))
    return `${left} ${right}`;
  return `${left}${right}`;
}

const TEXT_LATEX_SYMBOLS: Readonly<Record<string, string>> = {
  '⋅': '\\cdot',
  '×': '\\times',
  '∑': '\\sum',
  '≤': '\\le',
  '≥': '\\ge',
  '≈': '\\approx',
  '∞': '\\infty',
  '∂': '\\partial',
  '∇': '\\nabla',
  θ: '\\theta',
  α: '\\alpha',
  ε: '\\varepsilon',
  σ: '\\sigma',
  Δ: '\\Delta',
  μ: '\\mu',
  γ: '\\gamma',
  β: '\\beta',
  '√': '\\surd',
  '→': '\\rightarrow',
  '←': '\\leftarrow',
  '′': "'",
  '∼': '\\sim',
  '∶': ':',
  '∈': '\\in',
  '∣': '\\mid',
  '∏': '\\prod',
  '∝': '\\propto',
  '⋯': '\\cdots',
  '…': '\\ldots',
};

function escapeLatexText(value: string): string {
  return value
    .replace(/\\/gu, '\\textbackslash{}')
    .replace(/([{}%$#&_])/gu, '\\$1')
    .replace(/\^/gu, '\\textasciicircum{}')
    .replace(/~/gu, '\\textasciitilde{}');
}

function textLatex(value: string): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[⎡⎢⎣]/gu, '[')
    .replace(/[⎤⎥⎦]/gu, ']');
  const fragments: string[] = [];
  let text = '';

  function flushText(): void {
    if (!text) return;
    fragments.push(`\\text{${escapeLatexText(text)}}`);
    text = '';
  }

  for (const character of normalized) {
    const symbolLatex = TEXT_LATEX_SYMBOLS[character];
    if (symbolLatex) {
      flushText();
      fragments.push(symbolLatex);
      continue;
    }
    if (!/[\x20-\x7E\p{Script=Han}]/u.test(character)) {
      const codePoint = character.codePointAt(0)?.toString(16).toUpperCase();
      fail(
        `Unsupported formula symbol U+${codePoint ?? 'UNKNOWN'} in ${JSON.stringify(value)}`,
      );
    }
    text += character;
  }
  flushText();
  return fragments.join(' ');
}

function tokenSequence(value: string): string[] {
  return (
    normalizeHyphens(value.replace(/[‐‑–−]\r?\n(?=\p{L})/gu, ''))
      .normalize('NFC')
      .replaceAll('\u0000', '')
      .replace(/(\p{Script=Han})/gu, ' $1 ')
      .match(/[\p{L}\p{N}_]+|[^\s]/gu) ?? []
  );
}

function stableSlug(title: string, outlineIndex: number): string {
  if (outlineIndex === 0) return 'readme';
  const ascii = normalizeHyphens(title)
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
  return ascii || 'section';
}

function sectionId(outline: RawOutline): string {
  return `o${outline.outlineIndex.toString().padStart(4, '0')}-${stableSlug(outline.titleRaw, outline.outlineIndex)}`;
}

function sourceRef(pdfPage: number) {
  return {
    pdfPage,
    ...(pdfPage >= 10 ? { printedPageLabel: String(pdfPage - 9) } : {}),
  };
}

function spanChecksum(spans: RawSpan[]): string {
  return sha256(
    JSON.stringify(
      spans.map(({ id, textRaw, font, size, bbox }) => ({
        id,
        textRaw,
        font,
        size,
        bbox,
      })),
    ),
  );
}

function pageByNumber(pdfPage: number): RawPage {
  return raw.pages[pdfPage - 1] ?? fail(`Missing raw page ${pdfPage}`);
}

function spansForLineIndexes(
  pdfPage: number,
  lineIndexes: number[],
): RawSpan[] {
  const page = pageByNumber(pdfPage);
  const spans = new Map(page.spans.map((span) => [span.id, span]));
  return lineIndexes.flatMap((lineIndex) => {
    const line =
      page.lines[lineIndex] ??
      fail(`Missing line ${lineIndex} on physical page ${pdfPage}`);
    return line.spanIds.map(
      (spanId) => spans.get(spanId) ?? fail(`Missing source span ${spanId}`),
    );
  });
}

function matchesPinnedCandidate(
  signal: FormulaCandidate,
  pins: Readonly<Record<string, string>>,
  reason: string,
): boolean {
  const expectedChecksum = pins[signal.candidateId];
  if (!expectedChecksum) return false;
  if (signal.sourceChecksum !== expectedChecksum) {
    fail(
      `${signal.candidateId} ${reason} checksum mismatch: expected ${expectedChecksum}, got ${signal.sourceChecksum}`,
    );
  }
  return true;
}

function hasAdjacentStackedRows(signal: FormulaCandidate): boolean {
  if (signal.lineIndexes.length !== 1) return true;
  const page = pageByNumber(signal.pdfPage);
  const lineIndex = signal.lineIndexes[0];
  const formulaLine = page.lines[lineIndex];
  const formulaHeight = formulaLine.bbox[3] - formulaLine.bbox[1];
  const formulaCenterY = (formulaLine.bbox[1] + formulaLine.bbox[3]) / 2;
  const nearby = page.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => {
      if (index === lineIndex) return false;
      const centerY = (line.bbox[1] + line.bbox[3]) / 2;
      const horizontalGap = Math.max(
        0,
        formulaLine.bbox[0] - line.bbox[2],
        line.bbox[0] - formulaLine.bbox[2],
      );
      return (
        Math.abs(centerY - formulaCenterY) <= formulaHeight * 0.8 &&
        horizontalGap <= formulaHeight
      );
    });

  for (const upper of nearby) {
    const upperCenterY = (upper.line.bbox[1] + upper.line.bbox[3]) / 2;
    if (upperCenterY >= formulaCenterY - formulaHeight * 0.15) continue;
    for (const lower of nearby) {
      const lowerCenterY = (lower.line.bbox[1] + lower.line.bbox[3]) / 2;
      if (lowerCenterY <= formulaCenterY + formulaHeight * 0.15) continue;
      const overlap =
        Math.min(upper.line.bbox[2], lower.line.bbox[2]) -
        Math.max(upper.line.bbox[0], lower.line.bbox[0]);
      const narrowerWidth = Math.min(
        upper.line.bbox[2] - upper.line.bbox[0],
        lower.line.bbox[2] - lower.line.bbox[0],
      );
      if (overlap >= narrowerWidth * 0.7) return true;
    }
  }
  return false;
}

function transcriptionSpans(
  signal: FormulaCandidate,
  spans: readonly RawSpan[],
): readonly RawSpan[] {
  if (
    !matchesPinnedCandidate(
      signal,
      TRAILING_CIRCUMFLEX_SOURCE_CHECKSUMS,
      'trailing-circumflex artifact',
    )
  ) {
    return spans;
  }
  const circumflexCount = spans.reduce(
    (count, span) => count + [...span.textRaw].filter((character) => character === '\u0302').length,
    0,
  );
  const finalSpan = spans.at(-1);
  if (circumflexCount !== 1 || !finalSpan?.textRaw.endsWith('\u0302')) {
    fail(`${signal.candidateId} trailing-circumflex artifact shape changed`);
  }
  return spans.map((span, index) =>
    index === spans.length - 1
      ? { ...span, textRaw: span.textRaw.slice(0, -1) }
      : span,
  );
}

function verifyCorrection(correction: LineRangeCorrection): RawSpan[] {
  const spans = spansForLineIndexes(correction.pdfPage, correction.lineIndexes);
  const actual = spanChecksum(spans);
  if (process.argv.includes('--print-correction-checksums')) {
    console.log(`${correction.candidateId} ${actual}`);
  } else if (correction.sourceChecksum !== actual) {
    fail(
      `${correction.candidateId} source checksum mismatch: expected ${correction.sourceChecksum}, got ${actual}`,
    );
  }
  return spans;
}

function lineText(pdfPage: number, lineIndexes: number[]): string {
  const page = pageByNumber(pdfPage);
  return lineIndexes
    .map((lineIndex) => runtimeText(page.lines[lineIndex]?.lineRaw ?? ''))
    .filter(Boolean)
    .join('\n');
}

function inline(value: string): InlineNode[] {
  const normalized = runtimeText(value);
  if (!normalized) fail('Cannot create an empty inline node');
  return [{ type: 'text', value: normalized }];
}

function reconstructCode(pdfPage: number, lineIndexes: number[]): string {
  const page = pageByNumber(pdfPage);
  const spans = new Map(page.spans.map((span) => [span.id, span]));
  return (
    lineIndexes
      .map((lineIndex) => {
        const line =
          page.lines[lineIndex] ?? fail(`Missing code line ${lineIndex}`);
        const ordered = line.spanIds
          .map((id) => spans.get(id) ?? fail(`Missing code span ${id}`))
          .sort((left, right) => left.bbox[0] - right.bbox[0]);
        const x0 = Math.min(...ordered.map((span) => span.bbox[0]));
        const indentation = Math.max(0, Math.round((x0 - 62.362) / 1.79125));
        return `${' '.repeat(indentation)}${normalizeHyphens(
          ordered.map((span) => span.textRaw).join(''),
        ).replaceAll('\u0000', '')}`;
      })
      .join('\n') + '\n'
  );
}

function appendixSource(): { code: string; spans: RawSpan[] } {
  const codeLines: string[] = [];
  const sourceSpans: RawSpan[] = [];
  for (const pdfPage of APPENDIX_CORRECTION.pdfPages) {
    const page = pageByNumber(pdfPage);
    const spans = new Map(page.spans.map((span) => [span.id, span]));
    for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex += 1) {
      const line = page.lines[lineIndex];
      if (
        line.bbox[1] >= 790 ||
        (pdfPage !== 161 && line.bbox[1] < 50) ||
        (pdfPage === 161 && lineIndex < 2)
      ) {
        continue;
      }
      const ordered = line.spanIds
        .map((id) => spans.get(id) ?? fail(`Missing appendix span ${id}`))
        .sort((left, right) => left.bbox[0] - right.bbox[0]);
      if (Math.max(...ordered.map((span) => span.size)) >= 8) continue;
      sourceSpans.push(...ordered);
      const x0 = Math.min(...ordered.map((span) => span.bbox[0]));
      const indentation = Math.max(0, Math.round((x0 - 62.362) / 1.79125));
      codeLines.push(
        `${' '.repeat(indentation)}${normalizeHyphens(
          ordered.map((span) => span.textRaw).join(''),
        ).replaceAll('\u0000', '')}`,
      );
    }
  }
  return { code: `${codeLines.join('\n')}\n`, spans: sourceSpans };
}

if (raw.source.sha256 !== EXPECTED_SHA256)
  fail(`Raw source hash mismatch: ${raw.source.sha256}`);
if (raw.source.pageCount !== 170 || raw.pages.length !== 170)
  fail(`Expected 170 physical pages, got ${raw.pages.length}`);
if (raw.outline.length !== 461)
  fail(`Expected 461 outline destinations, got ${raw.outline.length}`);
if (formulaGeometryChecksum(raw as SourceAudit) !== EXPECTED_FORMULA_GEOMETRY_SHA256)
  fail('Pinned formula span geometry changed');

const headingAnchors = deriveSourceHeadingAnchors(raw as SourceAudit);
const lineToHeading = new Map<string, number>();
for (const anchor of headingAnchors) {
  for (const lineIndex of anchor.lineIndexes) {
    const key = `${anchor.pdfPage}:${lineIndex}`;
    if (lineToHeading.has(key)) fail(`Two outline headings claim ${key}`);
    lineToHeading.set(key, anchor.outlineIndex);
  }
}

const formulaByFirstLine = new Map<
  string,
  (typeof FORMULA_CORRECTIONS)[number]
>();
const tableByFirstLine = new Map<string, (typeof TABLE_CORRECTIONS)[number]>();
const codeByFirstLine = new Map<string, (typeof CODE_CORRECTIONS)[number]>();
const claimedSpecialLines = new Map<string, string>();
const specialCandidates: SpecialCandidate[] = [];

function registerCorrection(
  correction: LineRangeCorrection,
  type: SpecialCandidate['type'],
  target: Map<string, typeof correction>,
) {
  const spans = verifyCorrection(correction);
  for (const lineIndex of correction.lineIndexes) {
    const key = `${correction.pdfPage}:${lineIndex}`;
    const existing = claimedSpecialLines.get(key);
    if (existing)
      fail(`${correction.candidateId} overlaps ${existing} at ${key}`);
    claimedSpecialLines.set(key, correction.candidateId);
  }
  target.set(`${correction.pdfPage}:${correction.lineIndexes[0]}`, correction);
  specialCandidates.push({
    candidateId: correction.candidateId,
    type,
    pdfPages: [correction.pdfPage],
    sourceSpanIds: spans.map((span) => span.id),
    sourceChecksum: spanChecksum(spans),
    reviewer: correction.reviewer,
    status: correction.status,
    disposition: `Converted to a reviewed ${type} block`,
    blockId: correction.candidateId,
  });
}

for (const correction of FORMULA_CORRECTIONS)
  registerCorrection(correction, 'formula', formulaByFirstLine);
for (const correction of TABLE_CORRECTIONS)
  registerCorrection(correction, 'table', tableByFirstLine);
for (const correction of CODE_CORRECTIONS)
  registerCorrection(correction, 'code', codeByFirstLine);

const formulaSignals = detectFormulaCandidates(raw as SourceAudit);
const tableSignals = detectTableCandidates(raw as SourceAudit);
const codeSignals = detectCodeCandidates(raw as SourceAudit);
const knowledgeSignals = detectKnowledgeCandidates(raw as SourceAudit);
const candidateAudit: CandidateAudit[] = [];
const autoFormulaByFirstLine = new Map<
  string,
  FormulaCandidate & { blockId: string }
>();

function overlappingCorrection<T extends LineRangeCorrection>(
  signal: DetectedCandidate,
  corrections: readonly T[],
): T | undefined {
  return corrections.find(
    (correction) =>
      correction.pdfPage === signal.pdfPage &&
      correction.lineIndexes.some((lineIndex) =>
        signal.lineIndexes.includes(lineIndex),
      ),
  );
}

const reviewByCandidate = decisionMap(reviewLedger);
const allDetectedCandidates: [CandidateCategory, DetectedCandidate][] = [
  ...formulaSignals.map(
    (signal) => ['formula', signal] as [CandidateCategory, DetectedCandidate],
  ),
  ...tableSignals.map(
    (signal) => ['table', signal] as [CandidateCategory, DetectedCandidate],
  ),
  ...codeSignals.map(
    (signal) => ['code', signal] as [CandidateCategory, DetectedCandidate],
  ),
  ...knowledgeSignals.map(
    (signal) =>
      ['knowledgeCheck', signal] as [CandidateCategory, DetectedCandidate],
  ),
];
if (
  reviewLedger.version !== 1 ||
  reviewLedger.sourceSha256 !== EXPECTED_SHA256 ||
  reviewLedger.candidateCount !== allDetectedCandidates.length ||
  reviewLedger.decisions.length !== allDetectedCandidates.length ||
  reviewByCandidate.size !== allDetectedCandidates.length
) {
  fail('Immutable candidate review ledger does not cover the source universe');
}

function reviewedDecision(
  category: CandidateCategory,
  signal: DetectedCandidate,
): CandidateReviewDecision {
  const decision =
    reviewByCandidate.get(signal.candidateId) ??
    fail(`Candidate review ledger is missing ${signal.candidateId}`);
  if (
    decision.category !== category ||
    decision.pdfPage !== signal.pdfPage ||
    decision.candidateFingerprint !== candidateFingerprint(category, signal) ||
    !decision.reviewer.trim() ||
    !decision.rationale.trim()
  ) {
    fail(`Candidate review ledger mismatch for ${signal.candidateId}`);
  }
  return decision;
}

function requireCorrectionDecision(
  decision: CandidateReviewDecision,
  category: 'formula' | 'table' | 'code',
  correction: LineRangeCorrection | undefined,
): void {
  assertCorrectionBackedDecision(category, decision, correction);
}

for (const signal of formulaSignals) {
  const correction = overlappingCorrection(signal, FORMULA_CORRECTIONS);
  const decision = reviewedDecision('formula', signal);
  requireCorrectionDecision(decision, 'formula', correction);
  const structured = decision.disposition === 'structuredFormula';
  if (
    !['structuredFormula', 'inlineMath'].includes(decision.disposition) ||
    structured !== signal.display ||
    (structured && !decision.targetBlockId) ||
    (!structured && decision.targetBlockId)
  ) {
    fail(`Invalid reviewed formula disposition for ${signal.candidateId}`);
  }
  const blockId = decision.targetBlockId;
  if (structured && !correction) {
    for (const lineIndex of signal.lineIndexes) {
      const key = `${signal.pdfPage}:${lineIndex}`;
      const existing = claimedSpecialLines.get(key);
      if (existing) fail(`${blockId} overlaps ${existing} at ${key}`);
      claimedSpecialLines.set(key, blockId!);
    }
    autoFormulaByFirstLine.set(`${signal.pdfPage}:${signal.lineIndexes[0]}`, {
      ...signal,
      blockId: blockId!,
    });
    specialCandidates.push({
      candidateId: blockId!,
      type: 'formula',
      pdfPages: [signal.pdfPage],
      sourceSpanIds: signal.sourceSpanIds,
      sourceChecksum: signal.sourceChecksum,
      reviewer: decision.reviewer,
      status: 'reviewed',
      disposition: 'Converted to a reviewed formula block',
      blockId: blockId!,
    });
  }
  candidateAudit.push({
    ...signal,
    category: 'formula',
    reviewer: decision.reviewer,
    status: 'reviewed',
    disposition: decision.disposition,
    rationale: decision.rationale,
    ...(decision.targetBlockId ? { blockId: decision.targetBlockId } : {}),
  });
}

const appendix = appendixSource();
const appendixChecksum = spanChecksum(appendix.spans);
if (process.argv.includes('--print-correction-checksums')) {
  console.log(`${APPENDIX_CORRECTION.candidateId} ${appendixChecksum}`);
  process.exit(0);
}
if (appendixChecksum !== APPENDIX_CORRECTION.sourceChecksum)
  fail(
    `${APPENDIX_CORRECTION.candidateId} source checksum mismatch: expected ${APPENDIX_CORRECTION.sourceChecksum}, got ${appendixChecksum}`,
  );
if (
  appendix.code.split('\n').length - 1 !==
  APPENDIX_CORRECTION.expectedLineCount
)
  fail('Appendix A did not reconstruct to exactly 472 lines');
if (appendix.code.length !== APPENDIX_CORRECTION.expectedCharacterCount)
  fail('Appendix A character count changed');
if (sha256(appendix.code) !== APPENDIX_CORRECTION.expectedCodeSha256)
  fail('Appendix A code checksum changed');
specialCandidates.push({
  candidateId: APPENDIX_CORRECTION.candidateId,
  type: 'code',
  pdfPages: APPENDIX_CORRECTION.pdfPages,
  sourceSpanIds: appendix.spans.map((span) => span.id),
  sourceChecksum: appendixChecksum,
  reviewer: APPENDIX_CORRECTION.reviewer,
  status: APPENDIX_CORRECTION.status,
  disposition: 'Recovered as one reviewed 472-line Python block',
  blockId: APPENDIX_CORRECTION.candidateId,
});

const sections = new Map<number, SectionNode>();
for (const outline of raw.outline) {
  const anchor = headingAnchors[outline.outlineIndex];
  sections.set(outline.outlineIndex, {
    id: sectionId(outline),
    aliases: [],
    title: lineText(anchor.pdfPage, anchor.lineIndexes).replaceAll('\n', ''),
    navDepth: outline.depth + 1,
    showInToc: true,
    isCompletable: outline.depth > 0,
    source: sourceRef(outline.pdfPage),
    blocks: [],
    children: [],
  });
}
for (const outline of raw.outline) {
  if (outline.parentOutlineIndex !== null) {
    const parent =
      sections.get(outline.parentOutlineIndex) ??
      fail(`Missing parent ${outline.parentOutlineIndex}`);
    parent.children.push(
      sections.get(outline.outlineIndex) ??
        fail(`Missing section ${outline.outlineIndex}`),
    );
  }
}

const assigned: { spanId: string; blockId: string }[] = [];
const excluded: {
  spanId: string;
  pdfPage: number;
  reason: string;
  status: 'reviewed';
}[] = [];
const assignedLineTexts = new Map<number, string[]>();
const blockSourceLines = new Map<
  string,
  { pdfPage: number; lineIndex: number; line: RawLine }[]
>();
let blockSequence = 0;
let currentOutlineIndex: number | undefined;

function claimSpans(spans: RawSpan[], blockId: string) {
  for (const span of spans) assigned.push({ spanId: span.id, blockId });
}

function addBlock(
  outlineIndex: number,
  block: ContentBlock,
  sourceText: string,
) {
  const section =
    sections.get(outlineIndex) ??
    fail(`No active section for block ${block.id}`);
  section.blocks.push(block);
  const sourceLines = assignedLineTexts.get(outlineIndex) ?? [];
  sourceLines.push(sourceText);
  assignedLineTexts.set(outlineIndex, sourceLines);
}

for (const page of raw.pages) {
  const spans = new Map(page.spans.map((span) => [span.id, span]));
  for (let lineIndex = 0; lineIndex < page.lines.length; lineIndex += 1) {
    const line = page.lines[lineIndex];
    const lineSpans = line.spanIds.map(
      (id) => spans.get(id) ?? fail(`Missing source span ${id}`),
    );
    const key = `${page.pdfPage}:${lineIndex}`;
    const headingOutlineIndex = lineToHeading.get(key);
    if (headingOutlineIndex !== undefined) {
      currentOutlineIndex = headingOutlineIndex;
      for (const span of lineSpans) {
        excluded.push({
          spanId: span.id,
          pdfPage: page.pdfPage,
          reason: `Represented by outline section ${sectionId(raw.outline[headingOutlineIndex])}`,
          status: 'reviewed',
        });
      }
      continue;
    }
    if (page.pdfPage === 1 || (page.pdfPage >= 2 && page.pdfPage <= 9)) {
      for (const span of lineSpans) {
        excluded.push({
          spanId: span.id,
          pdfPage: page.pdfPage,
          reason:
            page.pdfPage === 1
              ? 'Cover represented by course metadata'
              : 'Printed table of contents replaced by recursive web navigation',
          status: 'reviewed',
        });
      }
      continue;
    }
    if (line.bbox[1] > 790 || line.bbox[1] < 50) {
      for (const span of lineSpans) {
        excluded.push({
          spanId: span.id,
          pdfPage: page.pdfPage,
          reason:
            line.bbox[1] > 790
              ? 'Printed page footer'
              : 'Repeated running header',
          status: 'reviewed',
        });
      }
      continue;
    }
    if (page.pdfPage >= 161 && page.pdfPage <= 170) {
      const appendixSpanIds = new Set(appendix.spans.map((span) => span.id));
      if (lineSpans.every((span) => appendixSpanIds.has(span.id))) {
        if (page.pdfPage === 161 && lineIndex === 2) {
          const block: ContentBlock = {
            type: 'code',
            id: APPENDIX_CORRECTION.candidateId,
            language: APPENDIX_CORRECTION.language,
            filename: APPENDIX_CORRECTION.filename,
            code: appendix.code,
            source: sourceRef(161),
          };
          addBlock(460, block, appendix.code);
          claimSpans(appendix.spans, block.id);
        }
        continue;
      }
    }
    if (currentOutlineIndex === undefined)
      fail(`Body line ${line.id} appears before the first outline heading`);

    const claimedBy = claimedSpecialLines.get(key);
    const formula = formulaByFirstLine.get(key);
    if (formula) {
      const correctionSpans = verifyCorrection(formula);
      const accessibleText = lineText(formula.pdfPage, formula.lineIndexes);
      const block: ContentBlock = {
        type: 'formula',
        id: formula.candidateId,
        latex: formula.latex,
        accessibleText,
        source: sourceRef(formula.pdfPage),
      };
      addBlock(currentOutlineIndex, block, accessibleText);
      claimSpans(correctionSpans, block.id);
      continue;
    }
    const autoFormula = autoFormulaByFirstLine.get(key);
    if (autoFormula) {
      const formulaSpans = spansForLineIndexes(
        autoFormula.pdfPage,
        autoFormula.lineIndexes,
      );
      const sourceText = lineText(autoFormula.pdfPage, autoFormula.lineIndexes);
      const visuallyOneLine = !hasAdjacentStackedRows(autoFormula);
      if (
        visuallyOneLine &&
        matchesPinnedCandidate(
          autoFormula,
          MISSING_HAT_SOURCE_CHECKSUMS,
          'missing-hat extraction',
        )
      ) {
        fail(
          `${autoFormula.candidateId} omits a reviewed PDF-visible hat and requires an explicit correction`,
        );
      }
      const rendering = visuallyOneLine
        ? transcribeOneLineFormula(
            transcriptionSpans(autoFormula, formulaSpans),
          )
        : {
            latex: textLatex(sourceText.replaceAll('\n', ' ')),
            accessibleText: sourceText,
          };
      const block: ContentBlock = {
        type: 'formula',
        id: autoFormula.blockId,
        latex: rendering.latex,
        accessibleText: rendering.accessibleText,
        source: sourceRef(autoFormula.pdfPage),
      };
      addBlock(currentOutlineIndex, block, rendering.accessibleText);
      claimSpans(formulaSpans, block.id);
      continue;
    }
    const table = tableByFirstLine.get(key);
    if (table) {
      const correctionSpans = verifyCorrection(table);
      const block: ContentBlock = {
        type: 'table',
        id: table.candidateId,
        caption: table.caption,
        headers: table.headers.map(inline),
        rows: table.rows.map((row) => row.map(inline)),
        source: sourceRef(table.pdfPage),
      };
      addBlock(
        currentOutlineIndex,
        block,
        lineText(table.pdfPage, table.lineIndexes),
      );
      claimSpans(correctionSpans, block.id);
      continue;
    }
    const code = codeByFirstLine.get(key);
    if (code) {
      const correctionSpans = verifyCorrection(code);
      const recovered = reconstructCode(code.pdfPage, code.lineIndexes);
      const block: ContentBlock = {
        type: 'code',
        id: code.candidateId,
        language: code.language,
        ...(code.filename ? { filename: code.filename } : {}),
        code: recovered,
        source: sourceRef(code.pdfPage),
      };
      addBlock(currentOutlineIndex, block, recovered);
      claimSpans(correctionSpans, block.id);
      continue;
    }
    if (claimedBy) continue;

    const value = runtimeText(line.lineRaw);
    if (!value) {
      for (const span of lineSpans) {
        excluded.push({
          spanId: span.id,
          pdfPage: page.pdfPage,
          reason: 'Empty visual artifact',
          status: 'reviewed',
        });
      }
      continue;
    }
    const blockId = `body-${String(blockSequence).padStart(5, '0')}`;
    blockSequence += 1;
    addBlock(
      currentOutlineIndex,
      {
        type: 'paragraph',
        id: blockId,
        children: inline(value),
        source: sourceRef(page.pdfPage),
      },
      value,
    );
    claimSpans(lineSpans, blockId);
    blockSourceLines.set(blockId, [{ pdfPage: page.pdfPage, lineIndex, line }]);
  }
}

function paragraphValue(block: ContentBlock): string | undefined {
  if (block.type !== 'paragraph') return undefined;
  return block.children
    .map((node) => ('value' in node ? node.value : ''))
    .join('');
}

function redirectAssignments(oldIds: Set<string>, newId: string): void {
  for (const assignment of assigned) {
    if (oldIds.has(assignment.blockId)) assignment.blockId = newId;
  }
}

function shouldJoinParagraphs(
  left: ContentBlock,
  right: ContentBlock,
): boolean {
  const leftText = paragraphValue(left);
  const rightText = paragraphValue(right);
  if (!leftText || !rightText) return false;
  if (/^[・•]|^\d+[.)]\s+/u.test(rightText)) return false;
  const leftLines = blockSourceLines.get(left.id);
  const rightLines = blockSourceLines.get(right.id);
  if (!leftLines || !rightLines) return false;
  const previous = leftLines.at(-1)!;
  const next = rightLines[0];
  const continuesArrow = rightText.startsWith('→');
  const bodyHeight = previous.line.bbox[3] - previous.line.bbox[1] >= 9.4;
  const aligned = Math.abs(previous.line.bbox[0] - next.line.bbox[0]) <= 4;
  const fullLine = previous.line.bbox[2] >= 500 || leftText.endsWith('-');
  const samePage =
    previous.pdfPage === next.pdfPage &&
    next.line.bbox[1] - previous.line.bbox[3] <= 3.6;
  const nextPage =
    next.pdfPage === previous.pdfPage + 1 &&
    previous.line.bbox[1] >= 740 &&
    next.line.bbox[1] <= 100;
  return (
    continuesArrow ||
    (bodyHeight && aligned && fullLine && (samePage || nextPage))
  );
}

function reconstructSemanticBlocks(section: SectionNode): void {
  const merged: ContentBlock[] = [];
  for (const block of section.blocks) {
    const previous = merged.at(-1);
    if (previous && shouldJoinParagraphs(previous, block)) {
      const previousText = paragraphValue(previous)!;
      const currentText = paragraphValue(block)!;
      if (previous.type === 'paragraph') {
        previous.children = inline(joinWrappedText(previousText, currentText));
      }
      redirectAssignments(new Set([block.id]), previous.id);
      blockSourceLines.set(previous.id, [
        ...(blockSourceLines.get(previous.id) ?? []),
        ...(blockSourceLines.get(block.id) ?? []),
      ]);
      blockSourceLines.delete(block.id);
    } else merged.push(block);
  }

  const withLists: ContentBlock[] = [];
  for (let index = 0; index < merged.length;) {
    const value = paragraphValue(merged[index]);
    const unordered = value?.match(/^[・•]\s*(.+)$/u);
    const ordered = value?.match(/^\d+[.)]\s+(.+)$/u);
    if (!unordered && !ordered) {
      withLists.push(merged[index]);
      index += 1;
      continue;
    }
    const items: string[] = [];
    const oldIds = new Set<string>();
    const groupBlocks: ContentBlock[] = [];
    const sourceLines: { pdfPage: number; lineIndex: number; line: RawLine }[] =
      [];
    const isOrdered = Boolean(ordered);
    while (index < merged.length) {
      const itemValue = paragraphValue(merged[index]);
      const match = itemValue?.match(
        isOrdered ? /^\d+[.)]\s+(.+)$/u : /^[・•]\s*(.+)$/u,
      );
      if (!match) break;
      items.push(match[1]);
      oldIds.add(merged[index].id);
      groupBlocks.push(merged[index]);
      sourceLines.push(...(blockSourceLines.get(merged[index].id) ?? []));
      index += 1;
    }
    if (items.length < 2) {
      withLists.push(...groupBlocks);
      continue;
    }
    const firstId = [...oldIds][0];
    const listId = `list-${firstId}`;
    redirectAssignments(oldIds, listId);
    blockSourceLines.set(listId, sourceLines);
    withLists.push({
      type: 'list',
      id: listId,
      ordered: isOrdered,
      items: items.map(inline),
      source: merged.find((block) => block.id === firstId)!.source,
    });
  }

  const withChains = withLists.map((block): ContentBlock => {
    const value = paragraphValue(block);
    if (!value || (value.match(/→/gu)?.length ?? 0) < 2) return block;
    const steps = value
      .split(/\s*→\s*/gu)
      .map((step) => step.trim())
      .filter(Boolean);
    if (steps.length < 3) return block;
    const chainId = `chain-${block.id}`;
    redirectAssignments(new Set([block.id]), chainId);
    blockSourceLines.set(chainId, blockSourceLines.get(block.id) ?? []);
    return {
      type: 'conceptChain',
      id: chainId,
      steps,
      source: block.source,
    };
  });

  for (let index = 1; index < withChains.length - 1; index += 1) {
    if (
      withChains[index].type === 'conceptChain' &&
      withChains[index - 1].type === 'paragraph' &&
      paragraphValue(withChains[index - 1])?.endsWith('：') &&
      withChains[index + 1].type === 'paragraph'
    ) {
      const calloutBlocks = withChains.splice(index - 1, 3);
      withChains.splice(index - 1, 0, {
        type: 'callout',
        id: `callout-${calloutBlocks[0].id}`,
        tone: 'concept',
        blocks: calloutBlocks,
        source: calloutBlocks[0].source,
      });
      index -= 1;
    }
  }
  section.blocks = withChains;
  section.children.forEach(reconstructSemanticBlocks);
}

for (const root of raw.outline.filter((item) => item.depth === 0))
  reconstructSemanticBlocks(sections.get(root.outlineIndex)!);

for (const outlineIndex of KNOWLEDGE_CHECK_OUTLINE_INDEXES) {
  const section =
    sections.get(outlineIndex) ??
    fail(`Missing knowledge-check section ${outlineIndex}`);
  const firstStructuredIndex = section.blocks.findIndex(
    (block) => block.type !== 'paragraph' && block.type !== 'list',
  );
  const promptBlocks =
    firstStructuredIndex > 0
      ? section.blocks.slice(0, firstStructuredIndex)
      : section.blocks;
  const remainingBlocks =
    firstStructuredIndex > 0 ? section.blocks.slice(firstStructuredIndex) : [];
  const prompt = promptBlocks.map(blockProjection);
  if (prompt.length === 0)
    fail(`Knowledge check ${outlineIndex} has no prompt`);
  const oldBlockIds = new Set(promptBlocks.map((block) => block.id));
  const candidateId = `knowledge-check-o${outlineIndex.toString().padStart(4, '0')}`;
  const knowledgeReview =
    reviewByCandidate.get(
      `knowledge-signal-o${outlineIndex.toString().padStart(4, '0')}`,
    ) ?? fail(`Missing knowledge-check review for outline ${outlineIndex}`);
  section.blocks = [
    {
      type: 'knowledgeCheck',
      id: candidateId,
      prompt: inline(prompt.join('\n')),
      reviewSectionId: section.id,
      source: section.source,
    },
    ...remainingBlocks,
  ];
  for (const assignment of assigned) {
    if (oldBlockIds.has(assignment.blockId)) assignment.blockId = candidateId;
  }
  const sourceSpanIds = assigned
    .filter((assignment) => assignment.blockId === candidateId)
    .map((assignment) => assignment.spanId);
  const sourceSpans = sourceSpanIds.map((spanId) => {
    for (const page of raw.pages) {
      const span = page.spans.find((candidate) => candidate.id === spanId);
      if (span) return span;
    }
    return fail(`Missing knowledge-check span ${spanId}`);
  });
  specialCandidates.push({
    candidateId,
    type: 'knowledgeCheck',
    pdfPages: [
      ...new Set(sourceSpans.map((span) => Number(span.id.slice(1, 4)))),
    ],
    sourceSpanIds,
    sourceChecksum: spanChecksum(sourceSpans),
    reviewer: knowledgeReview.reviewer,
    status: 'reviewed',
    disposition:
      'Prompt promoted while structured source blocks remain in order',
    blockId: candidateId,
  });
}

for (const signal of tableSignals) {
  const correction = overlappingCorrection(signal, TABLE_CORRECTIONS);
  const decision = reviewedDecision('table', signal);
  requireCorrectionDecision(decision, 'table', correction);
  if (
    (decision.disposition === 'table') !== Boolean(correction) ||
    (correction && decision.targetBlockId !== correction.candidateId) ||
    (!correction && decision.targetBlockId) ||
    !['table', 'notTable'].includes(decision.disposition)
  ) {
    fail(`Invalid reviewed table disposition for ${signal.candidateId}`);
  }
  candidateAudit.push({
    ...signal,
    category: 'table',
    reviewer: decision.reviewer,
    status: 'reviewed',
    disposition: decision.disposition,
    rationale: decision.rationale,
    ...(decision.targetBlockId ? { blockId: decision.targetBlockId } : {}),
  });
}

for (const signal of codeSignals) {
  const correction = overlappingCorrection(signal, CODE_CORRECTIONS);
  const appendixAggregate = signal.candidateId === 'code-signal-appendix-a';
  const decision = reviewedDecision('code', signal);
  requireCorrectionDecision(decision, 'code', correction);
  const expectedBlockId = appendixAggregate
    ? APPENDIX_CORRECTION.candidateId
    : correction?.candidateId;
  if (
    (decision.disposition === 'code') !== Boolean(expectedBlockId) ||
    decision.targetBlockId !== expectedBlockId ||
    !['code', 'notCode'].includes(decision.disposition)
  ) {
    fail(`Invalid reviewed code disposition for ${signal.candidateId}`);
  }
  candidateAudit.push({
    ...signal,
    category: 'code',
    reviewer: decision.reviewer,
    status: 'reviewed',
    disposition: decision.disposition,
    rationale: decision.rationale,
    ...(decision.targetBlockId ? { blockId: decision.targetBlockId } : {}),
  });
}

for (const signal of knowledgeSignals) {
  const outlineIndex = Number(signal.candidateId.slice(-4));
  const isKnowledgeCheck = KNOWLEDGE_CHECK_OUTLINE_INDEXES.includes(
    outlineIndex as (typeof KNOWLEDGE_CHECK_OUTLINE_INDEXES)[number],
  );
  const blockId = isKnowledgeCheck
    ? `knowledge-check-o${String(outlineIndex).padStart(4, '0')}`
    : undefined;
  const decision = reviewedDecision('knowledgeCheck', signal);
  if (
    (decision.disposition === 'knowledgeCheck') !== isKnowledgeCheck ||
    decision.targetBlockId !== blockId ||
    !['knowledgeCheck', 'notKnowledgeCheck'].includes(decision.disposition) ||
    decision.correctionFingerprint
  ) {
    fail(
      `Invalid reviewed knowledge-check disposition for ${signal.candidateId}`,
    );
  }
  candidateAudit.push({
    ...signal,
    category: 'knowledgeCheck',
    reviewer: decision.reviewer,
    status: 'reviewed',
    disposition: decision.disposition,
    rationale: decision.rationale,
    ...(decision.targetBlockId ? { blockId: decision.targetBlockId } : {}),
  });
}

for (const candidate of specialCandidates) {
  const matchingReviews = reviewLedger.decisions.filter(
    (decision) => decision.targetBlockId === candidate.blockId,
  );
  if (matchingReviews.length === 0)
    fail(`Structured block ${candidate.blockId} has no review-ledger decision`);
  candidate.reviewer = matchingReviews[0].reviewer;
}

for (const outline of raw.outline) {
  const section = sections.get(outline.outlineIndex) ?? fail('Missing section');
  if (section.blocks.length === 0 && section.children.length === 0) {
    const anchor = headingAnchors[outline.outlineIndex];
    const headingSpans = spansForLineIndexes(
      anchor.pdfPage,
      anchor.lineIndexes,
    );
    const headingSpanIds = new Set(headingSpans.map((span) => span.id));
    for (let index = excluded.length - 1; index >= 0; index -= 1) {
      if (headingSpanIds.has(excluded[index].spanId)) excluded.splice(index, 1);
    }
    const blockId = `heading-content-o${outline.outlineIndex.toString().padStart(4, '0')}`;
    addBlock(
      outline.outlineIndex,
      {
        type: 'paragraph',
        id: blockId,
        children: inline(outline.titleRaw),
        source: sourceRef(outline.pdfPage),
      },
      runtimeText(outline.titleRaw),
    );
    claimSpans(headingSpans, blockId);
  }
}

const allSpanIds = raw.pages.flatMap((page) =>
  page.spans.map((span) => span.id),
);
const accounted = [
  ...assigned.map((item) => item.spanId),
  ...excluded.map((item) => item.spanId),
];
if (new Set(accounted).size !== accounted.length)
  fail('A positioned source span was assigned or excluded more than once');
if (accounted.length !== allSpanIds.length)
  fail(
    `Positioned span accounting mismatch: ${accounted.length}/${allSpanIds.length}`,
  );

const roots = raw.outline
  .filter((outline) => outline.depth === 0)
  .map((outline) => sections.get(outline.outlineIndex) ?? fail('Missing root'));
if (roots.length !== 14)
  fail(`Expected 14 top-level outline roots, got ${roots.length}`);

const weekRanges = [
  [11, 20],
  [21, 35],
  [36, 73],
  [74, 84],
  [85, 93],
  [94, 103],
  [104, 112],
  [113, 120],
  [121, 128],
  [129, 138],
  [139, 149],
  [150, 160],
] as const;
const keyQuestions = [
  '怎样把 AI 公式翻译成数据、shape 和代码？',
  '模型怎样根据错误学习 parameters？',
  '怎样从一个 wx+b 扩展成多层网络？',
  'Loss 怎样把责任传回每个 weight？',
  '怎样让计算机自动执行大规模 forward/backward？',
  '文字怎样变成 next-token prediction？',
  '当前 token 怎样动态寻找相关 context？',
  'Attention 怎样组成可堆叠的训练架构？',
  '文字怎样稳定转换为模型 IDs？',
  '怎样把所有组件组合成 Mini GPT？',
  '怎样训练、验证、保存并生成文本？',
  '整个系统怎样从 corpus 运行到 generated text？',
];

const course: Course = {
  title: 'AI First Principles · 核心教程深度扩展版',
  description: '从数据、参数与梯度一路学习到可运行的 Mini GPT。',
  sourceFilename: PUBLIC_FILENAME,
  version: '2026-09-03',
  overview: roots[0],
  units: [
    ...roots.slice(1, 13).map((root, index) => {
      const [start, end] = weekRanges[index];
      return {
        ...root,
        kind: 'week' as const,
        weekNumber: index + 1,
        slug: `week-${String(index + 1).padStart(2, '0')}`,
        keyQuestion: keyQuestions[index],
        objectives: [
          `理解并应用 ${runtimeText(raw.outline.find((outline) => outline.outlineIndex === [2, 39, 77, 179, 201, 221, 254, 285, 318, 350, 378, 413][index])?.titleRaw ?? root.title)}`,
        ],
        sourcePages: Array.from(
          { length: end - start + 1 },
          (_, offset) => start + offset,
        ),
        estimatedReadingMinutes: Math.max(1, Math.round((end - start + 1) * 5)),
      };
    }),
    {
      ...roots[13],
      kind: 'appendix' as const,
      label: 'A' as const,
      slug: 'mini-gpt-reference',
    },
  ],
};

const manifest: PageManifestEntry[] = raw.pages.map((page) => {
  if (page.pdfPage === 1) {
    return {
      pdfPage: 1,
      classification: 'frontMatter',
      reason: 'Cover represented by course metadata',
    };
  }
  if (page.pdfPage <= 9) {
    return {
      pdfPage: page.pdfPage,
      classification: 'navigationReplaced',
      reason:
        'Printed table of contents replaced by accessible recursive web navigation',
    };
  }
  const activeOutline = [...headingAnchors]
    .filter(
      (anchor) =>
        anchor.pdfPage < page.pdfPage ||
        (anchor.pdfPage === page.pdfPage && anchor.lineIndexes[0] >= 0),
    )
    .at(-1)?.outlineIndex;
  return {
    pdfPage: page.pdfPage,
    printedPageLabel:
      page.printedPageLabel ??
      fail(`Page ${page.pdfPage} has no printed label`),
    classification: 'content',
    sectionId:
      page.pdfPage === 10
        ? sectionId(raw.outline[0])
        : sectionId(raw.outline[activeOutline ?? 0]),
  };
});

function blockProjection(block: ContentBlock): string {
  const inlineProjection = (nodes: InlineNode[]): string =>
    nodes
      .map((node) =>
        'children' in node ? inlineProjection(node.children) : node.value,
      )
      .join('');
  switch (block.type) {
    case 'paragraph':
      return inlineProjection(block.children);
    case 'list':
      return block.items
        .map((item, index) =>
          block.ordered
            ? `${index + 1}. ${inlineProjection(item)}`
            : `・${inlineProjection(item)}`,
        )
        .join('\n');
    case 'formula':
      return block.accessibleText;
    case 'code':
      return block.code;
    case 'table':
      return [...block.headers, ...block.rows.flat()]
        .map(inlineProjection)
        .join('\n');
    case 'callout':
      return block.blocks.map(blockProjection).join('\n');
    case 'conceptChain':
      return block.steps.join(' → ');
    case 'knowledgeCheck':
      return inlineProjection(block.prompt);
  }
}

function sectionProjection(section: SectionNode): string {
  const blocks = section.blocks.filter(
    (block) => !block.id.startsWith('heading-content-'),
  );
  return [
    section.title,
    ...blocks.map(blockProjection),
    ...section.children.map(sectionProjection),
  ].join('\n');
}

function sourceProjection(startPage: number, endPage: number): string {
  return raw.pages
    .filter((page) => page.pdfPage >= startPage && page.pdfPage <= endPage)
    .flatMap((page) =>
      page.lines.filter((line) => line.bbox[1] >= 50 && line.bbox[1] <= 790),
    )
    .map((line) => line.lineRaw)
    .join('\n');
}

function proseEvidence(startPage: number, endPage: number, root: SectionNode) {
  const sourceTokens = tokenSequence(sourceProjection(startPage, endPage));
  const normalizedTokens = tokenSequence(sectionProjection(root));
  return {
    sourceTokenCount: sourceTokens.length,
    normalizedTokenCount: normalizedTokens.length,
    sourceTokenChecksum: sha256(JSON.stringify(sourceTokens)),
    normalizedTokenChecksum: sha256(JSON.stringify(normalizedTokens)),
    matches: JSON.stringify(sourceTokens) === JSON.stringify(normalizedTokens),
  };
}

const week2Evidence = proseEvidence(21, 35, roots[2]);
const week3Evidence = proseEvidence(36, 73, roots[3]);
if (!week2Evidence.matches || !week3Evidence.matches) {
  const debugMismatch = (
    startPage: number,
    endPage: number,
    root: SectionNode,
  ) => {
    const source = tokenSequence(sourceProjection(startPage, endPage));
    const output = tokenSequence(sectionProjection(root));
    const index = source.findIndex(
      (token, position) => token !== output[position],
    );
    return {
      index,
      source: source.slice(Math.max(0, index - 5), index + 6),
      output: output.slice(Math.max(0, index - 5), index + 6),
    };
  };
  fail(
    `Week 2/Week 3 normalized token sequences differ: ${JSON.stringify({ week2: debugMismatch(21, 35, roots[2]), week3: debugMismatch(36, 73, roots[3]) })}`,
  );
}

const discovered = {
  formulas: formulaSignals.length,
  tables: tableSignals.length,
  codeBlocks: codeSignals.length,
  knowledgeChecks: knowledgeSignals.length,
};
const reviewed = {
  formulas: reviewLedger.decisions.filter(
    (decision) => decision.category === 'formula',
  ).length,
  tables: reviewLedger.decisions.filter(
    (decision) => decision.category === 'table',
  ).length,
  codeBlocks: reviewLedger.decisions.filter(
    (decision) => decision.category === 'code',
  ).length,
  knowledgeChecks: reviewLedger.decisions.filter(
    (decision) => decision.category === 'knowledgeCheck',
  ).length,
};
const typedBlocks = {
  formulas: specialCandidates.filter(
    (candidate) => candidate.type === 'formula',
  ).length,
  tables: specialCandidates.filter((candidate) => candidate.type === 'table')
    .length,
  codeBlocks: specialCandidates.filter((candidate) => candidate.type === 'code')
    .length,
  knowledgeChecks: specialCandidates.filter(
    (candidate) => candidate.type === 'knowledgeCheck',
  ).length,
};
const report = {
  generatedAt: GENERATED_AT,
  source: raw.source,
  pages: { total: 170, classified: manifest.length },
  outline: {
    total: raw.outline.length,
    mapped: raw.outline.length,
    merged: 0,
    rootCount: roots.length,
    coveragePercent: 100,
  },
  discovered,
  reviewed,
  typedBlocks,
  detectionSignals: {
    mathFontVisualRows: raw.pages.reduce((count, page) => {
      const spanMap = new Map(page.spans.map((span) => [span.id, span]));
      return (
        count +
        page.lines.filter((line) =>
          line.spanIds.some((id) =>
            spanMap.get(id)?.font.includes('LatinModernMath'),
          ),
        ).length
      );
    }, 0),
    note: 'Independent font/geometry detectors define the review universe before correction lookup; every signal has a checksummed disposition.',
  },
  outlineMap: raw.outline.map((outline) => {
    const anchor = headingAnchors[outline.outlineIndex];
    return {
      ...outline,
      sectionId: sectionId(outline),
      headingPdfPage: anchor.pdfPage,
      headingLineIndexes: anchor.lineIndexes,
      status: 'mapped',
    };
  }),
  specialCandidates,
  candidateAudit,
  spanAccounting: {
    positionedSpanCount: allSpanIds.length,
    assignedCount: assigned.length,
    excludedCount: excluded.length,
    assigned,
    excluded,
  },
  prosePreservation: { week2: week2Evidence, week3: week3Evidence },
  appendix: {
    lineCount: APPENDIX_CORRECTION.expectedLineCount,
    characterCount: appendix.code.length,
    codeSha256: sha256(appendix.code),
    sourceChecksum: appendixChecksum,
    astValidatedBy: 'scripts/validate-content.mts using @lezer/python',
  },
  visualReviewEvidence: {
    indexPath: 'reports/content-review-evidence/index.json',
    candidateLedgerPath: 'src/content/candidate-review-ledger.json',
    reviewedPhysicalPages: 148,
    contactSheets: 13,
  },
  unresolvedWarnings: [] as string[],
};

const outputDirectory = path.resolve('src/content');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  path.join(outputDirectory, 'course.generated.json'),
  `${JSON.stringify(course, null, 2)}\n`,
  'utf8',
);
writeFileSync(
  path.join(outputDirectory, 'page-manifest.generated.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
writeFileSync(
  path.join(outputDirectory, 'conversion-report.generated.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
);

mkdirSync(path.resolve('public'), { recursive: true });
const publicSource = path.resolve('public', PUBLIC_FILENAME);
if (existsSync(SOURCE_PATH)) copyFileSync(SOURCE_PATH, publicSource);
if (
  !existsSync(publicSource) ||
  sha256(readFileSync(publicSource)).toUpperCase() !== EXPECTED_SHA256
)
  fail('Public source PDF is missing or does not match the pinned checksum');

const markdown = `# PDF content conversion report

Generated from the pinned source on ${GENERATED_AT}. This report is backed by the machine-readable conversion report in \`src/content/conversion-report.generated.json\`.

## Source and coverage

- SHA-256: \`${raw.source.sha256}\`
- Physical pages: ${report.pages.classified}/${report.pages.total}
- Outline destinations: ${report.outline.mapped}/${report.outline.total} (${report.outline.coveragePercent}%)
- Top-level roots: ${report.outline.rootCount} (overview, 12 weeks, Appendix A)
- Positioned spans: ${assigned.length} assigned + ${excluded.length} reviewed exclusions = ${allSpanIds.length}
- Unresolved warnings: ${report.unresolvedWarnings.length}

## Reviewed special blocks

| Type | Discovered | Reviewed |
| --- | ---: | ---: |
| Formula | ${discovered.formulas} | ${discovered.formulas} |
| Table | ${discovered.tables} | ${discovered.tables} |
| Code block | ${discovered.codeBlocks} | ${discovered.codeBlocks} |
| Knowledge check | ${discovered.knowledgeChecks} | ${discovered.knowledgeChecks} |

Every independently detected candidate is joined to the immutable checked review ledger, which records its source fingerprint, physical page, reviewer, rationale, disposition, and structured target where applicable. Normalization does not create or overwrite review decisions. The validator also checks the 13 ledger-linked contact sheets and their 148-page cell/checksum index.

## Prose preservation

- Week 2: ${week2Evidence.normalizedTokenCount} normalized tokens; source/output checksum \`${week2Evidence.sourceTokenChecksum}\`; match: ${week2Evidence.matches}
- Week 3: ${week3Evidence.normalizedTokenCount} normalized tokens; source/output checksum \`${week3Evidence.sourceTokenChecksum}\`; match: ${week3Evidence.matches}

The comparison projection applies Unicode NFC, whitespace tokenization, proven visual-line dehyphenation, removal of extraction NUL artifacts, and only U+2010/U+2011/U+2013/U+2212 to ASCII-hyphen compatibility. The source-side stream is independently rebuilt from every body line on physical pages 21-73; it does not use generated span assignments. Raw text and source span text remain unchanged in the checked-in compressed source audit.

## Appendix A

- One Python block spanning physical pages 161-170
- ${report.appendix.lineCount} lines, ${report.appendix.characterCount.toLocaleString('en-US')} characters
- Code SHA-256: \`${report.appendix.codeSha256}\`
- Indentation recovered from the 62.362 pt base and 1.79125 pt per space grid
- Python AST is a mandatory validator gate

## Rendered-source review evidence

- Immutable decision ledger: \`src/content/candidate-review-ledger.json\`
- Contact-sheet index: \`reports/content-review-evidence/index.json\`
- 13 checked contact sheets covering all 148 candidate-bearing physical pages

## Explicit exclusions

Physical page 1 is front matter represented by metadata. Physical pages 2-9 are the printed table of contents replaced by web navigation. Repeated running headers, printed page-number footers, and outline headings represented by section nodes are retained in the raw extraction and listed as reviewed exclusions; none are silently discarded.
`;
mkdirSync(path.resolve('reports'), { recursive: true });
writeFileSync(path.resolve('reports/content-conversion.md'), markdown, 'utf8');

console.log(
  JSON.stringify({
    sourceSha256: raw.source.sha256,
    pages: `${manifest.length}/170`,
    outline: `${raw.outline.length}/461`,
    discovered,
    assignedSpans: assigned.length,
    excludedSpans: excluded.length,
    appendixLines: report.appendix.lineCount,
    unresolvedWarnings: report.unresolvedWarnings.length,
  }),
);
