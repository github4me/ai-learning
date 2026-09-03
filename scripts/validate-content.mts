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

type CandidateCategory = 'formula' | 'table' | 'code' | 'knowledgeCheck';
type CandidateDisposition =
  | 'structuredFormula'
  | 'inlineMath'
  | 'table'
  | 'notTable'
  | 'code'
  | 'notCode'
  | 'knowledgeCheck'
  | 'notKnowledgeCheck';

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

function sourceBodyText(audit: SourceAudit, start: number, end: number): string {
  return audit.pages
    .filter((page) => page.pdfPage >= start && page.pdfPage <= end)
    .flatMap((page) =>
      page.lines.filter(
        (line) => line.bbox[1] >= 50 && line.bbox[1] <= 790,
      ),
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

function expectedCandidateAudits(audit: SourceAudit): CandidateAudit[] {
  const reviewer = 'independently recomputed';
  const formulas: CandidateAudit[] = detectFormulaCandidates(audit).map(
    (signal) => {
      const correction = overlappingCorrection(signal, FORMULA_CORRECTIONS);
      const blockId = correction?.candidateId ?? `formula-${signal.candidateId}`;
      return {
        ...signal,
        category: 'formula',
        reviewer,
        status: 'reviewed',
        disposition: signal.display ? 'structuredFormula' : 'inlineMath',
        rationale: signal.rationale,
        ...(signal.display ? { blockId } : {}),
      };
    },
  );
  const tables: CandidateAudit[] = detectTableCandidates(audit).map(
    (signal) => {
      const correction = overlappingCorrection(signal, TABLE_CORRECTIONS);
      return {
        ...signal,
        category: 'table',
        reviewer,
        status: 'reviewed',
        disposition: correction ? 'table' : 'notTable',
        rationale: correction ? 'table' : 'not table',
        ...(correction ? { blockId: correction.candidateId } : {}),
      };
    },
  );
  const codes: CandidateAudit[] = detectCodeCandidates(audit).map((signal) => {
    const correction = overlappingCorrection(signal, CODE_CORRECTIONS);
    const blockId =
      signal.candidateId === 'code-signal-appendix-a'
        ? APPENDIX_CORRECTION.candidateId
        : correction?.candidateId;
    return {
      ...signal,
      category: 'code',
      reviewer,
      status: 'reviewed',
      disposition: blockId ? 'code' : 'notCode',
      rationale: blockId ? 'code' : 'not code',
      ...(blockId ? { blockId } : {}),
    };
  });
  const knowledge: CandidateAudit[] = detectKnowledgeCandidates(audit).map(
    (signal) => {
      const outlineIndex = Number(signal.candidateId.slice(-4));
      const selected = KNOWLEDGE_CHECK_OUTLINE_INDEXES.some(
        (index) => index === outlineIndex,
      );
      const blockId = selected
        ? `knowledge-check-o${String(outlineIndex).padStart(4, '0')}`
        : undefined;
      return {
        ...signal,
        category: 'knowledgeCheck',
        reviewer,
        status: 'reviewed',
        disposition: selected ? 'knowledgeCheck' : 'notKnowledgeCheck',
        rationale: selected ? 'knowledge check' : 'question heading',
        ...(blockId ? { blockId } : {}),
      };
    },
  );
  return [...formulas, ...tables, ...codes, ...knowledge];
}

function validateCandidateAudit(
  audit: SourceAudit,
  report: ConversionReport,
  blockById: Map<string, ContentBlock>,
): Record<'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks', number> {
  const expected = expectedCandidateAudits(audit);
  const actualById = new Map(
    report.candidateAudit.map((candidate) => [candidate.candidateId, candidate]),
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
      actual.status === 'reviewed' && actual.reviewer.trim().length > 0,
      `${actual.candidateId} is not reviewed`,
    );
    invariant(
      actual.disposition === expectedCandidate.disposition &&
        actual.blockId === expectedCandidate.blockId &&
        actual.rationale.trim().length > 0,
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

function allowedExclusionReasons(
  audit: SourceAudit,
  report: ConversionReport,
): Map<string, string> {
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
          reason = `Represented by outline section ${report.outlineMap[outlineIndex].sectionId}`;
        else if (!line.lineRaw.replaceAll('\u0000', '').trim())
          reason = 'Empty visual artifact';
      }
      if (reason) for (const spanId of line.spanIds) reasons.set(spanId, reason);
    }
  }
  return reasons;
}

export function assertValidPythonSyntax(code: string): void {
  const tree = pythonParser.parse(code);
  let errorOffset: number | undefined;
  tree.iterate({
    enter(node) {
      if (node.type.isError && errorOffset === undefined) errorOffset = node.from;
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
    manifest.slice(1, 9).every(
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
  const mappedSectionIds = new Set<string>();
  for (const [index, source] of audit.outline.entries()) {
    const mapping = report.outlineMap[index];
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
      sectionIds.has(mapping.sectionId) && !mappedSectionIds.has(mapping.sectionId),
      `outline ${index} is not mapped one-to-one`,
    );
    mappedSectionIds.add(mapping.sectionId);
  }
  invariant(
    manifest
      .slice(9)
      .every((entry) => entry.sectionId && sectionIds.has(entry.sectionId)),
    'every content page must resolve to a runtime section',
  );

  const blocks = allBlocks(course);
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  invariant(blockById.size === blocks.length, 'runtime block IDs must be unique');
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
        invariant(Boolean(span), `audit line references missing span ${spanId}`);
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
  const allowedReasons = allowedExclusionReasons(audit, report);
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
    const sourceTokens = tokenSequence(sourceBodyText(audit, startPage, endPage));
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
        evidence.normalizedTokenChecksum === sha256(JSON.stringify(outputTokens)),
      `${label} preservation evidence is stale`,
    );
  }

  const candidateCounts = validateCandidateAudit(audit, report, blockById);
  invariant(
    report.unresolvedWarnings.length === 0,
    'unresolved warnings remain',
  );
  for (const candidate of report.specialCandidates) {
    invariant(
      candidate.status === 'reviewed' && candidate.reviewer.trim().length > 0,
      `${candidate.candidateId} is not reviewed`,
    );
    const sourceSpans = candidate.sourceSpanIds.map((id) => rawSpanById.get(id));
    invariant(
      sourceSpans.length > 0 && sourceSpans.every(Boolean),
      `${candidate.candidateId} references missing source spans`,
    );
    invariant(
      spanChecksum(sourceSpans as RawSpan[]) === candidate.sourceChecksum,
      `${candidate.candidateId} source checksum mismatch`,
    );
    const block = blockById.get(candidate.blockId ?? candidate.candidateId);
    invariant(block?.type === candidate.type, `${candidate.candidateId} block missing`);
    const validDisposition =
      candidate.disposition === `Converted to a reviewed ${candidate.type} block` ||
      (candidate.type === 'knowledgeCheck' &&
        candidate.disposition ===
          'Prompt promoted while structured source blocks remain in order') ||
      (candidate.type === 'code' &&
        candidate.disposition ===
          'Recovered as one reviewed 472-line Python block');
    invariant(validDisposition, `${candidate.candidateId} has an invalid disposition`);
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
    structuredCodeBlocks: blocks.filter((block) => block.type === 'code').length,
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
