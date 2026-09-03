import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { LineRangeCorrection } from './content-corrections.mts';
import type { DetectedCandidate } from './source-audit.mts';

export type CandidateCategory = 'formula' | 'table' | 'code' | 'knowledgeCheck';

export type CandidateDisposition =
  | 'structuredFormula'
  | 'inlineMath'
  | 'table'
  | 'notTable'
  | 'code'
  | 'notCode'
  | 'knowledgeCheck'
  | 'notKnowledgeCheck';

export type CandidateReviewDecision = {
  candidateId: string;
  candidateFingerprint: string;
  category: CandidateCategory;
  pdfPage: number;
  disposition: CandidateDisposition;
  rationale: string;
  reviewer: string;
  targetBlockId?: string;
  correctionFingerprint?: string;
};

export type CandidateReviewLedger = {
  version: 1;
  sourceSha256: string;
  candidateCount: number;
  reviewScope: string;
  decisions: CandidateReviewDecision[];
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function candidateFingerprint(
  category: CandidateCategory,
  candidate: DetectedCandidate,
): string {
  return sha256(
    JSON.stringify({
      category,
      candidateId: candidate.candidateId,
      pdfPage: candidate.pdfPage,
      lineIndexes: candidate.lineIndexes,
      sourceSpanIds: candidate.sourceSpanIds,
      sourceChecksum: candidate.sourceChecksum,
      detector: candidate.detector,
    }),
  );
}

export function correctionFingerprint(
  category: Exclude<CandidateCategory, 'knowledgeCheck'>,
  correction: LineRangeCorrection,
): string {
  const value = correction as LineRangeCorrection &
    Partial<{
      latex: string;
      language: string;
      filename: string;
      caption: string;
      headers: string[];
      rows: string[][];
    }>;
  return sha256(
    JSON.stringify({
      category,
      candidateId: value.candidateId,
      pdfPage: value.pdfPage,
      lineIndexes: value.lineIndexes,
      sourceChecksum: value.sourceChecksum,
      ...(value.latex ? { latex: value.latex } : {}),
      ...(value.language ? { language: value.language } : {}),
      ...(value.filename ? { filename: value.filename } : {}),
      ...(value.caption ? { caption: value.caption } : {}),
      ...(value.headers ? { headers: value.headers } : {}),
      ...(value.rows ? { rows: value.rows } : {}),
    }),
  );
}

export function assertCorrectionBackedDecision(
  category: Exclude<CandidateCategory, 'knowledgeCheck'>,
  decision: CandidateReviewDecision,
  correction: LineRangeCorrection | undefined,
): void {
  if (decision.correctionFingerprint) {
    if (!correction) {
      throw new Error(
        `Reviewed structured ${category} correction is missing for ${decision.candidateId}`,
      );
    }
    if (
      decision.targetBlockId !== correction.candidateId ||
      decision.correctionFingerprint !==
        correctionFingerprint(category, correction)
    ) {
      throw new Error(
        `Reviewed structured ${category} correction mismatch for ${decision.candidateId}`,
      );
    }
  } else if (correction) {
    throw new Error(
      `Unexpected unreviewed ${category} correction for ${decision.candidateId}`,
    );
  }
}

export function readCandidateReviewLedger(
  filename: string,
): CandidateReviewLedger {
  return JSON.parse(readFileSync(filename, 'utf8')) as CandidateReviewLedger;
}

export function decisionMap(
  ledger: CandidateReviewLedger,
): Map<string, CandidateReviewDecision> {
  return new Map(
    ledger.decisions.map((decision) => [decision.candidateId, decision]),
  );
}
