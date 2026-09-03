import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import katex from 'katex';

import { flattenSections, loadCourse } from '../src/content/load-course';
import {
  PageManifestSchema,
  type ContentBlock,
  type Course,
  type InlineNode,
  type SectionNode,
} from '../src/content/schema';

const EXPECTED_SHA256 =
  '3ED047406DE297352B38635D01CF080B0213C9FD899AEA80520AA8A8283E1D52';
const EXPECTED_APPENDIX_SHA256 =
  '0c1a22f8927a94f0101b4bbcf3b9d256e37c31fb91c6f92bb9b0b2d71195cdfd';
const PYTHON =
  'C:\\Users\\Chao\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';

type RawSpan = {
  id: string;
  textRaw: string;
  font: string;
  size: number;
  bbox: [number, number, number, number];
};
type RawLine = { spanIds: string[]; lineRaw: string };
type RawPage = {
  pdfPage: number;
  printedPageLabel: string | null;
  spans: RawSpan[];
  lines: RawLine[];
};
type RawExtraction = {
  source: { sha256: string; pageCount: number };
  outline: {
    outlineIndex: number;
    parentOutlineIndex: number | null;
    depth: number;
    titleRaw: string;
    pdfPage: number;
  }[];
  pages: RawPage[];
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
    sectionId: string;
    status: string;
  }[];
  spanAccounting: {
    positionedSpanCount: number;
    assignedCount: number;
    excludedCount: number;
    assigned: { spanId: string; blockId: string }[];
    excluded: { spanId: string; status: string; reason: string }[];
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
    type: 'formula' | 'table' | 'code' | 'knowledgeCheck';
    status: string;
    reviewer: string;
    sourceSpanIds: string[];
    sourceChecksum: string;
  }[];
  discovered: Record<
    'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks',
    number
  >;
  reviewed: Record<
    'formulas' | 'tables' | 'codeBlocks' | 'knowledgeChecks',
    number
  >;
  unresolvedWarnings: unknown[];
};

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Content validation failed: ${message}`);
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHyphens(value: string): string {
  return value.replace(/[‐‑–−]/g, '-').replaceAll('\u00a0', ' ');
}

function tokenSequence(value: string): string[] {
  return (
    normalizeHyphens(value)
      .normalize('NFKC')
      .replaceAll('\u0000', '')
      .replace(/(\p{Script=Han})/gu, ' $1 ')
      .match(/[\p{L}\p{N}_]+|[^\s]/gu) ?? []
  );
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
      return block.items.map(inlineText).join('\n');
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
      return block.steps.join('\n');
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
    ...section.blocks.map(blockText),
    ...section.children.map(sectionText),
  ].join('\n');
}

function sectionBlockIds(section: SectionNode): Set<string> {
  const ids = new Set<string>();
  for (const current of flattenSections(section)) {
    const visit = (block: ContentBlock) => {
      ids.add(block.id);
      if (block.type === 'callout') block.blocks.forEach(visit);
      if (block.type === 'knowledgeCheck') (block.answer ?? []).forEach(visit);
    };
    current.blocks.forEach(visit);
  }
  return ids;
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

export function validateGeneratedContent(repositoryRoot = process.cwd()) {
  const raw = JSON.parse(
    readFileSync(
      path.join(repositoryRoot, 'tmp/pdf-extraction/raw.json'),
      'utf8',
    ),
  ) as RawExtraction;
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

  invariant(
    raw.source.sha256 === EXPECTED_SHA256,
    'raw source SHA-256 changed',
  );
  invariant(
    sha256(publicPdf).toUpperCase() === EXPECTED_SHA256,
    'public PDF SHA-256 changed',
  );
  invariant(
    raw.source.pageCount === 170 && raw.pages.length === 170,
    'source must have 170 pages',
  );
  invariant(
    raw.outline.length === 461,
    'source must have 461 outline destinations',
  );
  invariant(
    new Set(raw.outline.map((item) => `${item.titleRaw}\u0000${item.pdfPage}`))
      .size === 461,
    'outline title/page destinations must be unique',
  );

  invariant(manifest.length === 170, 'manifest must classify 170 pages');
  invariant(
    new Set(manifest.map((entry) => entry.pdfPage)).size === 170,
    'manifest physical pages must be unique',
  );
  invariant(
    manifest.every((entry, index) => entry.pdfPage === index + 1),
    'manifest pages must be ordered 1 through 170',
  );
  invariant(
    manifest[0].classification === 'frontMatter' && Boolean(manifest[0].reason),
    'page 1 must be explained front matter',
  );
  invariant(
    manifest
      .slice(1, 9)
      .every(
        (entry) =>
          entry.classification === 'navigationReplaced' &&
          Boolean(entry.reason),
      ),
    'pages 2-9 must be explained navigation replacements',
  );
  invariant(
    manifest.slice(9).every((entry) => entry.classification === 'content'),
    'pages 10-170 must be content',
  );
  for (const page of raw.pages) {
    const entry = manifest[page.pdfPage - 1];
    if (page.pdfPage < 10) {
      invariant(
        page.printedPageLabel === null && entry.printedPageLabel === undefined,
        `page ${page.pdfPage} must not have a printed label`,
      );
    } else {
      const expected = String(page.pdfPage - 9);
      invariant(
        page.printedPageLabel === expected,
        `raw printed label mismatch on page ${page.pdfPage}`,
      );
      invariant(
        entry.printedPageLabel === expected,
        `manifest printed label mismatch on page ${page.pdfPage}`,
      );
    }
  }

  invariant(
    course.overview.source.pdfPage === 10,
    'overview must link to physical page 10',
  );
  invariant(
    course.units.length === 13,
    'course must have 12 weeks plus Appendix A',
  );
  invariant(
    course.units
      .slice(0, 12)
      .every(
        (unit, index) => unit.kind === 'week' && unit.weekNumber === index + 1,
      ),
    'weeks must be sequential',
  );
  invariant(
    course.units[3]?.source.pdfPage === 74,
    'Week 4 must link to physical page 74',
  );
  invariant(
    course.units[12]?.kind === 'appendix' &&
      course.units[12].source.pdfPage === 161,
    'Appendix A must link to physical page 161',
  );

  invariant(
    report.outline.total === raw.outline.length,
    'report outline total is not derived from raw extraction',
  );
  invariant(
    report.outline.mapped === 461 && report.outline.coveragePercent === 100,
    'outline coverage must be 461/461 and 100%',
  );
  invariant(
    report.outline.rootCount === 14,
    'all 14 top-level roots must be represented',
  );
  invariant(
    report.outlineMap.length === 461,
    'outline map must contain every destination',
  );
  invariant(
    report.outlineMap.every(
      (entry, index) =>
        entry.outlineIndex === index && entry.status === 'mapped',
    ),
    'outline map must be direct, ordered, and complete',
  );
  const sectionIds = new Set(
    [course.overview, ...course.units].flatMap((root) =>
      flattenSections(root).map((section) => section.id),
    ),
  );
  invariant(
    report.outlineMap.every((entry) => sectionIds.has(entry.sectionId)),
    'every outline mapping must resolve to a runtime section',
  );
  invariant(
    manifest
      .slice(9)
      .every((entry) => entry.sectionId && sectionIds.has(entry.sectionId)),
    'every content page must resolve to a runtime section',
  );

  const blocks = allBlocks(course);
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  invariant(
    blockById.size === blocks.length,
    'runtime block IDs must be unique',
  );
  const rawSpans = raw.pages.flatMap((page) => page.spans);
  const rawSpanById = new Map(rawSpans.map((span) => [span.id, span]));
  const assignments = report.spanAccounting.assigned as {
    spanId: string;
    blockId: string;
  }[];
  const exclusions = report.spanAccounting.excluded as {
    spanId: string;
    reason: string;
    status: string;
  }[];
  const accounted = [
    ...assignments.map((item) => item.spanId),
    ...exclusions.map((item) => item.spanId),
  ];
  invariant(
    report.spanAccounting.positionedSpanCount === rawSpans.length,
    'reported positioned-span count changed',
  );
  invariant(
    assignments.length === report.spanAccounting.assignedCount,
    'assigned-span count changed',
  );
  invariant(
    exclusions.length === report.spanAccounting.excludedCount,
    'excluded-span count changed',
  );
  invariant(
    accounted.length === rawSpans.length &&
      new Set(accounted).size === rawSpans.length,
    'every positioned span must be assigned or reviewed-excluded exactly once',
  );
  invariant(
    accounted.every((id) => rawSpanById.has(id)),
    'span accounting references an unknown source span',
  );
  invariant(
    assignments.every((item) => blockById.has(item.blockId)),
    'span assignment references an unknown runtime block',
  );
  invariant(
    exclusions.every(
      (item) => item.status === 'reviewed' && item.reason.trim().length > 0,
    ),
    'every exclusion must be reviewed and explained',
  );

  for (const [label, unitIndex] of [
    ['week2', 1],
    ['week3', 2],
  ] as const) {
    const unit = course.units[unitIndex];
    invariant(unit?.kind === 'week', `${label} runtime unit is missing`);
    const blockIds = sectionBlockIds(unit);
    const assignedSpanIds = new Set(
      assignments
        .filter((assignment) => blockIds.has(assignment.blockId))
        .map((assignment) => assignment.spanId),
    );
    const sourceLines: string[] = [];
    for (const page of raw.pages) {
      for (const line of page.lines) {
        if (line.spanIds.some((spanId) => assignedSpanIds.has(spanId)))
          sourceLines.push(line.lineRaw);
      }
    }
    const sourceTokens = tokenSequence(sourceLines.join('\n'));
    const outputTokens = tokenSequence(sectionText(unit));
    if (JSON.stringify(sourceTokens) !== JSON.stringify(outputTokens)) {
      const mismatchIndex = sourceTokens.findIndex(
        (token, index) => token !== outputTokens[index],
      );
      invariant(
        false,
        `${label} token sequence differs at ${mismatchIndex}: source=${JSON.stringify(sourceTokens.slice(Math.max(0, mismatchIndex - 4), mismatchIndex + 5))}, output=${JSON.stringify(outputTokens.slice(Math.max(0, mismatchIndex - 4), mismatchIndex + 5))}`,
      );
    }
    const evidence = report.prosePreservation[label];
    invariant(
      evidence.matches === true,
      `${label} preservation report is unresolved`,
    );
    invariant(
      evidence.sourceTokenChecksum === sha256(JSON.stringify(sourceTokens)),
      `${label} source token checksum is stale`,
    );
    invariant(
      evidence.normalizedTokenChecksum === sha256(JSON.stringify(outputTokens)),
      `${label} output token checksum is stale`,
    );
  }

  const candidateCounts = {
    formulas: 0,
    tables: 0,
    codeBlocks: 0,
    knowledgeChecks: 0,
  };
  for (const candidate of report.specialCandidates) {
    invariant(
      candidate.status === 'reviewed' && candidate.reviewer.trim().length > 0,
      `${candidate.candidateId} is not reviewed`,
    );
    invariant(
      candidate.sourceSpanIds.length > 0,
      `${candidate.candidateId} has no source spans`,
    );
    const sourceSpans = candidate.sourceSpanIds.map((id: string) =>
      rawSpanById.get(id),
    );
    invariant(
      sourceSpans.every(Boolean),
      `${candidate.candidateId} references an unknown span`,
    );
    invariant(
      spanChecksum(sourceSpans as RawSpan[]) === candidate.sourceChecksum,
      `${candidate.candidateId} source checksum mismatch`,
    );
    if (candidate.type === 'formula') candidateCounts.formulas += 1;
    else if (candidate.type === 'table') candidateCounts.tables += 1;
    else if (candidate.type === 'code') candidateCounts.codeBlocks += 1;
    else if (candidate.type === 'knowledgeCheck')
      candidateCounts.knowledgeChecks += 1;
    else invariant(false, `${candidate.candidateId} has an unknown type`);
  }
  for (const key of Object.keys(
    candidateCounts,
  ) as (keyof typeof candidateCounts)[]) {
    invariant(
      report.discovered[key] === candidateCounts[key],
      `${key} discovered count is stale`,
    );
    invariant(
      report.reviewed[key] === candidateCounts[key],
      `${key} reviewed count is incomplete`,
    );
  }
  invariant(
    Array.isArray(report.unresolvedWarnings) &&
      report.unresolvedWarnings.length === 0,
    'unresolved warnings remain',
  );

  const formulas = blocks.filter((block) => block.type === 'formula');
  invariant(formulas.length > 0, 'course must contain formula blocks');
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
      (item) => item.candidateId === table.id,
    );
    invariant(candidate, `${table.id} has no candidate record`);
    const candidateSpanIds = new Set(candidate.sourceSpanIds as string[]);
    const sourceText = raw.pages
      .flatMap((page) =>
        page.lines
          .filter((line) => line.spanIds.some((id) => candidateSpanIds.has(id)))
          .map((line) => line.lineRaw),
      )
      .join('\n');
    const tableTokens = tokenSequence(blockText(table));
    const sourceTokens = tokenSequence(sourceText);
    if (JSON.stringify(tableTokens) !== JSON.stringify(sourceTokens)) {
      const mismatchIndex = sourceTokens.findIndex(
        (token, index) => token !== tableTokens[index],
      );
      invariant(
        false,
        `${table.id} cells differ at ${mismatchIndex}: source=${JSON.stringify(sourceTokens.slice(Math.max(0, mismatchIndex - 4), mismatchIndex + 5))}, output=${JSON.stringify(tableTokens.slice(Math.max(0, mismatchIndex - 4), mismatchIndex + 5))}`,
      );
    }
  }

  const appendix = allBlocks(courseInput).find(
    (block): block is Extract<ContentBlock, { type: 'code' }> =>
      block.type === 'code' && block.id === 'code-appendix-a-mini-gpt',
  );
  invariant(appendix, 'Appendix A code block is missing');
  invariant(
    appendix.code.split('\n').length - 1 === 472,
    'Appendix A must have exactly 472 lines',
  );
  invariant(
    sha256(appendix.code) === EXPECTED_APPENDIX_SHA256,
    'Appendix A code checksum changed',
  );
  const ast = spawnSync(
    PYTHON,
    ['-c', 'import ast,sys; ast.parse(sys.stdin.read())'],
    {
      input: appendix.code,
      encoding: 'utf8',
    },
  );
  invariant(ast.status === 0, `Appendix A Python AST failed: ${ast.stderr}`);

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
    ...candidateCounts,
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
