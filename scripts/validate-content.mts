import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
import {
  APPENDIX_CORRECTION,
  CODE_CORRECTIONS,
  FORMULA_CORRECTIONS,
  HEADING_LINE_CORRECTIONS,
  KNOWLEDGE_CHECK_OUTLINE_INDEXES,
  TABLE_CORRECTIONS,
  type LineRangeCorrection,
} from './content-corrections.mts';
import {
  candidateFingerprint,
  correctionFingerprint,
  decisionMap,
  readCandidateReviewLedger,
  type CandidateCategory,
  type CandidateDisposition,
  type CandidateReviewLedger,
} from './candidate-review-ledger.mts';
import {
  detectCodeCandidates,
  detectFormulaCandidates,
  detectKnowledgeCandidates,
  detectTableCandidates,
  readSourceAudit,
  spanChecksum,
  type DetectedCandidate,
  type RawSpan,
  type SourceAudit,
} from './source-audit.mts';

const EXPECTED_SHA256 =
  '3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52';
const EXPECTED_APPENDIX_SHA256 =
  '0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd';

type CandidateAudit = DetectedCandidate & {
  category: CandidateCategory;
  reviewer: string;
  status: string;
  disposition: CandidateDisposition;
  rationale: string;
  blockId?: string;
};

type ConversionReport = {
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
  prosePreservation: Record<
    'week2' | 'week3',
    {
      matches: boolean;
      sourceTokenChecksum: string;
      normalizedTokenChecksum: string;
    }
  >;
  specialCandidates: {
    candidateId: string;
    blockId?: string;
    type: CandidateCategory;
    status: string;
    reviewer: string;
    disposition: string;
    sourceSpanIds: string[];
    sourceChecksum: string;
  }[];
  candidateAudit: CandidateAudit[];
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
    normalizeHyphens(value.replace(/[‐‑–−]\r?\n(?=\p{L})/gu, ''))
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
    .map((node) =>
      'children' in node ? inlineText(node.children) : node.value,
    )
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

function sourceBodyText(
  audit: SourceAudit,
  start: number,
  end: number,
): string {
  return audit.pages
    .filter((page) => page.pdfPage >= start && page.pdfPage <= end)
    .flatMap((page) =>
      page.lines.filter((line) => line.bbox[1] >= 50 && line.bbox[1] <= 790),
    )
    .map((line) => line.lineRaw)
    .join('\n');
}

function headingProjection(value: string): string {
  return normalizeHyphens(value)
    .normalize('NFKC')
    .replace(/[“”]/gu, '"')
    .replace(/\s+/gu, '')
    .toLocaleLowerCase('en');
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
  anchor: ReturnType<typeof deriveHeadingAnchors>[number],
): string {
  const page = audit.pages[anchor.pdfPage - 1];
  return anchor.lineIndexes
    .map((lineIndex) => sourceRuntimeText(page.lines[lineIndex].lineRaw))
    .join('');
}

function deriveHeadingAnchors(audit: SourceAudit) {
  return audit.outline.map((outline) => {
    const correction = HEADING_LINE_CORRECTIONS[outline.outlineIndex];
    if (correction)
      return {
        outlineIndex: outline.outlineIndex,
        pdfPage: correction.pdfPage,
        lineIndexes: [correction.lineIndex],
      };
    const page = audit.pages[outline.pdfPage - 1];
    const target = headingProjection(outline.titleRaw);
    const matches: number[][] = [];
    for (let start = 0; start < page.lines.length; start += 1) {
      let projection = '';
      for (let length = 1; length <= 4; length += 1) {
        const line = page.lines[start + length - 1];
        if (!line) break;
        projection += headingProjection(line.lineRaw);
        if (projection === target) {
          matches.push(Array.from({ length }, (_, offset) => start + offset));
          break;
        }
        if (projection.length > target.length) break;
      }
    }
    invariant(
      matches.length === 1,
      `outline source heading ${outline.outlineIndex} is ambiguous`,
    );
    return {
      outlineIndex: outline.outlineIndex,
      pdfPage: outline.pdfPage,
      lineIndexes: matches[0],
    };
  });
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
      invariant(
        review.correctionFingerprint
          ? Boolean(correction) &&
              review.correctionFingerprint ===
                correctionFingerprint(category, correction!)
          : !correction,
        `candidate review ledger correction mismatch for ${signal.candidateId}`,
      );
    }

    let expectedDisposition: CandidateDisposition;
    let expectedTarget: string | undefined;
    if (category === 'formula') {
      expectedDisposition =
        'display' in signal && signal.display
          ? 'structuredFormula'
          : 'inlineMath';
      expectedTarget =
        expectedDisposition === 'structuredFormula'
          ? (correction?.candidateId ?? `formula-${signal.candidateId}`)
          : undefined;
    } else if (category === 'table') {
      expectedDisposition = correction ? 'table' : 'notTable';
      expectedTarget = correction?.candidateId;
    } else if (category === 'code') {
      expectedTarget =
        signal.candidateId === 'code-signal-appendix-a'
          ? APPENDIX_CORRECTION.candidateId
          : correction?.candidateId;
      expectedDisposition = expectedTarget ? 'code' : 'notCode';
    } else {
      const outlineIndex = Number(signal.candidateId.slice(-4));
      const selected = KNOWLEDGE_CHECK_OUTLINE_INDEXES.some(
        (index) => index === outlineIndex,
      );
      expectedDisposition = selected ? 'knowledgeCheck' : 'notKnowledgeCheck';
      expectedTarget = selected
        ? `knowledge-check-o${String(outlineIndex).padStart(4, '0')}`
        : undefined;
      invariant(
        !review.correctionFingerprint,
        `knowledge review ledger decision has a correction fingerprint`,
      );
    }
    invariant(
      review.disposition === expectedDisposition &&
        review.targetBlockId === expectedTarget,
      `candidate review ledger disposition mismatch for ${signal.candidateId}`,
    );
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

function allowedExclusionReasons(audit: SourceAudit): Map<string, string> {
  const reasons = new Map<string, string>();
  const anchors = deriveHeadingAnchors(audit);
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
  anchors: ReturnType<typeof deriveHeadingAnchors>,
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
        barrierBefore: barrierByOutline.delete(activeOutline),
        lines: [{ pdfPage: page.pdfPage, lineIndex, line }],
        text,
      });
      atomicByOutline.set(activeOutline, groups);
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
      paragraphKeys.push(
        sourceSectionId(audit.outline[outlineIndex]) +
          '\u0000' +
          JSON.stringify(tokenSequence(group.text)),
      );
    }
  }
  return paragraphKeys.sort();
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
        sectionId + '\u0000' + JSON.stringify(tokenSequence(blockText(block))),
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
  return keys.sort();
}

function validateVisualReviewEvidence(
  repositoryRoot: string,
  ledger: CandidateReviewLedger,
): void {
  const evidenceRoot = path.join(
    repositoryRoot,
    'reports/content-review-evidence',
  );
  const index = JSON.parse(
    readFileSync(path.join(evidenceRoot, 'index.json'), 'utf8'),
  ) as {
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
  invariant(
    index.version === 1 &&
      index.sourceSha256 === EXPECTED_SHA256 &&
      index.candidateLedgerSha256 === sha256(JSON.stringify(ledger)) &&
      index.reviewer.trim().length > 0 &&
      index.reviewedPageCount === 148 &&
      index.sheetColumns === 4 &&
      index.sheetRows === 3 &&
      index.sheets.length === 13,
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
      sha256(bytes) === sheet.sha256,
      `visual review evidence sheet checksum changed: ${sheet.file}`,
    );
    invariant(
      sheet.cells.length > 0 && sheet.cells.length <= 12,
      `visual review evidence sheet cell count is invalid: ${sheet.file}`,
    );
    return sheet.cells;
  });
  invariant(
    cells.length === 148 &&
      new Set(cells.map((cell) => cell.pdfPage)).size === 148 &&
      cells.every((cell) => {
        const decisions = [...(decisionsByPage.get(cell.pdfPage) ?? [])].sort(
          (left, right) => left.candidateId.localeCompare(right.candidateId),
        );
        return (
          cell.row >= 0 &&
          cell.row < 3 &&
          cell.column >= 0 &&
          cell.column < 4 &&
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
  const audit = readSourceAudit(
    path.join(repositoryRoot, 'src/content/source-audit.generated.json.gz'),
  );
  const ledgerPath = path.join(
    repositoryRoot,
    'src/content/candidate-review-ledger.json',
  );
  const reviewLedger = readCandidateReviewLedger(ledgerPath);
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

  invariant(audit.source.sha256 === EXPECTED_SHA256, 'source SHA-256 changed');
  invariant(
    sha256(publicPdf).toUpperCase() === EXPECTED_SHA256,
    'public PDF SHA-256 changed',
  );
  invariant(
    audit.source.pageCount === 170 && audit.pages.length === 170,
    'source must have 170 pages',
  );
  expectedCandidateAudits(audit, reviewLedger);
  validateVisualReviewEvidence(repositoryRoot, reviewLedger);
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
  const anchors = deriveHeadingAnchors(audit);
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
      runtimeSection.title === sourceHeadingTitle(audit, anchor),
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
  const rawSpans = audit.pages.flatMap((page) => page.spans);
  const rawSpanById = new Map(rawSpans.map((span) => [span.id, span]));
  const assignments = report.spanAccounting.assigned;
  const exclusions = report.spanAccounting.excluded;
  const accounted = [
    ...assignments.map((item) => item.spanId),
    ...exclusions.map((item) => item.spanId),
  ];
  invariant(
    report.spanAccounting.positionedSpanCount === rawSpans.length &&
      assignments.length === report.spanAccounting.assignedCount &&
      exclusions.length === report.spanAccounting.excludedCount &&
      accounted.length === rawSpans.length &&
      new Set(accounted).size === rawSpans.length &&
      accounted.every((spanId) => rawSpanById.has(spanId)),
    'every positioned span must have exactly one valid disposition',
  );
  invariant(
    assignments.every((item) => blockById.has(item.blockId)),
    'span assignment references an unknown runtime block',
  );
  const assignedBlockBySpan = new Map(
    assignments.map((item) => [item.spanId, item.blockId]),
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
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;
    const sourceLines = paragraphSourceLines.get(block.id);
    invariant(
      Boolean(sourceLines?.length),
      `${block.id} semantic paragraph has no independently assigned source lines`,
    );
    invariant(
      JSON.stringify(tokenSequence(joinAuditWrappedLines(sourceLines!))) ===
        JSON.stringify(tokenSequence(blockText(block))),
      `${block.id} semantic paragraph source lines were split or changed`,
    );
  }
  const allowedReasons = allowedExclusionReasons(audit);
  invariant(
    exclusions.every(
      (item) =>
        item.status === 'reviewed' &&
        item.pdfPage === Number(item.spanId.slice(1, 4)) &&
        allowedReasons.get(item.spanId) === item.reason,
    ),
    'excluded prose or invalid exclusion reason detected',
  );

  for (const [label, unitIndex, startPage, endPage] of [
    ['week2', 1, 21, 35],
    ['week3', 2, 36, 73],
  ] as const) {
    const unit = course.units[unitIndex];
    invariant(unit?.kind === 'week', `${label} runtime unit is missing`);
    const sourceTokens = tokenSequence(
      sourceBodyText(audit, startPage, endPage),
    );
    const outputTokens = tokenSequence(sectionText(unit));
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
      evidence.matches === true &&
        evidence.sourceTokenChecksum === sha256(JSON.stringify(sourceTokens)) &&
        evidence.normalizedTokenChecksum ===
          sha256(JSON.stringify(outputTokens)),
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

  const formulas = blocks.filter((block) => block.type === 'formula');
  for (const formula of formulas) {
    invariant(
      formula.latex.trim().length > 0 &&
        formula.accessibleText.trim().length > 0,
      `${formula.id} formula content is empty`,
    );
    katex.renderToString(formula.latex, {
      throwOnError: true,
      strict: 'error',
    });
  }
  const vectorSignal = detectFormulaCandidates(audit).find(
    (signal) =>
      signal.pdfPage === 12 &&
      JSON.stringify(signal.lineIndexes) ===
        JSON.stringify([21, 22, 23, 24, 25]),
  );
  invariant(
    vectorSignal,
    'physical-page-12 multi-row formula was not detected',
  );
  const vectorDecision = reviewLedger.decisions.find(
    (decision) => decision.candidateId === vectorSignal.candidateId,
  );
  const vectorCorrection = FORMULA_CORRECTIONS.find(
    (correction) => correction.candidateId === vectorDecision?.targetBlockId,
  );
  const vectorPage = audit.pages[11];
  const vectorLines = vectorSignal.lineIndexes.map(
    (lineIndex) => vectorPage.lines[lineIndex],
  );
  const vectorRows = vectorLines.filter((line) =>
    /^(?:100|3|8)$/u.test(sourceRuntimeText(line.lineRaw)),
  );
  const vectorFormula = formulas.find(
    (formula) => formula.id === vectorDecision?.targetBlockId,
  );
  invariant(
    vectorRows.length === 3 &&
      new Set(vectorRows.map((line) => line.bbox[1])).size === 3 &&
      vectorDecision?.disposition === 'structuredFormula' &&
      vectorCorrection &&
      vectorDecision.correctionFingerprint ===
        correctionFingerprint('formula', vectorCorrection) &&
      vectorFormula?.accessibleText ===
        vectorLines.map((line) => sourceRuntimeText(line.lineRaw)).join('\n') &&
      vectorFormula.latex.includes('\\begin{bmatrix}') &&
      vectorFormula.latex.includes('100 \\\\ 3 \\\\ 8') &&
      vectorFormula.latex.includes('\\end{bmatrix}'),
    'multi-row formula source geometry is not represented as a matrix/vector',
  );
  const tables = blocks.filter((block) => block.type === 'table');
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
      sha256(appendix.code) === EXPECTED_APPENDIX_SHA256,
    'Appendix A line count, length, or checksum changed',
  );
  assertValidPythonSyntax(appendix.code);
  invariant(
    report.appendix.lineCount === 472 &&
      report.appendix.characterCount === 18_411 &&
      report.appendix.codeSha256 === EXPECTED_APPENDIX_SHA256 &&
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
    discoveredCandidates: candidateCounts,
    assignedSpans: assignments.length,
    excludedSpans: exclusions.length,
    appendixLines: 472,
    unresolvedWarnings: 0,
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
