import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { parser as pythonParser } from '@lezer/python';
import katex from 'katex';

import { flattenSections, loadCourse } from '../src/content/load-course';
import {
  PageManifestSchema,
  type ContentBlock,
  type Course,
  type InlineNode,
  type SectionNode,
} from '../src/content/schema';
import type {
  CorrectionAuditEntry,
  LineRangeCorrection,
  ReviewedCourseCorrection,
} from './content-corrections.mts';
import {
  assertCorrectionBackedDecision,
  candidateFingerprint,
  decisionMap,
  type CandidateCategory,
  type CandidateDisposition,
  type CandidateReviewLedger,
} from './candidate-review-ledger.mts';
import { CONTENT_REVIEW_TRUST_ROOT } from './content-review-trust-root.mts';
import { deriveSourceHeadingAnchors } from './source-heading-anchors.mts';
import type { FormulaReviewLedger } from './formula-review-ledger.mts';
import {
  detectCodeCandidates,
  detectFormulaCandidates,
  detectKnowledgeCandidates,
  detectTableCandidates,
  formulaGeometryChecksum,
  spanChecksum,
  type DetectedCandidate,
  type FormulaCandidate,
  type RawSpan,
  type SourceAudit,
} from './source-audit.mts';

export { deriveSourceHeadingAnchors } from './source-heading-anchors.mts';

const EXPECTED_SHA256 =
  '3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52';
const EXPECTED_APPENDIX_SHA256 =
  '0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd';

const VALIDATOR_ROOT = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
const VALIDATOR_CORRECTION_SOURCE_PATH = path.join(
  VALIDATOR_ROOT,
  'scripts/content-corrections.mts',
);
const validatorPinnedInputs: readonly [string, string, string][] = [
  [
    'source audit',
    path.join(VALIDATOR_ROOT, 'src/content/source-audit.generated.json.gz'),
    CONTENT_REVIEW_TRUST_ROOT.sourceAuditSha256,
  ],
  [
    'candidate review ledger',
    path.join(VALIDATOR_ROOT, 'src/content/candidate-review-ledger.json'),
    CONTENT_REVIEW_TRUST_ROOT.candidateLedgerSha256,
  ],
  [
    'formula review ledger',
    path.join(VALIDATOR_ROOT, 'src/content/formula-review-ledger.json'),
    CONTENT_REVIEW_TRUST_ROOT.formulaLedgerSha256,
  ],
  [
    'course-content correction source',
    VALIDATOR_CORRECTION_SOURCE_PATH,
    CONTENT_REVIEW_TRUST_ROOT.courseContentCorrectionsSha256,
  ],
];
for (const [label, filename, expectedDigest] of validatorPinnedInputs) {
  const actualDigest = createHash('sha256')
    .update(readFileSync(filename))
    .digest('hex');
  if (actualDigest !== expectedDigest) {
    throw new Error(
      `Content validation failed: pinned ${label} digest changed`,
    );
  }
}
const {
  APPENDIX_CORRECTION,
  CODE_CORRECTIONS,
  COURSE_CONTENT_CORRECTIONS,
  FORMULA_CORRECTIONS,
  KNOWLEDGE_CHECK_OUTLINE_INDEXES,
  TABLE_CORRECTIONS,
} = await import('./content-corrections.mts');

type CandidateAudit = DetectedCandidate & {
  category: CandidateCategory;
  reviewer: string;
  status: string;
  disposition: CandidateDisposition;
  rationale: string;
  blockId?: string;
};

type ConversionReport = {
  schemaVersion: number;
  generatedAt: string;
  outline: {
    total: number;
    mapped: number;
    coveragePercent: number;
    rootCount: number;
  };
  outlineMap: {
    outlineIndex: number;
    parentOutlineIndex: number | null;
    depth: number;
    titleRaw: string;
    pdfPage: number;
    sectionId: string;
    headingPdfPage: number;
    headingLineIndexes: number[];
    status: string;
  }[];
  spanAccounting: {
    positionedSpanCount: number;
    assignedCount: number;
    excludedCount: number;
    assigned: { spanId: string; blockId: string }[];
    excluded: {
      spanId: string;
      pdfPage: number;
      status: string;
      reason: string;
    }[];
  };
  prosePreservation: Record<RootLabel, ProsePreservationEvidence>;
  specialCandidates: {
    candidateId: string;
    blockId?: string;
    type: CandidateCategory;
    pdfPages: number[];
    status: string;
    reviewer: string;
    disposition: string;
    sourceSpanIds: string[];
    sourceChecksum: string;
  }[];
  candidateAudit: CandidateAudit[];
  correctionAudit: CorrectionAuditEntry[];
  discovered: Record<
    'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks',
    number
  >;
  reviewed: Record<
    'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks',
    number
  >;
  appendix: {
    lineCount: number;
    characterCount: number;
    codeSha256: string;
    sourceChecksum: string;
    astValidatedBy: string;
  };
  unresolvedWarnings: unknown[];
};

const ROOT_RANGES = [
  ['overview', 10, 10],
  ['week1', 11, 20],
  ['week2', 21, 35],
  ['week3', 36, 73],
  ['week4', 74, 84],
  ['week5', 85, 93],
  ['week6', 94, 103],
  ['week7', 104, 112],
  ['week8', 113, 120],
  ['week9', 121, 128],
  ['week10', 129, 138],
  ['week11', 139, 149],
  ['week12', 150, 160],
  ['appendixA', 161, 170],
] as const;

type RootLabel = (typeof ROOT_RANGES)[number][0];

type ProsePreservationEvidence = {
  pageRange: [number, number];
  sourceTokenCount: number;
  outputTokenCount: number;
  sourceTokenChecksum: string;
  outputTokenChecksum: string;
  correctionProjectionIds: string[];
  matches: true;
};

type VisualReviewIndex = {
  version: number;
  sourceSha256: string;
  candidateLedgerSha256: string;
  reviewer: string;
  reviewedPageCount: number;
  sheetColumns: number;
  sheetRows: number;
  sheets: {
    file: string;
    sha256: string;
    cells: {
      pdfPage: number;
      row: number;
      column: number;
      candidateIds: string[];
      candidateFingerprintChecksum: string;
    }[];
  }[];
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Content validation failed: ${message}`);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHyphens(value: string): string {
  return value.replace(/[‐‑–−]/gu, '-').replaceAll('\u00a0', ' ');
}

function tokenSequence(value: string): string[] {
  return (
    normalizeHyphens(value.replace(/(?<=\p{L})[‐‑–−]\r?\n(?=\p{L})/gu, ''))
      .normalize('NFC')
      .replaceAll('\u0000', '')
      .replace(/(\p{Script=Han})/gu, ' $1 ')
      .match(/[\p{L}\p{N}_]+|[^\s]/gu) ?? []
  );
}

function joinAuditWrappedLines(lines: readonly string[]): string {
  return lines.reduce((joined, rawLine) => {
    const line = normalizeHyphens(rawLine).replaceAll('\u0000', '').trim();
    if (!joined) return line;
    if (joined.endsWith('-') && /^\p{L}/u.test(line)) {
      return `${joined.slice(0, -1)}${line}`;
    }
    if (/\p{Script=Latin}$/u.test(joined) && /^\p{Script=Latin}/u.test(line)) {
      return `${joined} ${line}`;
    }
    return `${joined}${line}`;
  }, '');
}

function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      if ('children' in node) return inlineText(node.children);
      return node.type === 'inlineMath' ? node.accessibleText : node.value;
    })
    .join('');
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items
        .map((item, index) =>
          block.ordered
            ? `${index + 1}. ${inlineText(item)}`
            : `・${inlineText(item)}`,
        )
        .join('\n');
    case 'formula':
      return block.accessibleText;
    case 'code':
      return block.code;
    case 'table':
      return [...block.headers, ...block.rows.flat()]
        .map(inlineText)
        .join('\n');
    case 'callout':
      return block.blocks.map(blockText).join('\n');
    case 'conceptChain':
      return block.steps.join(' → ');
    case 'knowledgeCheck':
      return [
        inlineText(block.prompt),
        ...(block.answer ?? []).map(blockText),
      ].join('\n');
  }
}

function allBlocks(course: Readonly<Course>): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const visit = (block: ContentBlock) => {
    blocks.push(block);
    if (block.type === 'callout') block.blocks.forEach(visit);
    if (block.type === 'knowledgeCheck') (block.answer ?? []).forEach(visit);
  };
  for (const root of [course.overview, ...course.units]) {
    for (const section of flattenSections(root)) section.blocks.forEach(visit);
  }
  return blocks;
}

function sectionText(section: SectionNode): string {
  return [
    section.title,
    ...section.blocks
      .filter((block) => !block.id.startsWith('heading-content-'))
      .map(blockText),
    ...section.children.map(sectionText),
  ].join('\n');
}

type IndependentSourceOwner = {
  id: string;
  spans: readonly string[];
  text: string;
};

function correctionAwareSourceRoots(
  audit: SourceAudit,
  formulaLedger: FormulaReviewLedger,
  course: Course,
): Record<RootLabel, { tokens: string[]; projectionIds: string[] }> {
  const sections = [course.overview, ...course.units].flatMap((root) =>
    flattenSections(root),
  );
  const sectionsById = new Map(
    sections.map((section) => [section.id, section]),
  );
  const blocks = allBlocks(course);
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const fragmentText = (
    fragment: Extract<
      ReviewedCourseCorrection['sourceProjection'],
      { kind: 'replace' }
    >['targetFragments'][number],
  ): string => {
    if ('sectionId' in fragment) {
      const section = sectionsById.get(fragment.sectionId);
      invariant(section, `projection section ${fragment.sectionId} is missing`);
      return section.title;
    }
    const block = blocksById.get(fragment.blockId);
    invariant(block, `projection block ${fragment.blockId} is missing`);
    if (fragment.field === 'children') {
      invariant(
        block.type === 'paragraph',
        `${fragment.blockId} projection is not paragraph children`,
      );
      return inlineText(block.children);
    }
    if (fragment.field === 'item') {
      invariant(
        block.type === 'list' && block.items[fragment.itemIndex],
        `${fragment.blockId} projection list item is missing`,
      );
      return `${block.ordered ? `${fragment.itemIndex + 1}. ` : '・'}${inlineText(
        block.items[fragment.itemIndex],
      )}`;
    }
    if (fragment.field === 'steps') {
      invariant(
        block.type === 'conceptChain',
        `${fragment.blockId} projection is not concept-chain steps`,
      );
      return block.steps.join(' → ');
    }
    invariant(
      block.type === 'formula',
      `${fragment.blockId} projection is not formula accessible text`,
    );
    return block.accessibleText;
  };

  const owners: IndependentSourceOwner[] = [];
  const absorptionFormulaIds = new Set(
    COURSE_CONTENT_CORRECTIONS.flatMap((correction) =>
      correction.target.kind === 'formulaAbsorption'
        ? [correction.target.formulaBlockId]
        : [],
    ),
  );
  for (const formula of formulaLedger.formulas) {
    if (!absorptionFormulaIds.has(formula.blockId)) {
      owners.push({
        id: `formula:${formula.candidateId}`,
        spans: formula.sourceSpanIds,
        text: formula.accessibleText,
      });
    }
  }

  const consumedReplacementIds: string[] = [];
  for (const correction of COURSE_CONTENT_CORRECTIONS) {
    const projection = correction.sourceProjection;
    if (projection.kind !== 'replace') continue;
    const guardedSpans = correction.sourceEvidence.flatMap(
      (evidence) => evidence.sourceSpanIds,
    );
    let guardIndex = -1;
    invariant(
      projection.sourceSpanIds.length > 0 &&
        new Set(projection.sourceSpanIds).size ===
          projection.sourceSpanIds.length &&
        projection.sourceSpanIds.every((spanId) => {
          guardIndex = guardedSpans.indexOf(spanId, guardIndex + 1);
          return guardIndex >= 0;
        }),
      `${correction.correctionId} projection is not an ordered guarded subsequence`,
    );
    const projectedSet = new Set(projection.sourceSpanIds);
    const boundaries = correction.sourceEvidence
      .map((evidence) =>
        evidence.sourceSpanIds.filter((spanId) => projectedSet.has(spanId)),
      )
      .filter((spanIds) => spanIds.length > 0);
    const lineBoundaries = correction.sourceEvidence
      .flatMap((evidence) => {
        if (evidence.kind !== 'pageLines') return [];
        const page = audit.pages[evidence.pdfPage - 1];
        invariant(
          page?.pdfPage === evidence.pdfPage,
          `${correction.correctionId} projection page is missing`,
        );
        return evidence.lineIndexes.map((lineIndex) => {
          const line = page.lines[lineIndex];
          invariant(
            line,
            `${correction.correctionId} projection line is missing`,
          );
          return line.spanIds.filter((spanId) => projectedSet.has(spanId));
        });
      })
      .filter((spanIds) => spanIds.length > 0);
    const pairedBoundaries =
      boundaries.length === projection.targetFragments.length
        ? boundaries
        : lineBoundaries.length === projection.targetFragments.length
          ? lineBoundaries
          : undefined;
    invariant(
      Boolean(pairedBoundaries) ||
        (projection.targetFragments.length === 1 && boundaries.length > 0),
      `${correction.correctionId} projection boundary count changed`,
    );
    if (pairedBoundaries) {
      pairedBoundaries.forEach((spans, index) =>
        owners.push({
          id: correction.correctionId,
          spans,
          text: fragmentText(projection.targetFragments[index]),
        }),
      );
    } else {
      owners.push({
        id: correction.correctionId,
        spans: projection.sourceSpanIds,
        text: projection.targetFragments.map(fragmentText).join('\n'),
      });
    }
    consumedReplacementIds.push(correction.correctionId);
  }
  invariant(
    JSON.stringify(consumedReplacementIds) ===
      JSON.stringify(
        COURSE_CONTENT_CORRECTIONS.filter(
          (correction) => correction.sourceProjection.kind === 'replace',
        ).map((correction) => correction.correctionId),
      ),
    'course correction replacement branches were not consumed exactly once',
  );

  const orderedSpanIds = audit.pages.flatMap((page) =>
    page.spans.map((span) => span.id),
  );
  const orderBySpanId = new Map(
    orderedSpanIds.map((spanId, index) => [spanId, index]),
  );
  const ownerBySpanId = new Map<string, IndependentSourceOwner>();
  const ownerByFirstSpanId = new Map<string, IndependentSourceOwner>();
  for (const owner of owners) {
    invariant(
      owner.spans.length > 0 &&
        new Set(owner.spans).size === owner.spans.length,
      `${owner.id} owns no spans or duplicate spans`,
    );
    let previous = -1;
    for (const spanId of owner.spans) {
      const current = orderBySpanId.get(spanId);
      invariant(
        current !== undefined,
        `${owner.id} owns unknown span ${spanId}`,
      );
      invariant(
        current > previous && !ownerBySpanId.has(spanId),
        `${owner.id} owns reordered or overlapping span ${spanId}`,
      );
      previous = current;
      ownerBySpanId.set(spanId, owner);
    }
    invariant(
      !ownerByFirstSpanId.has(owner.spans[0]),
      `duplicate source owner begins at ${owner.spans[0]}`,
    );
    ownerByFirstSpanId.set(owner.spans[0], owner);
  }

  const results = {} as Record<
    RootLabel,
    { tokens: string[]; projectionIds: string[] }
  >;
  for (const [label, firstPage, lastPage] of ROOT_RANGES) {
    const encountered = new Set<IndependentSourceOwner>();
    const projectionIds: string[] = [];
    const sourceLines: string[] = [];
    for (const page of audit.pages) {
      if (page.pdfPage < firstPage || page.pdfPage > lastPage) continue;
      const spansById = new Map(page.spans.map((span) => [span.id, span]));
      for (const line of page.lines) {
        if (line.bbox[1] < 50 || line.bbox[1] > 790) continue;
        let projectedLine = '';
        for (const spanId of line.spanIds) {
          const owner = ownerBySpanId.get(spanId);
          if (!owner) {
            const span = spansById.get(spanId);
            invariant(span, `source line references missing span ${spanId}`);
            projectedLine += span.textRaw;
          } else if (ownerByFirstSpanId.get(spanId) === owner) {
            invariant(
              !encountered.has(owner),
              `${owner.id} source owner was emitted twice`,
            );
            encountered.add(owner);
            projectionIds.push(owner.id);
            projectedLine += owner.text;
          }
        }
        sourceLines.push(projectedLine);
      }
    }
    if (label === 'appendixA') projectionIds.push('CC-25');
    results[label] = {
      tokens: tokenSequence(sourceLines.join('\n')),
      projectionIds,
    };
  }
  const encounteredOwnerCount = Object.values(results).reduce(
    (count, result) =>
      count + result.projectionIds.filter((id) => id !== 'CC-25').length,
    0,
  );
  invariant(
    encounteredOwnerCount === owners.length,
    `source projection consumed ${encounteredOwnerCount}/${owners.length} owners`,
  );
  return results;
}

function sourceRuntimeText(value: string): string {
  return normalizeHyphens(value)
    .replaceAll('\u0000', '')
    .replace(/\s*→\s*/gu, ' → ')
    .trim();
}

function stableSlug(title: string, outlineIndex: number): string {
  if (outlineIndex === 0) return 'readme';
  const ascii = normalizeHyphens(title)
    .normalize('NFKD')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 56);
  return ascii || 'section';
}

function sourceSectionId(outline: SourceAudit['outline'][number]): string {
  return (
    'o' +
    outline.outlineIndex.toString().padStart(4, '0') +
    '-' +
    stableSlug(outline.titleRaw, outline.outlineIndex)
  );
}

function sourceHeadingTitle(
  audit: SourceAudit,
  anchor: ReturnType<typeof deriveSourceHeadingAnchors>[number],
): string {
  const page = audit.pages[anchor.pdfPage - 1];
  return anchor.lineIndexes
    .map((lineIndex) => sourceRuntimeText(page.lines[lineIndex].lineRaw))
    .join('');
}

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

function expectedCandidateAudits(
  audit: SourceAudit,
  ledger: CandidateReviewLedger,
): CandidateAudit[] {
  const detected: [CandidateCategory, DetectedCandidate][] = [
    ...detectFormulaCandidates(audit).map(
      (signal) => ['formula', signal] as [CandidateCategory, DetectedCandidate],
    ),
    ...detectTableCandidates(audit).map(
      (signal) => ['table', signal] as [CandidateCategory, DetectedCandidate],
    ),
    ...detectCodeCandidates(audit).map(
      (signal) => ['code', signal] as [CandidateCategory, DetectedCandidate],
    ),
    ...detectKnowledgeCandidates(audit).map(
      (signal) =>
        ['knowledgeCheck', signal] as [CandidateCategory, DetectedCandidate],
    ),
  ];
  const reviews = decisionMap(ledger);
  invariant(
    ledger.version === 1 &&
      ledger.sourceSha256 === EXPECTED_SHA256 &&
      ledger.candidateCount === detected.length &&
      ledger.decisions.length === detected.length &&
      reviews.size === detected.length,
    'candidate review ledger does not cover all 812 source candidates',
  );
  return detected.map(([category, signal]) => {
    const review = reviews.get(signal.candidateId);
    invariant(
      review,
      `candidate review ledger is missing ${signal.candidateId}`,
    );
    invariant(
      review.category === category &&
        review.pdfPage === signal.pdfPage &&
        review.candidateFingerprint ===
          candidateFingerprint(category, signal) &&
        review.reviewer.trim().length > 0 &&
        review.rationale.trim().length > 0,
      `candidate review ledger fingerprint mismatch for ${signal.candidateId}`,
    );

    const correction =
      category === 'formula'
        ? overlappingCorrection(signal, FORMULA_CORRECTIONS)
        : category === 'table'
          ? overlappingCorrection(signal, TABLE_CORRECTIONS)
          : category === 'code'
            ? overlappingCorrection(signal, CODE_CORRECTIONS)
            : undefined;
    if (category !== 'knowledgeCheck') {
      assertCorrectionBackedDecision(category, review, correction);
    }

    if (category === 'formula') {
      const structured = review.disposition === 'structuredFormula';
      invariant(
        ['structuredFormula', 'inlineMath'].includes(review.disposition) &&
          structured === ('display' in signal && signal.display) &&
          (structured
            ? Boolean(review.targetBlockId)
            : !review.targetBlockId && !review.correctionFingerprint),
        `candidate review ledger disposition mismatch for ${signal.candidateId}`,
      );
    } else if (category === 'table') {
      const structured = review.disposition === 'table';
      invariant(
        ['table', 'notTable'].includes(review.disposition) &&
          (structured
            ? Boolean(review.targetBlockId && review.correctionFingerprint)
            : !review.targetBlockId &&
              !review.correctionFingerprint &&
              !correction),
        `candidate review ledger disposition mismatch for ${signal.candidateId}`,
      );
    } else if (category === 'code') {
      const structured = review.disposition === 'code';
      const appendix = signal.candidateId === 'code-signal-appendix-a';
      invariant(
        ['code', 'notCode'].includes(review.disposition) &&
          (structured
            ? Boolean(review.targetBlockId) &&
              (appendix
                ? review.targetBlockId === APPENDIX_CORRECTION.candidateId &&
                  !review.correctionFingerprint
                : Boolean(review.correctionFingerprint))
            : !review.targetBlockId &&
              !review.correctionFingerprint &&
              !correction),
        `candidate review ledger disposition mismatch for ${signal.candidateId}`,
      );
    } else {
      const structured = review.disposition === 'knowledgeCheck';
      invariant(
        ['knowledgeCheck', 'notKnowledgeCheck'].includes(review.disposition) &&
          !review.correctionFingerprint &&
          (structured ? Boolean(review.targetBlockId) : !review.targetBlockId),
        `candidate review ledger disposition mismatch for ${signal.candidateId}`,
      );
    }
    return {
      ...signal,
      category,
      reviewer: review.reviewer,
      status: 'reviewed',
      disposition: review.disposition,
      rationale: review.rationale,
      ...(review.targetBlockId ? { blockId: review.targetBlockId } : {}),
    };
  });
}

function validateCandidateAudit(
  audit: SourceAudit,
  ledger: CandidateReviewLedger,
  report: ConversionReport,
  blockById: Map<string, ContentBlock>,
): Record<'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks', number> {
  const expected = expectedCandidateAudits(audit, ledger);
  const actualById = new Map(
    report.candidateAudit.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  invariant(
    actualById.size === expected.length &&
      report.candidateAudit.length === expected.length,
    'independent formula candidate or other source candidate is omitted',
  );
  for (const expectedCandidate of expected) {
    const actual = actualById.get(expectedCandidate.candidateId);
    invariant(actual, `${expectedCandidate.category} candidate is omitted`);
    invariant(
      actual.pdfPage === expectedCandidate.pdfPage &&
        JSON.stringify(actual.lineIndexes) ===
          JSON.stringify(expectedCandidate.lineIndexes) &&
        JSON.stringify(actual.sourceSpanIds) ===
          JSON.stringify(expectedCandidate.sourceSpanIds) &&
        actual.sourceChecksum === expectedCandidate.sourceChecksum,
      `${actual.candidateId} source evidence or checksum changed`,
    );
    invariant(
      actual.status === 'reviewed' &&
        actual.reviewer === expectedCandidate.reviewer,
      `${actual.candidateId} is not reviewed`,
    );
    invariant(
      actual.disposition === expectedCandidate.disposition &&
        actual.blockId === expectedCandidate.blockId &&
        actual.rationale === expectedCandidate.rationale,
      `${actual.candidateId} has an invalid disposition`,
    );
    if (actual.blockId) {
      const block = blockById.get(actual.blockId);
      const expectedType =
        actual.disposition === 'structuredFormula'
          ? 'formula'
          : actual.disposition === 'knowledgeCheck'
            ? 'knowledgeCheck'
            : actual.disposition;
      invariant(
        block?.type === expectedType,
        `${actual.candidateId} disposition does not resolve to ${expectedType}`,
      );
    }
  }
  const counts = {
    formulas: expected.filter((item) => item.category === 'formula').length,
    tables: expected.filter((item) => item.category === 'table').length,
    codeBlocks: expected.filter((item) => item.category === 'code').length,
    knowledgeChecks: expected.filter(
      (item) => item.category === 'knowledgeCheck',
    ).length,
  };
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
    invariant(
      report.discovered[key] === counts[key] &&
        report.reviewed[key] === counts[key],
      `${key === 'formulas' ? 'formula candidate' : key} discovered/reviewed count is not independently derived`,
    );
  }
  return counts;
}

function independentFormulaGeometryChecksum(spans: readonly RawSpan[]): string {
  return sha256(
    JSON.stringify(
      spans.map(({ id, textRaw, font, size, bbox, origin }) => ({
        id,
        textRaw,
        font,
        size,
        bbox,
        origin,
      })),
    ),
  );
}

function sourceSpansForFormula(
  audit: SourceAudit,
  candidate: FormulaCandidate,
): RawSpan[] {
  const page = audit.pages[candidate.pdfPage - 1];
  invariant(
    page?.pdfPage === candidate.pdfPage,
    'formula source page is missing',
  );
  const spansById = new Map(page.spans.map((span) => [span.id, span]));
  return candidate.lineIndexes.flatMap((lineIndex) => {
    const line = page.lines[lineIndex];
    invariant(
      line,
      `${candidate.candidateId} formula source line ${lineIndex} is missing`,
    );
    return line.spanIds.map((spanId) => {
      const span = spansById.get(spanId);
      invariant(
        span,
        `${candidate.candidateId} source span ${spanId} is missing`,
      );
      return span;
    });
  });
}

function renderKatexWithoutDiagnostics(
  value: string,
  displayMode: boolean,
  label: string,
): void {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...parts: unknown[]) => {
    warnings.push(parts.map(String).join(' '));
  };
  try {
    katex.renderToString(value, {
      displayMode,
      throwOnError: true,
      strict: 'error',
      output: 'htmlAndMathml',
    });
    invariant(
      warnings.length === 0,
      `${label} emitted KaTeX diagnostics: ${warnings.join(' | ')}`,
    );
  } finally {
    console.warn = originalWarn;
  }
}

function validateFormulaLedger(
  audit: SourceAudit,
  candidateLedger: CandidateReviewLedger,
  formulaLedger: FormulaReviewLedger,
  report: ConversionReport,
  runtimeBlocks: readonly ContentBlock[],
): Extract<ContentBlock, { type: 'formula' }>[] {
  invariant(
    formulaLedger.version === 1 &&
      formulaLedger.sourceSha256 === EXPECTED_SHA256 &&
      formulaLedger.formulaCount === 371 &&
      formulaLedger.formulas.length === 371,
    'formula review ledger metadata changed',
  );
  const detected = detectFormulaCandidates(audit);
  const detectedById = new Map(
    detected.map((candidate) => [candidate.candidateId, candidate]),
  );
  invariant(
    detected.length === 381 && detectedById.size === detected.length,
    'formula detection count or candidate IDs changed',
  );
  const structuredDecisions = candidateLedger.decisions.filter(
    (decision) =>
      decision.category === 'formula' &&
      decision.disposition === 'structuredFormula',
  );
  const inlineCandidateIds = new Set(
    candidateLedger.decisions
      .filter(
        (decision) =>
          decision.category === 'formula' &&
          decision.disposition === 'inlineMath',
      )
      .map((decision) => decision.candidateId),
  );
  const runtimeFormulas = runtimeBlocks.filter(
    (block): block is Extract<ContentBlock, { type: 'formula' }> =>
      block.type === 'formula',
  );
  const candidateIds = formulaLedger.formulas.map((entry) => entry.candidateId);
  const blockIds = formulaLedger.formulas.map((entry) => entry.blockId);
  const decisionCandidateIds = structuredDecisions.map(
    (decision) => decision.candidateId,
  );
  const decisionBlockIds = structuredDecisions.map(
    (decision) => decision.targetBlockId,
  );
  const runtimeBlockIds = runtimeFormulas.map((formula) => formula.id);
  invariant(
    structuredDecisions.length === 371 &&
      inlineCandidateIds.size === 10 &&
      runtimeFormulas.length === 371 &&
      new Set(candidateIds).size === 371 &&
      new Set(blockIds).size === 371 &&
      new Set(runtimeBlockIds).size === 371 &&
      JSON.stringify(candidateIds) === JSON.stringify(decisionCandidateIds) &&
      JSON.stringify(blockIds) === JSON.stringify(decisionBlockIds) &&
      [...new Set(blockIds)].every((blockId) =>
        new Set(runtimeBlockIds).has(blockId),
      ) &&
      candidateIds.every((candidateId) => !inlineCandidateIds.has(candidateId)),
    'formula ledger, decision, or runtime formula sets changed',
  );

  const expectedCorrections = new Map<string, string>([
    ['formula-math-p018-g003', 'CC-01'],
    ['formula-p032-l0019-21', 'CC-04'],
    ['formula-p032-l0023-25', 'CC-04'],
    ['formula-math-p072-g000', 'CC-08'],
  ]);
  const actualCorrections = new Map(
    formulaLedger.formulas
      .filter((entry) => entry.contentCorrectionId !== undefined)
      .map((entry) => [entry.blockId, entry.contentCorrectionId!]),
  );
  invariant(
    JSON.stringify([...actualCorrections]) ===
      JSON.stringify([...expectedCorrections]),
    'formula content-correction map changed',
  );

  const runtimeById = new Map(
    runtimeFormulas.map((formula) => [formula.id, formula]),
  );
  for (const [index, entry] of formulaLedger.formulas.entries()) {
    const candidate = detectedById.get(entry.candidateId);
    const decision = structuredDecisions[index];
    invariant(
      candidate,
      `formula ledger candidate ${entry.candidateId} is missing`,
    );
    const spans = sourceSpansForFormula(audit, candidate);
    const runtime = runtimeById.get(entry.blockId);
    const candidateReport = report.candidateAudit.find(
      (record) => record.candidateId === entry.candidateId,
    );
    const structuredReport = report.specialCandidates.find(
      (record) => record.blockId === entry.blockId && record.type === 'formula',
    );
    invariant(
      decision.candidateId === entry.candidateId &&
        decision.targetBlockId === entry.blockId &&
        entry.pdfPage === candidate.pdfPage &&
        JSON.stringify(entry.lineIndexes) ===
          JSON.stringify(candidate.lineIndexes) &&
        JSON.stringify(entry.sourceSpanIds) ===
          JSON.stringify(candidate.sourceSpanIds) &&
        JSON.stringify(entry.sourceSpanIds) ===
          JSON.stringify(spans.map((span) => span.id)) &&
        entry.sourceChecksum === candidate.sourceChecksum &&
        entry.sourceChecksum === spanChecksum(spans) &&
        entry.sourceGeometryChecksum ===
          independentFormulaGeometryChecksum(spans) &&
        entry.contentCorrectionId === expectedCorrections.get(entry.blockId) &&
        entry.status === 'reviewed' &&
        entry.reviewer.trim().length > 0 &&
        entry.latex.trim().length > 0 &&
        entry.accessibleText.trim().length > 0,
      `${entry.candidateId} formula ledger source or metadata changed`,
    );
    invariant(
      runtime?.source.pdfPage === entry.pdfPage &&
        runtime.latex === entry.latex &&
        runtime.accessibleText === entry.accessibleText,
      `${entry.blockId} runtime formula payload changed`,
    );
    invariant(
      candidateReport?.blockId === entry.blockId &&
        candidateReport.pdfPage === entry.pdfPage &&
        JSON.stringify(candidateReport.lineIndexes) ===
          JSON.stringify(entry.lineIndexes) &&
        JSON.stringify(candidateReport.sourceSpanIds) ===
          JSON.stringify(entry.sourceSpanIds) &&
        candidateReport.sourceChecksum === entry.sourceChecksum &&
        structuredReport?.candidateId === entry.blockId &&
        JSON.stringify(structuredReport.pdfPages) ===
          JSON.stringify([entry.pdfPage]) &&
        JSON.stringify(structuredReport.sourceSpanIds) ===
          JSON.stringify(entry.sourceSpanIds) &&
        structuredReport.sourceChecksum === entry.sourceChecksum,
      `${entry.candidateId} generated formula evidence changed`,
    );
    renderKatexWithoutDiagnostics(entry.latex, true, entry.blockId);
  }

  const vectorEntry = formulaLedger.formulas.find(
    (entry) => entry.candidateId === 'math-p012-g000',
  );
  const vectorCandidate = detectedById.get('math-p012-g000');
  invariant(
    vectorEntry &&
      vectorCandidate &&
      vectorEntry.blockId === 'formula-math-p012-g000',
    'physical-page-12 vector formula ledger entry is missing',
  );
  const vectorLines = vectorCandidate.lineIndexes.map(
    (lineIndex) => audit.pages[11].lines[lineIndex],
  );
  const vectorRows = vectorLines.filter((line) =>
    /^(?:100|3|8)$/u.test(sourceRuntimeText(line.lineRaw)),
  );
  invariant(
    JSON.stringify(vectorCandidate.lineIndexes) ===
      JSON.stringify([21, 22, 23, 24, 25]) &&
      vectorRows.length === 3 &&
      new Set(vectorRows.map((line) => line.bbox[1])).size === 3,
    'physical-page-12 vector formula source geometry changed',
  );
  return runtimeFormulas;
}

function allowedExclusionReasons(audit: SourceAudit): Map<string, string> {
  const reasons = new Map<string, string>();
  const anchors = deriveSourceHeadingAnchors(audit);
  const headingByLine = new Map<string, number>();
  for (const anchor of anchors)
    for (const lineIndex of anchor.lineIndexes)
      headingByLine.set(`${anchor.pdfPage}:${lineIndex}`, anchor.outlineIndex);
  for (const page of audit.pages) {
    for (const [lineIndex, line] of page.lines.entries()) {
      let reason: string | undefined;
      if (page.pdfPage === 1) reason = 'Cover represented by course metadata';
      else if (page.pdfPage <= 9)
        reason =
          'Printed table of contents replaced by recursive web navigation';
      else if (line.bbox[1] > 790) reason = 'Printed page footer';
      else if (line.bbox[1] < 50) reason = 'Repeated running header';
      else {
        const outlineIndex = headingByLine.get(`${page.pdfPage}:${lineIndex}`);
        if (outlineIndex !== undefined)
          reason = `Represented by outline section ${sourceSectionId(audit.outline[outlineIndex])}`;
        else if (!line.lineRaw.replaceAll('\u0000', '').trim())
          reason = 'Empty visual artifact';
      }
      if (reason)
        for (const spanId of line.spanIds) reasons.set(spanId, reason);
    }
  }
  return reasons;
}

type SourceParagraphGroup = {
  outlineIndex: number;
  blockId: string;
  barrierBefore: boolean;
  lines: {
    pdfPage: number;
    lineIndex: number;
    line: SourceAudit['pages'][number]['lines'][number];
  }[];
  text: string;
};

function shouldJoinSourceParagraphs(
  left: SourceParagraphGroup,
  right: SourceParagraphGroup,
): boolean {
  if (/^[・•]|^\d+[.)]\s+/u.test(right.text)) return false;
  const previous = left.lines.at(-1)!;
  const next = right.lines[0];
  const continuesArrow = right.text.startsWith('→');
  const bodyHeight = previous.line.bbox[3] - previous.line.bbox[1] >= 9.4;
  const aligned = Math.abs(previous.line.bbox[0] - next.line.bbox[0]) <= 4;
  const fullLine = previous.line.bbox[2] >= 500 || left.text.endsWith('-');
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

function independentSourceParagraphKeys(
  audit: SourceAudit,
  anchors: ReturnType<typeof deriveSourceHeadingAnchors>,
): string[] {
  const headingByLine = new Map<string, number>();
  for (const anchor of anchors)
    for (const lineIndex of anchor.lineIndexes)
      headingByLine.set(anchor.pdfPage + ':' + lineIndex, anchor.outlineIndex);

  const structuredLines = new Set<string>();
  for (const signal of detectFormulaCandidates(audit)) {
    if (!signal.display) continue;
    for (const lineIndex of signal.lineIndexes)
      structuredLines.add(signal.pdfPage + ':' + lineIndex);
  }
  for (const correction of [...TABLE_CORRECTIONS, ...CODE_CORRECTIONS])
    for (const lineIndex of correction.lineIndexes)
      structuredLines.add(correction.pdfPage + ':' + lineIndex);
  for (const page of audit.pages.filter(
    (candidate) => candidate.pdfPage >= 161,
  )) {
    const spanById = new Map(page.spans.map((span) => [span.id, span]));
    for (const [lineIndex, line] of page.lines.entries()) {
      if (
        line.bbox[1] < 790 &&
        (page.pdfPage === 161 ? lineIndex >= 2 : line.bbox[1] >= 50) &&
        Math.max(...line.spanIds.map((spanId) => spanById.get(spanId)!.size)) <
          8
      ) {
        structuredLines.add(page.pdfPage + ':' + lineIndex);
      }
    }
  }

  const atomicByOutline = new Map<number, SourceParagraphGroup[]>();
  const barrierByOutline = new Set<number>();
  let activeOutline: number | undefined;
  let bodySequence = 0;
  for (const page of audit.pages) {
    for (const [lineIndex, line] of page.lines.entries()) {
      const key = page.pdfPage + ':' + lineIndex;
      const heading = headingByLine.get(key);
      if (heading !== undefined) {
        activeOutline = heading;
        barrierByOutline.add(heading);
        continue;
      }
      if (structuredLines.has(key)) {
        if (activeOutline !== undefined) barrierByOutline.add(activeOutline);
        continue;
      }
      if (page.pdfPage < 10 || line.bbox[1] < 50 || line.bbox[1] > 790) {
        continue;
      }
      const text = sourceRuntimeText(line.lineRaw);
      if (!text) continue;
      invariant(
        activeOutline !== undefined,
        `source body line ${line.id} has no independently derived outline`,
      );
      const groups = atomicByOutline.get(activeOutline) ?? [];
      groups.push({
        outlineIndex: activeOutline,
        blockId: `body-${String(bodySequence).padStart(5, '0')}`,
        barrierBefore: barrierByOutline.delete(activeOutline),
        lines: [{ pdfPage: page.pdfPage, lineIndex, line }],
        text,
      });
      bodySequence += 1;
      atomicByOutline.set(activeOutline, groups);
    }
  }

  const reviewedParagraphText = new Map<string, string>();
  const absorbedParagraphIds = new Set<string>();
  for (const correction of COURSE_CONTENT_CORRECTIONS) {
    if (correction.target.kind === 'paragraph') {
      for (const patch of correction.target.patches) {
        reviewedParagraphText.set(patch.blockId, inlineText(patch.children));
      }
    }
    if (correction.target.kind === 'formulaAbsorption') {
      correction.target.absorbedBlockIds.forEach((blockId) =>
        absorbedParagraphIds.add(blockId),
      );
    }
  }

  const paragraphKeys: string[] = [];
  for (const [outlineIndex, atomic] of atomicByOutline) {
    if (
      KNOWLEDGE_CHECK_OUTLINE_INDEXES.includes(
        outlineIndex as (typeof KNOWLEDGE_CHECK_OUTLINE_INDEXES)[number],
      )
    ) {
      continue;
    }
    const merged: SourceParagraphGroup[] = [];
    for (const group of atomic) {
      const previous = merged.at(-1);
      if (
        previous &&
        !group.barrierBefore &&
        shouldJoinSourceParagraphs(previous, group)
      ) {
        previous.lines.push(...group.lines);
        previous.text = joinAuditWrappedLines([previous.text, group.text]);
      } else {
        merged.push(group);
      }
    }

    const paragraphGroups: SourceParagraphGroup[] = [];
    for (let index = 0; index < merged.length;) {
      const unordered = merged[index].text.match(/^[・•]\s*(.+)$/u);
      const ordered = merged[index].text.match(/^\d+[.)]\s+(.+)$/u);
      if (!unordered && !ordered) {
        paragraphGroups.push(merged[index]);
        index += 1;
        continue;
      }
      const start = index;
      const isOrdered = Boolean(ordered);
      while (index < merged.length) {
        if (index > start && merged[index].barrierBefore) break;
        const match = merged[index].text.match(
          isOrdered ? /^\d+[.)]\s+(.+)$/u : /^[・•]\s*(.+)$/u,
        );
        if (!match) break;
        index += 1;
      }
      if (index - start < 2)
        paragraphGroups.push(...merged.slice(start, index));
    }

    for (const group of paragraphGroups) {
      if ((group.text.match(/→/gu)?.length ?? 0) >= 2) continue;
      if (absorbedParagraphIds.has(group.blockId)) continue;
      const expectedText =
        reviewedParagraphText.get(group.blockId) ?? group.text;
      paragraphKeys.push(
        sourceSectionId(audit.outline[outlineIndex]) +
          '\u0000' +
          group.blockId +
          '\u0000' +
          JSON.stringify(tokenSequence(expectedText)),
      );
    }
  }
  return paragraphKeys;
}

function runtimeParagraphKeys(audit: SourceAudit, course: Course): string[] {
  const selectedKnowledgeIds = new Set(
    KNOWLEDGE_CHECK_OUTLINE_INDEXES.map((index) =>
      sourceSectionId(audit.outline[index]),
    ),
  );
  const keys: string[] = [];
  const visitBlock = (sectionId: string, block: ContentBlock): void => {
    if (
      block.type === 'paragraph' &&
      !block.id.startsWith('heading-content-')
    ) {
      keys.push(
        sectionId +
          '\u0000' +
          block.id +
          '\u0000' +
          JSON.stringify(tokenSequence(blockText(block))),
      );
    }
    if (block.type === 'callout')
      block.blocks.forEach((child) => visitBlock(sectionId, child));
    if (block.type === 'knowledgeCheck')
      (block.answer ?? []).forEach((child) => visitBlock(sectionId, child));
  };
  for (const root of [course.overview, ...course.units]) {
    for (const section of flattenSections(root)) {
      if (selectedKnowledgeIds.has(section.id)) continue;
      section.blocks.forEach((block) => visitBlock(section.id, block));
    }
  }
  return keys;
}

function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  invariant(
    bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8,
    'pinned review sheet is not a JPEG',
  );
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01) continue;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    invariant(
      length >= 2 && offset + length <= bytes.length,
      'pinned review JPEG segment is invalid',
    );
    if (startOfFrame.has(marker)) {
      return {
        height: bytes.readUInt16BE(offset + 3),
        width: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }
  throw new Error(
    'Content validation failed: pinned review JPEG dimensions are missing',
  );
}

function readTrustedReviewEvidence(repositoryRoot: string): {
  ledger: CandidateReviewLedger;
  index: VisualReviewIndex;
} {
  const ledgerPath = path.join(
    repositoryRoot,
    'src/content/candidate-review-ledger.json',
  );
  const evidenceRoot = path.join(
    repositoryRoot,
    'reports/content-review-evidence',
  );
  const ledgerBytes = readFileSync(ledgerPath);
  const indexBytes = readFileSync(path.join(evidenceRoot, 'index.json'));
  invariant(
    sha256(ledgerBytes) === CONTENT_REVIEW_TRUST_ROOT.candidateLedgerSha256,
    'pinned review ledger digest changed',
  );
  invariant(
    sha256(indexBytes) === CONTENT_REVIEW_TRUST_ROOT.visualIndexSha256,
    'pinned review index digest changed',
  );
  for (const [filename, expectedSha256] of Object.entries(
    CONTENT_REVIEW_TRUST_ROOT.sheetSha256,
  )) {
    const bytes = readFileSync(path.join(evidenceRoot, filename));
    invariant(
      sha256(bytes) === expectedSha256,
      `pinned review sheet digest changed: ${filename}`,
    );
    const dimensions = jpegDimensions(bytes);
    invariant(
      dimensions.width === CONTENT_REVIEW_TRUST_ROOT.sheetWidth &&
        dimensions.height === CONTENT_REVIEW_TRUST_ROOT.sheetHeight,
      `pinned review sheet dimensions changed: ${filename}`,
    );
  }
  return {
    ledger: JSON.parse(ledgerBytes.toString('utf8')) as CandidateReviewLedger,
    index: JSON.parse(indexBytes.toString('utf8')) as VisualReviewIndex,
  };
}

function validateVisualReviewEvidence(
  repositoryRoot: string,
  ledger: CandidateReviewLedger,
  index: VisualReviewIndex,
): void {
  const evidenceRoot = path.join(
    repositoryRoot,
    'reports/content-review-evidence',
  );
  const pinnedSheetNames = Object.keys(
    CONTENT_REVIEW_TRUST_ROOT.sheetSha256,
  ).sort();
  const indexedSheetNames = index.sheets.map((sheet) => sheet.file).sort();
  invariant(
    index.version === 1 &&
      index.sourceSha256 === EXPECTED_SHA256 &&
      index.candidateLedgerSha256 === sha256(JSON.stringify(ledger)) &&
      index.reviewer.trim().length > 0 &&
      index.reviewedPageCount === 148 &&
      index.sheetColumns === 4 &&
      index.sheetRows === 3 &&
      index.sheets.length === 13 &&
      new Set(indexedSheetNames).size === indexedSheetNames.length &&
      JSON.stringify(indexedSheetNames) === JSON.stringify(pinnedSheetNames),
    'visual review evidence index metadata is invalid',
  );
  const decisionsByPage = new Map<number, typeof ledger.decisions>();
  for (const decision of ledger.decisions) {
    const decisions = decisionsByPage.get(decision.pdfPage) ?? [];
    decisions.push(decision);
    decisionsByPage.set(decision.pdfPage, decisions);
  }
  const cells = index.sheets.flatMap((sheet) => {
    const bytes = readFileSync(path.join(evidenceRoot, sheet.file));
    invariant(
      sha256(bytes) === sheet.sha256 &&
        sheet.sha256 ===
          CONTENT_REVIEW_TRUST_ROOT.sheetSha256[
            sheet.file as keyof typeof CONTENT_REVIEW_TRUST_ROOT.sheetSha256
          ],
      `visual review evidence sheet checksum changed: ${sheet.file}`,
    );
    invariant(
      sheet.cells.length > 0 && sheet.cells.length <= 12,
      `visual review evidence sheet cell count is invalid: ${sheet.file}`,
    );
    return sheet.cells;
  });
  const coordinateKeys = index.sheets.flatMap((sheet) =>
    sheet.cells.map((cell) => `${sheet.file}:${cell.row}:${cell.column}`),
  );
  invariant(
    cells.length === 148 &&
      new Set(cells.map((cell) => cell.pdfPage)).size === 148 &&
      new Set(coordinateKeys).size === coordinateKeys.length &&
      cells.every((cell) => {
        const decisions = [...(decisionsByPage.get(cell.pdfPage) ?? [])].sort(
          (left, right) => left.candidateId.localeCompare(right.candidateId),
        );
        return (
          cell.row >= 0 &&
          cell.row < 3 &&
          cell.column >= 0 &&
          cell.column < 4 &&
          cell.pdfPage >= 1 &&
          cell.pdfPage <= 170 &&
          JSON.stringify(cell.candidateIds) ===
            JSON.stringify(decisions.map((decision) => decision.candidateId)) &&
          cell.candidateFingerprintChecksum ===
            sha256(
              JSON.stringify(
                decisions.map((decision) => decision.candidateFingerprint),
              ),
            )
        );
      }) &&
      cells.every((cell) => decisionsByPage.has(cell.pdfPage)) &&
      [...decisionsByPage].every(([pdfPage]) =>
        cells.some((cell) => cell.pdfPage === pdfPage),
      ),
    'visual review evidence does not map every candidate page and fingerprint',
  );
}

function exactObjectKeys(value: object, expected: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort())
  );
}

function independentCorrectionOutcome(
  correction: ReviewedCourseCorrection,
): CorrectionAuditEntry['outcome'] {
  if (correction.target.kind === 'formulaReference')
    return 'assertedFormulaReference';
  if (correction.target.kind === 'excludedNavigation')
    return 'excludedNavigation';
  if (correction.target.kind === 'sourceOnlyNoop') return 'sourceOnlyNoop';
  if (correction.sourceProjection.kind === 'unchangedSemanticBlock')
    return 'semanticNoop';
  return 'applied';
}

function courseRuntimeIndexes(course: Course): {
  sectionById: Map<string, SectionNode>;
  blockById: Map<string, ContentBlock>;
  sectionIdByBlockId: Map<string, string>;
} {
  const sectionById = new Map<string, SectionNode>();
  const blockById = new Map<string, ContentBlock>();
  const sectionIdByBlockId = new Map<string, string>();
  const visitBlock = (sectionId: string, block: ContentBlock): void => {
    invariant(!blockById.has(block.id), `duplicate runtime block ${block.id}`);
    blockById.set(block.id, block);
    sectionIdByBlockId.set(block.id, sectionId);
    if (block.type === 'callout') {
      block.blocks.forEach((child) => visitBlock(sectionId, child));
    }
    if (block.type === 'knowledgeCheck') {
      (block.answer ?? []).forEach((child) => visitBlock(sectionId, child));
    }
  };
  for (const root of [course.overview, ...course.units]) {
    for (const section of flattenSections(root)) {
      invariant(
        !sectionById.has(section.id),
        `duplicate runtime section ${section.id}`,
      );
      sectionById.set(section.id, section);
      section.blocks.forEach((block) => visitBlock(section.id, block));
    }
  }
  return { sectionById, blockById, sectionIdByBlockId };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function expectedCorrectionAuditTarget(
  correction: ReviewedCourseCorrection,
  sectionIdByBlockId: ReadonlyMap<string, string>,
): CorrectionAuditEntry['target'] {
  const target = correction.target;
  switch (target.kind) {
    case 'paragraph': {
      const blockIds = target.guardBlockIds
        ? [...target.guardBlockIds]
        : target.patches.map((patch) => patch.blockId);
      return {
        kind: target.kind,
        sectionIds: uniqueStrings(
          blockIds.map((blockId) => {
            const sectionId = sectionIdByBlockId.get(blockId);
            invariant(sectionId, `${correction.correctionId} block is missing`);
            return sectionId;
          }),
        ),
        blockIds,
      };
    }
    case 'list':
    case 'conceptChain':
      return {
        kind: target.kind,
        sectionIds: [target.sectionId],
        blockIds: [target.blockId],
      };
    case 'listItem':
      return {
        kind: target.kind,
        sectionIds: [target.sectionId],
        blockIds: [target.blockId],
        itemIndex: target.itemIndex,
      };
    case 'sectionTitle':
      return {
        kind: target.kind,
        sectionIds: [target.sectionId],
        blockIds: [],
      };
    case 'formulaAbsorption':
      return {
        kind: target.kind,
        sectionIds: [target.sectionId],
        blockIds: [target.formulaBlockId, ...target.absorbedBlockIds],
      };
    case 'formulaReference':
      return {
        kind: target.kind,
        sectionIds: uniqueStrings(
          target.blockIds.map((blockId) => {
            const sectionId = sectionIdByBlockId.get(blockId);
            invariant(
              sectionId,
              `${correction.correctionId} formula is missing`,
            );
            return sectionId;
          }),
        ),
        blockIds: [...target.blockIds],
      };
    case 'excludedNavigation':
      return { kind: target.kind, sectionIds: [], blockIds: [] };
    case 'sourceOnlyNoop':
      return {
        kind: target.kind,
        sectionIds: [target.sectionId],
        blockIds: [...target.comparisonBlockIds],
      };
  }
}

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
} satisfies Record<string, number[]>;

function validateCorrectionEvidence(
  correction: ReviewedCourseCorrection,
  audit: SourceAudit,
): void {
  const expectedMultiCounts = new Map([
    ['CC-06', 2],
    ['CC-17', 2],
    ['CC-19', 2],
    ['CC-22', 2],
    ['CC-23', 3],
  ]);
  const pageLines = correction.sourceEvidence.filter(
    (evidence) => evidence.kind === 'pageLines',
  );
  const selectors = correction.sourceEvidence.filter(
    (evidence) => evidence.kind === 'crossPageSelector',
  );
  const isCc25 = correction.correctionId === 'CC-25';
  invariant(
    pageLines.length ===
      (isCc25 ? 0 : (expectedMultiCounts.get(correction.correctionId) ?? 1)) &&
      selectors.length === (isCc25 ? 1 : 0) &&
      correction.sourceEvidence.length === pageLines.length + selectors.length,
    `${correction.correctionId} source-evidence cardinality changed`,
  );
  for (const evidence of correction.sourceEvidence) {
    if (evidence.kind === 'pageLines') {
      invariant(
        exactObjectKeys(evidence, [
          'kind',
          'pdfPage',
          'lineIndexes',
          'sourceSpanIds',
          'sourceChecksum',
          'sourceGeometryChecksum',
        ]),
        `${correction.correctionId} pageLines wire keys changed`,
      );
      const page = audit.pages[evidence.pdfPage - 1];
      invariant(
        page?.pdfPage === evidence.pdfPage,
        'evidence source page is missing',
      );
      const spanById = new Map(page.spans.map((span) => [span.id, span]));
      const spans = evidence.lineIndexes.flatMap((lineIndex) => {
        const line = page.lines[lineIndex];
        invariant(line, `${correction.correctionId} evidence line is missing`);
        return line.spanIds.map((spanId) => {
          const span = spanById.get(spanId);
          invariant(
            span,
            `${correction.correctionId} evidence span is missing`,
          );
          return span;
        });
      });
      invariant(
        JSON.stringify(spans.map((span) => span.id)) ===
          JSON.stringify(evidence.sourceSpanIds) &&
          spanChecksum(spans) === evidence.sourceChecksum &&
          independentFormulaGeometryChecksum(spans) ===
            evidence.sourceGeometryChecksum,
        `${correction.correctionId} pageLines source evidence changed`,
      );
      continue;
    }
    invariant(
      exactObjectKeys(evidence, [
        'kind',
        'pageRange',
        'selector',
        'lineIndexesByPage',
        'sourceSpanIds',
        'sourceChecksum',
        'sourceGeometryChecksum',
      ]) &&
        JSON.stringify(evidence.pageRange) === JSON.stringify([161, 169]) &&
        evidence.selector === 'textRaw-includes-U+2011' &&
        JSON.stringify(evidence.lineIndexesByPage) ===
          JSON.stringify(CC25_LINE_INDEXES_BY_PAGE),
      'CC-25 cross-page selector contract changed',
    );
    const selected = audit.pages
      .filter((page) => page.pdfPage >= 161 && page.pdfPage <= 169)
      .flatMap((page) =>
        page.spans.filter((span) => span.textRaw.includes('\u2011')),
      );
    const selectedIds = selected.map((span) => span.id);
    const selectedSet = new Set(selectedIds);
    const selectedLines = Object.fromEntries(
      audit.pages
        .filter((page) => page.pdfPage >= 161 && page.pdfPage <= 169)
        .map((page) => [
          `p${page.pdfPage}`,
          page.lines
            .map((line, lineIndex) =>
              line.spanIds.some((spanId) => selectedSet.has(spanId))
                ? lineIndex
                : -1,
            )
            .filter((lineIndex) => lineIndex >= 0),
        ])
        .filter(([, lineIndexes]) => (lineIndexes as number[]).length > 0),
    );
    const occurrenceCount = selected.reduce(
      (count, span) => count + span.textRaw.split('\u2011').length - 1,
      0,
    );
    invariant(
      selected.length === 75 &&
        Object.values(selectedLines).flat().length === 73 &&
        occurrenceCount === 129 &&
        JSON.stringify(selectedLines) ===
          JSON.stringify(CC25_LINE_INDEXES_BY_PAGE) &&
        JSON.stringify(selectedIds) ===
          JSON.stringify(evidence.sourceSpanIds) &&
        sha256(JSON.stringify(selectedIds)) ===
          '704586b0ec112462218d592f21a8b1e064312aa41682c02a87e77dc4b1ddb1b3' &&
        spanChecksum(selected) ===
          'd738e50f29670ec57f26f1f33999608dfd0ea7abe6f19ea0d79b3200dcb29312' &&
        evidence.sourceChecksum ===
          'd738e50f29670ec57f26f1f33999608dfd0ea7abe6f19ea0d79b3200dcb29312' &&
        independentFormulaGeometryChecksum(selected) ===
          'f42023a6976106fc0708117bfd4716b841316929657a19b0dfc4b9762bd6854b' &&
        evidence.sourceGeometryChecksum ===
          'f42023a6976106fc0708117bfd4716b841316929657a19b0dfc4b9762bd6854b',
      'CC-25 selected source spans, counts, or checksums changed',
    );
  }
}

function validateCourseCorrectionAudit(
  audit: SourceAudit,
  formulaLedger: FormulaReviewLedger,
  candidateLedger: CandidateReviewLedger,
  course: Course,
  report: ConversionReport,
): {
  pageLines: number;
  selectors: number;
  applied: number;
  nonMutating: number;
} {
  const { sectionById, blockById, sectionIdByBlockId } =
    courseRuntimeIndexes(course);
  const trustedIds = COURSE_CONTENT_CORRECTIONS.map(
    (correction) => correction.correctionId,
  );
  const expectedIds = [
    'body-fraction-p023-gradient',
    'body-fraction-p025-chain-rule',
    'body-fraction-p025-result',
    'body-neuron-nodes-p071',
    'body-value-dv-p108',
    'body-row42-p125',
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
    ...Array.from(
      { length: 25 },
      (_, index) => `CC-${String(index + 1).padStart(2, '0')}`,
    ),
  ];
  invariant(
    COURSE_CONTENT_CORRECTIONS.length === 41 &&
      report.correctionAudit.length === 41 &&
      new Set(trustedIds).size === 41 &&
      JSON.stringify(trustedIds) === JSON.stringify(expectedIds) &&
      JSON.stringify(
        report.correctionAudit.map((entry) => entry.correctionId),
      ) === JSON.stringify(expectedIds),
    'course-correction count, IDs, or order changed',
  );
  const expectedInlineCandidates = candidateLedger.decisions
    .filter(
      (decision) =>
        decision.category === 'formula' &&
        decision.disposition === 'inlineMath',
    )
    .map((decision) => decision.candidateId);
  invariant(
    JSON.stringify(
      COURSE_CONTENT_CORRECTIONS.filter(
        (correction) => correction.category === 'inlineMath',
      ).map((correction) => correction.candidateId),
    ) === JSON.stringify(expectedInlineCandidates),
    'inline-math correction candidate coverage changed',
  );

  const categoryCounts = { fidelity: 0, inlineMath: 0, correctness: 0 };
  const outcomeCounts = {
    applied: 0,
    assertedFormulaReference: 0,
    semanticNoop: 0,
    sourceOnlyNoop: 0,
    excludedNavigation: 0,
  };
  let pageLines = 0;
  let selectors = 0;
  const formulaByBlockId = new Map(
    formulaLedger.formulas.map((formula) => [formula.blockId, formula]),
  );
  for (const [index, correction] of COURSE_CONTENT_CORRECTIONS.entries()) {
    const entry = report.correctionAudit[index];
    validateCorrectionEvidence(correction, audit);
    categoryCounts[correction.category] += 1;
    const outcome = independentCorrectionOutcome(correction);
    outcomeCounts[outcome] += 1;
    pageLines += correction.sourceEvidence.filter(
      (evidence) => evidence.kind === 'pageLines',
    ).length;
    selectors += correction.sourceEvidence.filter(
      (evidence) => evidence.kind === 'crossPageSelector',
    ).length;
    const isCorrectness = correction.category === 'correctness';
    invariant(
      correction.status === 'reviewed' &&
        correction.reviewer ===
          (isCorrectness
            ? 'Codex content-correctness independent rereview'
            : correction.category === 'fidelity'
              ? 'Codex body/inline correction design'
              : 'Codex rendered-source candidate review') &&
        (isCorrectness
          ? correction.contentCorrectionId === correction.correctionId &&
            correction.candidateId === undefined
          : correction.contentCorrectionId === undefined) &&
        (correction.category === 'inlineMath'
          ? Boolean(correction.candidateId)
          : correction.candidateId === undefined),
      `${correction.correctionId} trusted metadata changed`,
    );
    const auditTarget = expectedCorrectionAuditTarget(
      correction,
      sectionIdByBlockId,
    );
    const evidenceIncludesPage = (pdfPage: number): boolean =>
      correction.sourceEvidence.some((evidence) =>
        evidence.kind === 'pageLines'
          ? evidence.pdfPage === pdfPage
          : pdfPage >= evidence.pageRange[0] &&
            pdfPage <= evidence.pageRange[1],
      );
    for (const blockId of auditTarget.blockIds) {
      const block = blockById.get(blockId);
      if (block) {
        invariant(
          evidenceIncludesPage(block.source.pdfPage),
          `${correction.correctionId} target ${blockId} is outside guarded pages`,
        );
      }
    }
    for (const sectionId of auditTarget.sectionIds) {
      const section = sectionById.get(sectionId);
      invariant(
        section,
        `${correction.correctionId} target section is missing`,
      );
      invariant(
        evidenceIncludesPage(section.source.pdfPage) ||
          auditTarget.blockIds.some((blockId) =>
            evidenceIncludesPage(blockById.get(blockId)?.source.pdfPage ?? -1),
          ),
        `${correction.correctionId} target section is outside guarded pages`,
      );
    }
    const expectedReplacementFingerprint =
      correction.target.kind === 'excludedNavigation'
        ? null
        : sha256(JSON.stringify(correction.target));
    invariant(
      exactObjectKeys(entry, [
        'correctionId',
        'category',
        ...(correction.candidateId ? ['candidateId'] : []),
        ...(correction.contentCorrectionId ? ['contentCorrectionId'] : []),
        'outcome',
        'target',
        'sourceEvidence',
        'expectedTargetFingerprint',
        'actualTargetFingerprint',
        'replacementFingerprint',
        'reviewer',
        'status',
      ]) &&
        entry.correctionId === correction.correctionId &&
        entry.category === correction.category &&
        entry.candidateId === correction.candidateId &&
        entry.contentCorrectionId === correction.contentCorrectionId &&
        entry.outcome === outcome &&
        JSON.stringify(entry.target) === JSON.stringify(auditTarget) &&
        JSON.stringify(entry.sourceEvidence) ===
          JSON.stringify(correction.sourceEvidence) &&
        entry.expectedTargetFingerprint ===
          correction.expectedTargetFingerprint &&
        entry.actualTargetFingerprint ===
          correction.expectedTargetFingerprint &&
        entry.replacementFingerprint === expectedReplacementFingerprint &&
        entry.reviewer === correction.reviewer &&
        entry.status === 'reviewed' &&
        (correction.target.kind === 'excludedNavigation'
          ? entry.expectedTargetFingerprint === null &&
            entry.actualTargetFingerprint === null &&
            entry.replacementFingerprint === null
          : /^[0-9a-f]{64}$/u.test(entry.expectedTargetFingerprint ?? '') &&
            /^[0-9a-f]{64}$/u.test(entry.actualTargetFingerprint ?? '') &&
            /^[0-9a-f]{64}$/u.test(entry.replacementFingerprint ?? '')),
      `${correction.correctionId} correction-audit provenance changed`,
    );

    const target = correction.target;
    if (target.kind === 'paragraph') {
      for (const patch of target.patches) {
        const block = blockById.get(patch.blockId);
        invariant(
          block?.type === 'paragraph' &&
            sectionIdByBlockId.get(patch.blockId) === patch.sectionId &&
            JSON.stringify(block.children) === JSON.stringify(patch.children),
          `${correction.correctionId} paragraph target changed`,
        );
      }
      for (const blockId of target.guardBlockIds ?? []) {
        invariant(
          blockById.get(blockId)?.type === 'paragraph',
          `${correction.correctionId} paragraph guard changed`,
        );
      }
    } else if (target.kind === 'list') {
      const block = blockById.get(target.blockId);
      invariant(
        block?.type === 'list' &&
          sectionIdByBlockId.get(target.blockId) === target.sectionId &&
          block.ordered === target.ordered &&
          JSON.stringify(block.items) === JSON.stringify(target.items),
        `${correction.correctionId} list target changed`,
      );
    } else if (target.kind === 'listItem') {
      const block = blockById.get(target.blockId);
      invariant(
        block?.type === 'list' &&
          sectionIdByBlockId.get(target.blockId) === target.sectionId &&
          JSON.stringify(block.items[target.itemIndex]) ===
            JSON.stringify(target.children),
        `${correction.correctionId} list-item target changed`,
      );
    } else if (target.kind === 'sectionTitle') {
      invariant(
        sectionById.get(target.sectionId)?.title === target.title,
        `${correction.correctionId} section-title target changed`,
      );
    } else if (target.kind === 'conceptChain') {
      const block = blockById.get(target.blockId);
      invariant(
        block?.type === 'conceptChain' &&
          sectionIdByBlockId.get(target.blockId) === target.sectionId &&
          JSON.stringify(block.steps) === JSON.stringify(target.steps),
        `${correction.correctionId} concept-chain target changed`,
      );
    } else if (target.kind === 'formulaAbsorption') {
      const formula = blockById.get(target.formulaBlockId);
      invariant(
        formula?.type === 'formula' &&
          sectionIdByBlockId.get(target.formulaBlockId) === target.sectionId &&
          formula.latex === target.latex &&
          formula.accessibleText === target.accessibleText &&
          target.absorbedBlockIds.every((blockId) => !blockById.has(blockId)),
        `${correction.correctionId} formula absorption changed`,
      );
    } else if (target.kind === 'formulaReference') {
      for (const blockId of target.blockIds) {
        const formula = formulaByBlockId.get(blockId);
        invariant(
          formula,
          `${correction.correctionId} formula reference is missing`,
        );
        invariant(
          formula.contentCorrectionId ===
            (blockId === 'formula-p032-l0017'
              ? undefined
              : correction.correctionId),
          `${correction.correctionId} formula reference mapping changed`,
        );
      }
    } else if (target.kind === 'excludedNavigation') {
      invariant(
        correction.candidateId &&
          !sectionById.has(correction.candidateId) &&
          !blockById.has(correction.candidateId) &&
          correction.sourceEvidence.every(
            (evidence) =>
              evidence.kind === 'pageLines' && evidence.pdfPage === 6,
          ),
        `${correction.correctionId} navigation exclusion changed`,
      );
    } else {
      const section = sectionById.get(target.sectionId);
      const intro = blockById.get(target.comparisonBlockIds[0]);
      const code = blockById.get(target.comparisonBlockIds[1]);
      invariant(
        section &&
          intro?.type === 'paragraph' &&
          code?.type === 'code' &&
          !section.title.includes('\u2011') &&
          !inlineText(intro.children).includes('\u2011') &&
          !code.code.includes('\u2011'),
        `${correction.correctionId} source-only normalization state changed`,
      );
    }
  }
  const cc23 = COURSE_CONTENT_CORRECTIONS.find(
    (correction) => correction.correctionId === 'CC-23',
  );
  invariant(
    cc23?.target.kind === 'paragraph' &&
      cc23.sourceProjection.kind === 'replace' &&
      JSON.stringify(cc23.sourceProjection.sourceSpanIds) ===
        JSON.stringify([
          'p096-s00045',
          'p154-s00019',
          'p154-s00021',
          'p154-s00022',
          'p154-s00023',
        ]) &&
      JSON.stringify(
        cc23.sourceProjection.targetFragments.map((fragment) =>
          'blockId' in fragment ? fragment.blockId : fragment.sectionId,
        ),
      ) === JSON.stringify(['body-02556', 'body-04366', 'body-04368']) &&
      JSON.stringify(cc23.target.patches.map((patch) => patch.blockId)) ===
        JSON.stringify(['body-02556', 'body-04366', 'body-04368']),
    'CC-23 three-boundary source/target order changed',
  );
  const formulaReferenceIds = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) =>
      independentCorrectionOutcome(correction) === 'assertedFormulaReference',
  ).map((correction) => correction.correctionId);
  invariant(
    JSON.stringify(formulaReferenceIds) ===
      JSON.stringify(['CC-01', 'CC-04', 'CC-08']) &&
      COURSE_CONTENT_CORRECTIONS.filter(
        (correction) => correction.target.kind === 'formulaReference',
      ).flatMap((correction) =>
        correction.target.kind === 'formulaReference'
          ? correction.target.blockIds
          : [],
      ).length === 5,
    'formula-reference correction coverage changed',
  );
  invariant(
    JSON.stringify(categoryCounts) ===
      JSON.stringify({ fidelity: 6, inlineMath: 10, correctness: 25 }) &&
      JSON.stringify(outcomeCounts) ===
        JSON.stringify({
          applied: 34,
          assertedFormulaReference: 3,
          semanticNoop: 1,
          sourceOnlyNoop: 1,
          excludedNavigation: 2,
        }) &&
      pageLines === 46 &&
      selectors === 1,
    'course-correction category, outcome, or evidence counts changed',
  );
  return {
    pageLines,
    selectors,
    applied: outcomeCounts.applied,
    nonMutating:
      outcomeCounts.assertedFormulaReference +
      outcomeCounts.semanticNoop +
      outcomeCounts.sourceOnlyNoop +
      outcomeCounts.excludedNavigation,
  };
}

function scanTrustedStrings(value: unknown, label: string): void {
  if (typeof value === 'string') {
    const hasForbiddenControl = Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0)!;
      return (
        (codePoint >= 0 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        (codePoint >= 127 && codePoint <= 159)
      );
    });
    invariant(
      !hasForbiddenControl &&
        !value.includes('\ufffd') &&
        !value.includes('↵') &&
        !/symbol(?:[0-9a-f]+|<[0-9a-f]+>)/iu.test(value) &&
        !/<symbol(?:[0-9a-f]+|:[^>]+)>/iu.test(value),
      `${label} contains an extraction placeholder or forbidden character`,
    );
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanTrustedStrings(item, `${label}[${index}]`),
    );
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      scanTrustedStrings(item, `${label}.${key}`);
    }
  }
}

type LocatedInlineNode = {
  blockId: string;
  itemIndex?: number;
  node: InlineNode;
};

function collectLocatedInlineNodes(course: Course): LocatedInlineNode[] {
  const result: LocatedInlineNode[] = [];
  const collect = (
    blockId: string,
    nodes: readonly InlineNode[],
    itemIndex?: number,
  ): void => {
    for (const node of nodes) {
      result.push({
        blockId,
        ...(itemIndex === undefined ? {} : { itemIndex }),
        node,
      });
      if ('children' in node) collect(blockId, node.children, itemIndex);
    }
  };
  for (const block of allBlocks(course)) {
    if (block.type === 'paragraph') collect(block.id, block.children);
    if (block.type === 'list') {
      block.items.forEach((item, itemIndex) =>
        collect(block.id, item, itemIndex),
      );
    }
    if (block.type === 'table') {
      block.headers.forEach((cell) => collect(block.id, cell));
      block.rows.flat().forEach((cell) => collect(block.id, cell));
    }
    if (block.type === 'knowledgeCheck') collect(block.id, block.prompt);
  }
  return result;
}

function validateHighRiskRuntime(course: Course): number {
  const { sectionById, blockById } = courseRuntimeIndexes(course);
  const inlineNodes = collectLocatedInlineNodes(course);
  const inlineMathNodes = inlineNodes.filter(
    (
      item,
    ): item is LocatedInlineNode & {
      node: Extract<InlineNode, { type: 'inlineMath' }>;
    } => item.node.type === 'inlineMath',
  );
  const expectedInlineMath = [
    ['body-02792', undefined, 'W_Q', 'W_Q'],
    ['body-02792', undefined, 'W_K', 'W_K'],
    ['body-02792', undefined, 'W_V', 'W_V'],
    ['body-02848', undefined, '\\sqrt{d_k}', 'sqrt(d_k)'],
    ['body-02914', undefined, 'W_Q', 'W_Q'],
    ['body-02914', undefined, 'W_K', 'W_K'],
    ['body-02914', undefined, 'W_V', 'W_V'],
    ['body-03052', undefined, 'F', 'F'],
    ['list-body-04164', 3, '\\log(V)', 'log(V)'],
    ['body-02859', undefined, 'd_v', 'd_v'],
    ['body-02870', undefined, 'd_v', 'd_v'],
    ['body-02872', undefined, 'd_v', 'd_v'],
    ['body-01518', undefined, 'b \\ne 0', 'b ≠ 0'],
    ['list-body-01709', 0, 'z = Wx + b', 'z = Wx + b'],
    ['list-body-01709', 0, 'a = f(z) = f(Wx + b)', 'a = f(z) = f(Wx + b)'],
    [
      'body-04472',
      undefined,
      'W_{\\mathrm{vocab}} \\in \\mathbb{R}^{C \\times V}',
      'W_vocab ∈ R^(C×V)',
    ],
    ['body-04472', undefined, '\\in \\mathbb{R}^{V \\times C}', '∈ R^(V×C)'],
  ] as const;
  const actualInlineMath = inlineMathNodes.map(
    ({ blockId, itemIndex, node }) => [
      blockId,
      itemIndex,
      node.value,
      node.accessibleText,
    ],
  );
  invariant(
    inlineMathNodes.length === 17 &&
      JSON.stringify(
        actualInlineMath.map((item) => JSON.stringify(item)).sort(),
      ) ===
        JSON.stringify(
          expectedInlineMath.map((item) => JSON.stringify(item)).sort(),
        ),
    'inline-math count, location, payload, or accessible text changed',
  );
  for (const { blockId, node } of inlineMathNodes) {
    invariant(
      node.accessibleText.trim().length > 0 &&
        !/[\\$]/u.test(node.accessibleText),
      `${blockId} inline-math accessible text is not plain speech text`,
    );
    renderKatexWithoutDiagnostics(node.value, false, `${blockId} inline math`);
  }
  invariant(
    inlineNodes.every(
      ({ node }) => node.type !== 'text' || node.value.trim().length > 0,
    ),
    'runtime contains a whitespace-only inline text node',
  );

  const p108Children = [
    [
      'body-02859',
      [
        { type: 'text', value: 'V: [B, T, ' },
        { type: 'inlineMath', value: 'd_v', accessibleText: 'd_v' },
        { type: 'text', value: ']' },
      ],
    ],
    [
      'body-02870',
      [
        { type: 'text', value: '[B, T, T] @ [B, T, ' },
        { type: 'inlineMath', value: 'd_v', accessibleText: 'd_v' },
        { type: 'text', value: ']' },
      ],
    ],
    [
      'body-02872',
      [
        { type: 'text', value: '[B, T, ' },
        { type: 'inlineMath', value: 'd_v', accessibleText: 'd_v' },
        { type: 'text', value: ']' },
      ],
    ],
  ] as const;
  for (const [blockId, children] of p108Children) {
    const block = blockById.get(blockId);
    invariant(
      block?.type === 'paragraph' &&
        block.source.pdfPage === 108 &&
        JSON.stringify(block.children) === JSON.stringify(children),
      `${blockId} p.108 d_v structure or boundary whitespace changed`,
    );
  }

  const cc24 = blockById.get('body-04472');
  invariant(
    cc24?.type === 'paragraph' &&
      cc24.children.filter(
        (node) => node.type === 'inlineCode' && node.value === 'lm_head.weight',
      ).length === 1,
    'CC-24 inline-code payload changed',
  );
  const row42 = blockById.get('body-03355');
  invariant(
    row42?.type === 'paragraph' &&
      inlineText(row42.children).match(/row 42/gu)?.length === 2 &&
      !inlineText(row42.children).includes('row42'),
    'p.125 row 42 correction changed',
  );
  const firstNeuron = blockById.get('body-01786');
  const secondNeuron = blockById.get('body-01788');
  invariant(
    firstNeuron?.type === 'paragraph' &&
      inlineText(firstNeuron.children) === 'x1 ──w1──□' &&
      secondNeuron?.type === 'paragraph' &&
      inlineText(secondNeuron.children) === 'x2 ──w2──□',
    'p.71 neuron marker positions changed',
  );
  const courseBoxCount = JSON.stringify(course).split('□').length - 1;
  invariant(
    courseBoxCount === 2,
    'runtime course must contain exactly two □ markers',
  );

  const sqrtSection = sectionById.get('o0266-8-sqrt-d-k');
  const maskSection = sectionById.get('o0272-11-mask-softmax-infty');
  const titleCorrections = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) => correction.target.kind === 'sectionTitle',
  );
  invariant(
    titleCorrections.length === 2 &&
      sqrtSection?.title ===
        (titleCorrections[0].target.kind === 'sectionTitle'
          ? titleCorrections[0].target.title
          : '') &&
      maskSection?.title ===
        (titleCorrections[1].target.kind === 'sectionTitle'
          ? titleCorrections[1].target.title
          : '') &&
      ![...blockById.values()].some(
        (block) =>
          block.type === 'paragraph' &&
          (inlineText(block.children) === sqrtSection.title ||
            inlineText(block.children) === maskSection.title),
      ),
    'corrected section title changed or was duplicated as a paragraph',
  );
  invariant(
    ['body-02792', 'body-02848', 'body-02914', 'body-03052'].every(
      (blockId) => blockById.get(blockId)?.type === 'paragraph',
    ) &&
      (() => {
        const block = blockById.get('list-body-04164');
        return (
          block?.type === 'list' && block.ordered && block.items.length === 7
        );
      })() &&
      (() => {
        const block = blockById.get('chain-body-04382');
        return block?.type === 'conceptChain' && block.steps.length === 5;
      })(),
    'reviewed inline target block types or cardinalities changed',
  );
  return inlineMathNodes.length;
}

function validateAbsorptionAccounting(
  course: Course,
  report: ConversionReport,
): void {
  const blocksById = courseRuntimeIndexes(course).blockById;
  const redirects = [
    ['p023-s00045', 'body-00374', 'formula-math-p023-g001'],
    ['p023-s00046', 'body-00375', 'formula-math-p023-g001'],
    ['p025-s00035', 'body-00417', 'formula-math-p025-g005'],
    ['p025-s00036', 'body-00418', 'formula-math-p025-g005'],
    ['p025-s00052', 'body-00425', 'formula-math-p025-g007'],
    ['p025-s00053', 'body-00426', 'formula-math-p025-g007'],
  ] as const;
  const removedIds = redirects.map(([, blockId]) => blockId);
  invariant(
    removedIds.every(
      (blockId) =>
        !blocksById.has(blockId) &&
        !report.spanAccounting.assigned.some(
          (assignment) => assignment.blockId === blockId,
        ),
    ),
    'absorbed paragraph remains in runtime or span assignments',
  );
  for (const [spanId, , formulaBlockId] of redirects) {
    invariant(
      report.spanAccounting.assigned.filter(
        (assignment) =>
          assignment.spanId === spanId && assignment.blockId === formulaBlockId,
      ).length === 1 &&
        report.spanAccounting.assigned.filter(
          (assignment) => assignment.spanId === spanId,
        ).length === 1,
      `${spanId} absorption assignment redirect changed`,
    );
  }
  const absorptionRecords = COURSE_CONTENT_CORRECTIONS.filter(
    (correction) => correction.target.kind === 'formulaAbsorption',
  );
  const expectedUnions = [
    {
      formulaId: 'formula-math-p023-g001',
      spans: ['p023-s00043', 'p023-s00044', 'p023-s00045', 'p023-s00046'],
    },
    {
      formulaId: 'formula-math-p025-g005',
      spans: Array.from(
        { length: 7 },
        (_, index) => `p025-s${String(index + 35).padStart(5, '0')}`,
      ),
    },
    {
      formulaId: 'formula-math-p025-g007',
      spans: ['p025-s00052', 'p025-s00053', 'p025-s00054'],
    },
  ];
  invariant(
    absorptionRecords.length === 3,
    'formula absorption record count changed',
  );
  for (const [index, correction] of absorptionRecords.entries()) {
    const expected = expectedUnions[index];
    invariant(
      correction.target.kind === 'formulaAbsorption' &&
        correction.sourceProjection.kind === 'replace' &&
        correction.target.formulaBlockId === expected.formulaId &&
        JSON.stringify(correction.sourceProjection.sourceSpanIds) ===
          JSON.stringify(expected.spans),
      `${correction.correctionId} absorption evidence union changed`,
    );
    for (const spanId of expected.spans) {
      invariant(
        report.spanAccounting.assigned.filter(
          (assignment) =>
            assignment.spanId === spanId &&
            assignment.blockId === expected.formulaId,
        ).length === 1 &&
          !report.spanAccounting.excluded.some(
            (exclusion) => exclusion.spanId === spanId,
          ),
        `${spanId} complete absorption evidence is not assigned exactly once`,
      );
    }
  }
}

export function assertValidPythonSyntax(code: string): void {
  const tree = pythonParser.parse(code);
  let errorOffset: number | undefined;
  tree.iterate({
    enter(node) {
      if (node.type.isError && errorOffset === undefined)
        errorOffset = node.from;
    },
  });
  invariant(
    errorOffset === undefined,
    `Appendix A Python syntax is invalid near offset ${errorOffset}`,
  );
}

export function validateGeneratedContent(repositoryRoot = process.cwd()) {
  const sourceAuditBytes = readFileSync(
    path.join(repositoryRoot, 'src/content/source-audit.generated.json.gz'),
  );
  const candidateLedgerBytes = readFileSync(
    path.join(repositoryRoot, 'src/content/candidate-review-ledger.json'),
  );
  const formulaLedgerBytes = readFileSync(
    path.join(repositoryRoot, 'src/content/formula-review-ledger.json'),
  );
  const correctionSourceBytes = readFileSync(
    path.join(repositoryRoot, 'scripts/content-corrections.mts'),
  );
  const trustedInputs: readonly [string, Buffer, string][] = [
    [
      'source audit',
      sourceAuditBytes,
      CONTENT_REVIEW_TRUST_ROOT.sourceAuditSha256,
    ],
    [
      'candidate review ledger',
      candidateLedgerBytes,
      CONTENT_REVIEW_TRUST_ROOT.candidateLedgerSha256,
    ],
    [
      'formula review ledger',
      formulaLedgerBytes,
      CONTENT_REVIEW_TRUST_ROOT.formulaLedgerSha256,
    ],
    [
      'course-content correction source',
      correctionSourceBytes,
      CONTENT_REVIEW_TRUST_ROOT.courseContentCorrectionsSha256,
    ],
  ];
  for (const [label, bytes, expectedDigest] of trustedInputs) {
    invariant(
      sha256(bytes) === expectedDigest,
      `pinned ${label} digest changed`,
    );
  }
  const audit = JSON.parse(
    gunzipSync(sourceAuditBytes).toString('utf8'),
  ) as SourceAudit;
  const formulaReviewLedger = JSON.parse(
    formulaLedgerBytes.toString('utf8'),
  ) as FormulaReviewLedger;
  const { ledger: reviewLedger, index: visualReviewIndex } =
    readTrustedReviewEvidence(repositoryRoot);
  const courseJson = readFileSync(
    path.join(repositoryRoot, 'src/content/course.generated.json'),
    'utf8',
  );
  const manifestJson = readFileSync(
    path.join(repositoryRoot, 'src/content/page-manifest.generated.json'),
    'utf8',
  );
  const reportJson = readFileSync(
    path.join(repositoryRoot, 'src/content/conversion-report.generated.json'),
    'utf8',
  );
  const courseInput = JSON.parse(courseJson) as Course;
  const course = loadCourse(courseInput);
  const manifest = PageManifestSchema.parse(JSON.parse(manifestJson));
  const report = JSON.parse(reportJson) as ConversionReport;
  const publicPdf = readFileSync(
    path.join(repositoryRoot, 'public', course.sourceFilename),
  );

  scanTrustedStrings(courseInput, 'parsed course input');
  scanTrustedStrings(course, 'validated course');
  scanTrustedStrings(formulaReviewLedger, 'formula review ledger');
  scanTrustedStrings(COURSE_CONTENT_CORRECTIONS, 'course corrections');
  scanTrustedStrings(report.correctionAudit, 'generated correction audit');
  invariant(
    !JSON.stringify(formulaReviewLedger).includes('□') &&
      !JSON.stringify(report.correctionAudit).includes('□') &&
      JSON.stringify(courseInput).split('□').length - 1 === 2 &&
      JSON.stringify(COURSE_CONTENT_CORRECTIONS).split('□').length - 1 === 2,
    'a reviewed payload contains an unauthorized □ placeholder',
  );

  invariant(audit.source.sha256 === EXPECTED_SHA256, 'source SHA-256 changed');
  invariant(
    formulaGeometryChecksum(audit) ===
      CONTENT_REVIEW_TRUST_ROOT.formulaRoutingGeometrySha256,
    'pinned formula-routing geometry changed',
  );
  invariant(
    sha256(publicPdf).toUpperCase() === EXPECTED_SHA256,
    'public PDF SHA-256 changed',
  );
  invariant(
    audit.source.pageCount === 170 && audit.pages.length === 170,
    'source must have 170 pages',
  );
  expectedCandidateAudits(audit, reviewLedger);
  validateVisualReviewEvidence(repositoryRoot, reviewLedger, visualReviewIndex);
  invariant(
    audit.outline.length === 461 &&
      new Set(
        audit.outline.map((item) => `${item.titleRaw}\u0000${item.pdfPage}`),
      ).size === 461,
    'source must have 461 unique outline destinations',
  );

  invariant(
    manifest.length === 170 &&
      new Set(manifest.map((entry) => entry.pdfPage)).size === 170 &&
      manifest.every((entry, index) => entry.pdfPage === index + 1),
    'manifest must classify physical pages 1 through 170 exactly once',
  );
  invariant(
    manifest[0].classification === 'frontMatter' &&
      manifest[0].reason === 'Cover represented by course metadata',
    'page 1 front-matter reason changed',
  );
  invariant(
    manifest
      .slice(1, 9)
      .every(
        (entry) =>
          entry.classification === 'navigationReplaced' &&
          entry.reason ===
            'Printed table of contents replaced by accessible recursive web navigation',
      ),
    'printed navigation classification or reason changed',
  );
  invariant(
    manifest.slice(9).every((entry) => entry.classification === 'content'),
    'pages 10-170 must be content',
  );
  for (const page of audit.pages) {
    const entry = manifest[page.pdfPage - 1];
    const expected = page.pdfPage < 10 ? undefined : String(page.pdfPage - 9);
    invariant(
      page.printedPageLabel === (expected ?? null) &&
        entry.printedPageLabel === expected,
      `printed page label mismatch on physical page ${page.pdfPage}`,
    );
  }

  invariant(
    course.overview.source.pdfPage === 10 && course.units.length === 13,
    'course roots must be overview plus 12 weeks and Appendix A',
  );
  invariant(
    course.version === '2026-09-04' &&
      report.generatedAt === '2026-09-04' &&
      report.schemaVersion === 2,
    'generated date, course version, or report schema version changed',
  );
  invariant(
    course.units
      .slice(0, 12)
      .every(
        (unit, index) => unit.kind === 'week' && unit.weekNumber === index + 1,
      ) &&
      course.units[12]?.kind === 'appendix' &&
      course.units[12].source.pdfPage === 161,
    'course unit order or Appendix source changed',
  );

  const roots = [course.overview, ...course.units];
  const sections = roots.flatMap((root) => flattenSections(root));
  const sectionIds = new Set(sections.map((section) => section.id));
  invariant(
    sections.length === 461 && sectionIds.size === 461,
    'outline mappings must resolve one-to-one to 461 unique sections',
  );
  invariant(
    report.outline.total === 461 &&
      report.outline.mapped === 461 &&
      report.outline.rootCount === 14 &&
      report.outline.coveragePercent === 100 &&
      report.outlineMap.length === 461,
    'outline coverage summary changed',
  );
  const anchors = deriveSourceHeadingAnchors(audit);
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const runtimeParentById = new Map<string, string | null>();
  const recordRuntimeParents = (
    section: SectionNode,
    parentId: string | null,
  ): void => {
    runtimeParentById.set(section.id, parentId);
    section.children.forEach((child) =>
      recordRuntimeParents(child, section.id),
    );
  };
  roots.forEach((root) => recordRuntimeParents(root, null));
  const reviewedSectionTitles = new Map(
    COURSE_CONTENT_CORRECTIONS.flatMap((correction) =>
      correction.target.kind === 'sectionTitle'
        ? [[correction.target.sectionId, correction.target.title] as const]
        : [],
    ),
  );
  const mappedSectionIds = new Set<string>();
  for (const [index, source] of audit.outline.entries()) {
    const mapping = report.outlineMap[index];
    const anchor = anchors[index];
    const expectedSectionId = sourceSectionId(source);
    invariant(
      mapping?.outlineIndex === source.outlineIndex &&
        mapping.parentOutlineIndex === source.parentOutlineIndex &&
        mapping.depth === source.depth &&
        mapping.titleRaw === source.titleRaw &&
        mapping.pdfPage === source.pdfPage &&
        mapping.status === 'mapped',
      `outline ${index} source title/page/parent does not match`,
    );
    invariant(
      mapping.sectionId === expectedSectionId,
      `outline ${index} source-derived section id does not match`,
    );
    invariant(
      mapping.headingPdfPage === anchor.pdfPage &&
        JSON.stringify(mapping.headingLineIndexes) ===
          JSON.stringify(anchor.lineIndexes),
      `outline ${index} source-derived heading page/lines do not match`,
    );
    const runtimeSection = sectionById.get(expectedSectionId);
    invariant(
      runtimeSection && !mappedSectionIds.has(expectedSectionId),
      `outline ${index} is not mapped one-to-one`,
    );
    invariant(
      runtimeSection.title ===
        (reviewedSectionTitles.get(expectedSectionId) ??
          sourceHeadingTitle(audit, anchor)),
      `outline ${index} source-derived title does not match runtime`,
    );
    invariant(
      runtimeSection.source.pdfPage === source.pdfPage &&
        runtimeSection.navDepth === source.depth + 1,
      `outline ${index} runtime source/depth does not match`,
    );
    const expectedParentId =
      source.parentOutlineIndex === null
        ? null
        : sourceSectionId(audit.outline[source.parentOutlineIndex]);
    invariant(
      runtimeParentById.get(expectedSectionId) === expectedParentId,
      `outline ${index} source-derived parent does not match runtime`,
    );
    mappedSectionIds.add(expectedSectionId);
  }
  invariant(
    manifest.slice(9).every((entry) => {
      if (entry.pdfPage === 10)
        return entry.sectionId === sourceSectionId(audit.outline[0]);
      const active = anchors
        .filter((anchor) => anchor.pdfPage <= entry.pdfPage)
        .at(-1);
      return (
        active &&
        entry.sectionId === sourceSectionId(audit.outline[active.outlineIndex])
      );
    }),
    'every content page must resolve to its source-derived section id',
  );
  const expectedParagraphs = independentSourceParagraphKeys(audit, anchors);
  const runtimeParagraphs = runtimeParagraphKeys(audit, course);
  const firstParagraphMismatch = expectedParagraphs.findIndex(
    (value, index) => value !== runtimeParagraphs[index],
  );
  const paragraphMismatch =
    firstParagraphMismatch < 0
      ? Math.min(expectedParagraphs.length, runtimeParagraphs.length)
      : firstParagraphMismatch;
  invariant(
    JSON.stringify(runtimeParagraphs) === JSON.stringify(expectedParagraphs),
    `independent semantic paragraph groups/boundaries or excluded prose do not match runtime at ${paragraphMismatch}; source=${JSON.stringify(expectedParagraphs[paragraphMismatch])}; runtime=${JSON.stringify(runtimeParagraphs[paragraphMismatch])}; counts=${expectedParagraphs.length}/${runtimeParagraphs.length}`,
  );

  const blocks = allBlocks(course);
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  invariant(
    blockById.size === blocks.length,
    'runtime block IDs must be unique',
  );
  const correctionCounts = validateCourseCorrectionAudit(
    audit,
    formulaReviewLedger,
    reviewLedger,
    course,
    report,
  );
  const inlineMathCount = validateHighRiskRuntime(course);
  validateAbsorptionAccounting(course, report);
  const rawSpans = audit.pages.flatMap((page) => page.spans);
  const rawSpanById = new Map(rawSpans.map((span) => [span.id, span]));
  const assignments = report.spanAccounting.assigned;
  const exclusions = report.spanAccounting.excluded;
  const accounted = [
    ...assignments.map((item) => item.spanId),
    ...exclusions.map((item) => item.spanId),
  ];
  const accountedSet = new Set(accounted);
  invariant(
    rawSpans.length === 42_408 &&
      rawSpanById.size === rawSpans.length &&
      report.spanAccounting.positionedSpanCount === rawSpans.length &&
      assignments.length === report.spanAccounting.assignedCount &&
      exclusions.length === report.spanAccounting.excludedCount &&
      assignments.length === 10_762 &&
      exclusions.length === 31_646 &&
      accounted.length === rawSpans.length &&
      accountedSet.size === rawSpans.length &&
      accounted.every((spanId) => rawSpanById.has(spanId)) &&
      rawSpans.every((span) => accountedSet.has(span.id)),
    'every positioned span must have exactly one valid disposition',
  );
  invariant(
    assignments.every((item) => blockById.has(item.blockId)),
    'span assignment references an unknown runtime block',
  );
  const assignedBlockBySpan = new Map(
    assignments.map((item) => [item.spanId, item.blockId]),
  );
  const cc23AssignmentIndexes = [
    'p154-s00019',
    'p154-s00020',
    'p154-s00021',
    'p154-s00022',
    'p154-s00023',
  ].map((spanId) => assignments.findIndex((item) => item.spanId === spanId));
  invariant(
    assignedBlockBySpan.get('p096-s00045') === 'body-02556' &&
      assignedBlockBySpan.get('p154-s00019') === 'body-04366' &&
      assignedBlockBySpan.get('p154-s00020') === 'body-04367' &&
      assignedBlockBySpan.get('p154-s00021') === 'body-04368' &&
      assignedBlockBySpan.get('p154-s00022') === 'body-04368' &&
      assignedBlockBySpan.get('p154-s00023') === 'body-04368' &&
      cc23AssignmentIndexes.every((index) => index >= 0) &&
      cc23AssignmentIndexes.every(
        (index, position) =>
          position === 0 || index > cc23AssignmentIndexes[position - 1],
      ),
    'CC-23 separated assignment boundaries or unchanged gap changed',
  );
  const paragraphSourceLines = new Map<string, string[]>();
  for (const page of audit.pages) {
    const pageSpanById = new Map(page.spans.map((span) => [span.id, span]));
    for (const line of page.lines) {
      const paragraphSpansByBlock = new Map<string, RawSpan[]>();
      for (const spanId of line.spanIds) {
        const blockId = assignedBlockBySpan.get(spanId);
        if (!blockId || blockById.get(blockId)?.type !== 'paragraph') continue;
        const span = pageSpanById.get(spanId);
        invariant(
          Boolean(span),
          `audit line references missing span ${spanId}`,
        );
        const grouped = paragraphSpansByBlock.get(blockId) ?? [];
        grouped.push(span!);
        paragraphSpansByBlock.set(blockId, grouped);
      }
      for (const [blockId, sourceSpans] of paragraphSpansByBlock) {
        const sourceLines = paragraphSourceLines.get(blockId) ?? [];
        sourceLines.push(sourceSpans.map((span) => span.textRaw).join(''));
        paragraphSourceLines.set(blockId, sourceLines);
      }
    }
  }
  const reviewedParagraphChildren = new Map<string, readonly InlineNode[]>();
  for (const correction of COURSE_CONTENT_CORRECTIONS) {
    if (correction.target.kind !== 'paragraph') continue;
    for (const patch of correction.target.patches) {
      reviewedParagraphChildren.set(patch.blockId, patch.children);
    }
  }
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;
    const sourceLines = paragraphSourceLines.get(block.id);
    invariant(
      Boolean(sourceLines?.length),
      `${block.id} semantic paragraph has no independently assigned source lines`,
    );
    const reviewedChildren = reviewedParagraphChildren.get(block.id);
    if (reviewedChildren) {
      invariant(
        JSON.stringify(block.children) === JSON.stringify(reviewedChildren),
        `${block.id} reviewed paragraph replacement changed`,
      );
    } else {
      invariant(
        JSON.stringify(tokenSequence(joinAuditWrappedLines(sourceLines!))) ===
          JSON.stringify(tokenSequence(blockText(block))),
        `${block.id} semantic paragraph source lines were split or changed`,
      );
    }
  }
  const allowedReasons = allowedExclusionReasons(audit);
  const headingContentAssignments = assignments.filter((assignment) =>
    assignment.blockId.startsWith('heading-content-'),
  );
  invariant(
    JSON.stringify(headingContentAssignments) ===
      JSON.stringify([
        { spanId: 'p046-s00020', blockId: 'heading-content-o0099' },
        { spanId: 'p052-s00001', blockId: 'heading-content-o0113' },
      ]),
    'source-only leaf heading assignments changed',
  );
  for (const { spanId } of headingContentAssignments) {
    allowedReasons.delete(spanId);
  }
  const exclusionReasonBySpan = new Map(
    exclusions.map((item) => [item.spanId, item.reason]),
  );
  const invalidExclusion = exclusions.find(
    (item) =>
      item.status !== 'reviewed' ||
      item.pdfPage !== Number(item.spanId.slice(1, 4)) ||
      allowedReasons.get(item.spanId) !== item.reason,
  );
  const missingExclusion = [...allowedReasons].find(
    ([spanId, reason]) => exclusionReasonBySpan.get(spanId) !== reason,
  );
  invariant(
    allowedReasons.size === exclusions.length &&
      exclusions.every(
        (item) =>
          item.status === 'reviewed' &&
          item.pdfPage === Number(item.spanId.slice(1, 4)) &&
          allowedReasons.get(item.spanId) === item.reason,
      ) &&
      [...allowedReasons].every(
        ([spanId, reason]) => exclusionReasonBySpan.get(spanId) === reason,
      ),
    `excluded prose or invalid exclusion reason detected: expected=${allowedReasons.size}, actual=${exclusions.length}, invalid=${JSON.stringify(invalidExclusion)}, missing=${JSON.stringify(missingExclusion)}`,
  );

  const sourceRootProjections = correctionAwareSourceRoots(
    audit,
    formulaReviewLedger,
    course,
  );
  invariant(
    JSON.stringify(Object.keys(report.prosePreservation)) ===
      JSON.stringify(ROOT_RANGES.map(([label]) => label)),
    'prose-preservation root keys or order changed',
  );
  for (const [label, startPage, endPage] of ROOT_RANGES) {
    const root =
      roots[ROOT_RANGES.findIndex(([candidate]) => candidate === label)];
    invariant(root, `${label} runtime root is missing`);
    const { tokens: sourceTokens, projectionIds } =
      sourceRootProjections[label];
    const outputTokens = tokenSequence(sectionText(root));
    const match = JSON.stringify(sourceTokens) === JSON.stringify(outputTokens);
    if (!match) {
      const mismatch = sourceTokens.findIndex(
        (token, index) => token !== outputTokens[index],
      );
      invariant(
        false,
        `${label} excluded prose or token mismatch at ${mismatch}: source=${JSON.stringify(sourceTokens.slice(Math.max(0, mismatch - 3), mismatch + 4))}, output=${JSON.stringify(outputTokens.slice(Math.max(0, mismatch - 3), mismatch + 4))}`,
      );
    }
    const evidence = report.prosePreservation[label];
    invariant(
      exactObjectKeys(evidence, [
        'pageRange',
        'sourceTokenCount',
        'outputTokenCount',
        'sourceTokenChecksum',
        'outputTokenChecksum',
        'correctionProjectionIds',
        'matches',
      ]) &&
        evidence.matches === true &&
        JSON.stringify(evidence.pageRange) ===
          JSON.stringify([startPage, endPage]) &&
        evidence.sourceTokenCount === sourceTokens.length &&
        evidence.outputTokenCount === outputTokens.length &&
        evidence.sourceTokenChecksum === sha256(JSON.stringify(sourceTokens)) &&
        evidence.outputTokenChecksum === sha256(JSON.stringify(outputTokens)) &&
        JSON.stringify(evidence.correctionProjectionIds) ===
          JSON.stringify(projectionIds),
      `${label} preservation evidence is stale`,
    );
  }

  const candidateCounts = validateCandidateAudit(
    audit,
    reviewLedger,
    report,
    blockById,
  );
  invariant(
    Array.isArray(report.unresolvedWarnings) &&
      report.unresolvedWarnings.length === 0,
    'unresolved warnings remain',
  );
  for (const candidate of report.specialCandidates) {
    const matchingReviews = reviewLedger.decisions.filter(
      (decision) => decision.targetBlockId === candidate.blockId,
    );
    invariant(
      candidate.status === 'reviewed' &&
        matchingReviews.length > 0 &&
        matchingReviews.every(
          (decision) => decision.reviewer === candidate.reviewer,
        ),
      `${candidate.candidateId} is not reviewed`,
    );
    const sourceSpans = candidate.sourceSpanIds.map((id) =>
      rawSpanById.get(id),
    );
    invariant(
      sourceSpans.length > 0 && sourceSpans.every(Boolean),
      `${candidate.candidateId} references missing source spans`,
    );
    invariant(
      spanChecksum(sourceSpans as RawSpan[]) === candidate.sourceChecksum,
      `${candidate.candidateId} source checksum mismatch`,
    );
    const block = blockById.get(candidate.blockId ?? candidate.candidateId);
    invariant(
      block?.type === candidate.type,
      `${candidate.candidateId} block missing`,
    );
    const validDisposition =
      candidate.disposition ===
        `Converted to a reviewed ${candidate.type} block` ||
      (candidate.type === 'knowledgeCheck' &&
        candidate.disposition ===
          'Prompt promoted while structured source blocks remain in order') ||
      (candidate.type === 'code' &&
        candidate.disposition ===
          'Recovered as one reviewed 472-line Python block');
    invariant(
      validDisposition,
      `${candidate.candidateId} has an invalid disposition`,
    );
  }
  const structuredBlocks = blocks.filter((block) =>
    ['formula', 'table', 'code', 'knowledgeCheck'].includes(block.type),
  );
  invariant(
    structuredBlocks.every((block) =>
      report.specialCandidates.some(
        (candidate) =>
          (candidate.blockId ?? candidate.candidateId) === block.id,
      ),
    ),
    'independent formula candidate or structured block has no reviewed record',
  );

  const formulas = validateFormulaLedger(
    audit,
    reviewLedger,
    formulaReviewLedger,
    report,
    blocks,
  );
  const tables = blocks.filter((block) => block.type === 'table');
  invariant(
    formulas.length === 371 &&
      tables.length === 3 &&
      blocks.filter((block) => block.type === 'code').length === 4 &&
      blocks.filter((block) => block.type === 'knowledgeCheck').length === 4,
    'structured runtime block counts changed',
  );
  for (const table of tables) {
    const candidate = report.specialCandidates.find(
      (item) => (item.blockId ?? item.candidateId) === table.id,
    );
    invariant(candidate, `${table.id} has no candidate record`);
    const candidateSpanIds = new Set(candidate.sourceSpanIds);
    const sourceText = audit.pages
      .flatMap((page) =>
        page.lines
          .filter((line) =>
            line.spanIds.some((spanId) => candidateSpanIds.has(spanId)),
          )
          .map((line) => line.lineRaw),
      )
      .join('\n');
    invariant(
      JSON.stringify(tokenSequence(blockText(table))) ===
        JSON.stringify(tokenSequence(sourceText)),
      `${table.id} table cell order differs from source`,
    );
  }

  const appendix = allBlocks(courseInput).find(
    (block): block is Extract<ContentBlock, { type: 'code' }> =>
      block.type === 'code' && block.id === 'code-appendix-a-mini-gpt',
  );
  invariant(appendix, 'Appendix A code block is missing');
  invariant(
    appendix.code.split('\n').length - 1 === 472 &&
      appendix.code.length === 18_411 &&
      sha256(appendix.code) === EXPECTED_APPENDIX_SHA256 &&
      appendix.language === 'python' &&
      appendix.filename === 'mini_gpt.py' &&
      !appendix.code.includes('\u2011'),
    'Appendix A line count, length, or checksum changed',
  );
  assertValidPythonSyntax(appendix.code);
  invariant(
    report.appendix.lineCount === 472 &&
      report.appendix.characterCount === 18_411 &&
      report.appendix.codeSha256 === EXPECTED_APPENDIX_SHA256 &&
      report.appendix.sourceChecksum === APPENDIX_CORRECTION.sourceChecksum &&
      report.appendix.astValidatedBy.includes('@lezer/python'),
    'Appendix report evidence is stale',
  );

  invariant(
    !courseJson.includes('\ufffd'),
    'runtime course contains a replacement glyph',
  );
  for (let index = 0; index < courseJson.length; index += 1) {
    const codeUnit = courseJson.charCodeAt(index);
    invariant(
      codeUnit === 9 || codeUnit === 10 || codeUnit === 13 || codeUnit >= 32,
      'runtime course contains a forbidden control character',
    );
  }

  return {
    pages: manifest.length,
    outline: report.outline.mapped,
    sections: sectionIds.size,
    blocks: blocks.length,
    structuredFormulas: formulas.length,
    structuredTables: tables.length,
    structuredCodeBlocks: blocks.filter((block) => block.type === 'code')
      .length,
    structuredKnowledgeChecks: blocks.filter(
      (block) => block.type === 'knowledgeCheck',
    ).length,
    detectedFormulaCandidates: candidateCounts.formulas,
    inlineMathNodes: inlineMathCount,
    bodyInlineCorrections: COURSE_CONTENT_CORRECTIONS.filter(
      (correction) => correction.category !== 'correctness',
    ).length,
    correctnessCorrections: COURSE_CONTENT_CORRECTIONS.filter(
      (correction) => correction.category === 'correctness',
    ).length,
    correctionAuditEntries: report.correctionAudit.length,
    pageLinesEvidenceObjects: correctionCounts.pageLines,
    crossPageSelectorEvidenceObjects: correctionCounts.selectors,
    appliedCorrections: correctionCounts.applied,
    nonMutatingCorrections: correctionCounts.nonMutating,
    sourceProjectionParityRoots: ROOT_RANGES.length,
    discoveredCandidates: candidateCounts,
    assignedSpans: assignments.length,
    excludedSpans: exclusions.length,
    appendixLines: 472,
    unresolvedWarnings: 0,
    generatedAt: report.generatedAt,
  };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (import.meta.url === invokedPath) {
  const result = validateGeneratedContent(
    path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  );
  console.log(`Content validation passed: ${JSON.stringify(result)}`);
}
