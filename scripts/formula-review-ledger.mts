import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { CandidateReviewDecision } from './candidate-review-ledger.mts';
import {
  spansForLines,
  type FormulaCandidate,
  type RawSpan,
  type SourceAudit,
} from './source-audit.mts';

const EXPECTED_SOURCE_SHA256 =
  '3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52';
const EXPECTED_FORMULA_COUNT = 371;

const EXPECTED_CONTENT_CORRECTIONS = new Map<string, string>([
  ['formula-math-p018-g003', 'CC-01'],
  ['formula-p032-l0019-21', 'CC-04'],
  ['formula-p032-l0023-25', 'CC-04'],
  ['formula-math-p072-g000', 'CC-08'],
]);

export type ReviewedFormula = {
  candidateId: string;
  blockId: string;
  pdfPage: number;
  lineIndexes: number[];
  sourceSpanIds: string[];
  sourceChecksum: string;
  sourceGeometryChecksum: string;
  latex: string;
  accessibleText: string;
  contentCorrectionId?: string;
  reviewer: string;
  status: 'reviewed';
};

export type FormulaReviewLedger = {
  version: 1;
  sourceSha256: string;
  formulaCount: 371;
  formulas: ReviewedFormula[];
};

function fail(message: string): never {
  throw new Error(message);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sameArray<T>(left: readonly T[], right: readonly T[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function hasExtractionPlaceholder(value: string): boolean {
  return (
    value.includes('\u0000') ||
    value.includes('\uFFFD') ||
    value.includes('↵') ||
    /\bsymbol(?:[0-9a-f]+|<[0-9a-f]+>)/iu.test(value) ||
    /<symbol(?:[0-9a-f]+|:[^>]+)>/iu.test(value)
  );
}

export function formulaSourceGeometryChecksum(
  spans: readonly RawSpan[],
): string {
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

export function readFormulaReviewLedger(filename: string): FormulaReviewLedger {
  return JSON.parse(readFileSync(filename, 'utf8')) as FormulaReviewLedger;
}

export function formulaReviewMaps(ledger: FormulaReviewLedger): {
  byCandidateId: Map<string, ReviewedFormula>;
  byBlockId: Map<string, ReviewedFormula>;
} {
  return {
    byCandidateId: new Map(
      ledger.formulas.map((formula) => [formula.candidateId, formula]),
    ),
    byBlockId: new Map(
      ledger.formulas.map((formula) => [formula.blockId, formula]),
    ),
  };
}

export function assertFormulaReviewLedger(
  ledger: FormulaReviewLedger,
  audit: SourceAudit,
  formulaCandidates: readonly FormulaCandidate[],
  decisions: readonly CandidateReviewDecision[],
): void {
  if (
    ledger.version !== 1 ||
    ledger.sourceSha256 !== EXPECTED_SOURCE_SHA256 ||
    ledger.formulaCount !== EXPECTED_FORMULA_COUNT ||
    ledger.formulas.length !== EXPECTED_FORMULA_COUNT
  ) {
    fail('Formula review ledger metadata does not match the pinned source');
  }
  if (audit.source.sha256 !== EXPECTED_SOURCE_SHA256) {
    fail('Formula review ledger was checked against an unexpected source');
  }

  const structuredDecisions = decisions.filter(
    (decision) =>
      decision.category === 'formula' &&
      decision.disposition === 'structuredFormula',
  );
  const inlineCandidateIds = new Set(
    decisions
      .filter(
        (decision) =>
          decision.category === 'formula' &&
          decision.disposition === 'inlineMath',
      )
      .map((decision) => decision.candidateId),
  );
  if (structuredDecisions.length !== EXPECTED_FORMULA_COUNT) {
    fail(
      `Expected ${EXPECTED_FORMULA_COUNT} structured formula decisions, got ${structuredDecisions.length}`,
    );
  }

  const { byCandidateId, byBlockId } = formulaReviewMaps(ledger);
  if (
    byCandidateId.size !== EXPECTED_FORMULA_COUNT ||
    byBlockId.size !== EXPECTED_FORMULA_COUNT
  ) {
    fail('Formula review ledger contains duplicate candidate or block IDs');
  }
  if (
    ledger.formulas.some((formula) =>
      inlineCandidateIds.has(formula.candidateId),
    )
  ) {
    fail('Formula review ledger contains an inline-math candidate');
  }

  const candidatesById = new Map(
    formulaCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (candidatesById.size !== formulaCandidates.length) {
    fail('Formula detection produced duplicate candidate IDs');
  }
  const pagesByNumber = new Map(
    audit.pages.map((page) => [page.pdfPage, page]),
  );

  for (const [index, decision] of structuredDecisions.entries()) {
    const entry = ledger.formulas[index];
    if (
      !entry ||
      typeof entry.candidateId !== 'string' ||
      typeof entry.blockId !== 'string' ||
      typeof entry.pdfPage !== 'number' ||
      !Array.isArray(entry.lineIndexes) ||
      !Array.isArray(entry.sourceSpanIds) ||
      typeof entry.sourceChecksum !== 'string' ||
      typeof entry.sourceGeometryChecksum !== 'string'
    ) {
      fail(`Formula review ledger entry ${index} is malformed`);
    }
    if (
      entry.candidateId !== decision.candidateId ||
      entry.blockId !== decision.targetBlockId
    ) {
      fail(
        `Formula review ledger order/target mismatch at structured formula ${decision.candidateId}`,
      );
    }
    const candidate =
      candidatesById.get(entry.candidateId) ??
      fail(`Formula review ledger references unknown ${entry.candidateId}`);
    const page =
      pagesByNumber.get(candidate.pdfPage) ??
      fail(
        `Formula review ledger references missing page ${candidate.pdfPage}`,
      );
    const spans = spansForLines(page, candidate.lineIndexes);
    const expectedCorrection = EXPECTED_CONTENT_CORRECTIONS.get(entry.blockId);

    if (
      entry.pdfPage !== candidate.pdfPage ||
      !sameArray(entry.lineIndexes, candidate.lineIndexes) ||
      !sameArray(entry.sourceSpanIds, candidate.sourceSpanIds) ||
      entry.sourceChecksum !== candidate.sourceChecksum ||
      entry.sourceGeometryChecksum !== formulaSourceGeometryChecksum(spans) ||
      entry.contentCorrectionId !== expectedCorrection
    ) {
      fail(`Formula review source evidence mismatch for ${entry.candidateId}`);
    }
    if (
      entry.status !== 'reviewed' ||
      typeof entry.reviewer !== 'string' ||
      !entry.reviewer.trim()
    ) {
      fail(`Formula review metadata is invalid for ${entry.candidateId}`);
    }
    if (
      typeof entry.latex !== 'string' ||
      typeof entry.accessibleText !== 'string' ||
      !entry.latex.trim() ||
      !entry.accessibleText.trim() ||
      hasExtractionPlaceholder(entry.latex) ||
      hasExtractionPlaceholder(entry.accessibleText)
    ) {
      fail(`Formula review payload is invalid for ${entry.candidateId}`);
    }
  }
}
