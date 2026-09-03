import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';

export type RawSpan = {
  id: string;
  textRaw: string;
  font: string;
  size: number;
  flags: number;
  bbox: [number, number, number, number];
  origin: [number, number];
};

export type RawLine = {
  id: string;
  spanIds: string[];
  lineRaw: string;
  bbox: [number, number, number, number];
};

export type RawPage = {
  pdfPage: number;
  printedPageLabel: string | null;
  spans: RawSpan[];
  lines: RawLine[];
};

export type RawOutline = {
  outlineIndex: number;
  parentOutlineIndex: number | null;
  depth: number;
  titleRaw: string;
  pdfPage: number;
};

export type SourceAudit = {
  source: {
    sha256: string;
    pageCount: number;
    extractorVersions: Record<string, string>;
  };
  outline: RawOutline[];
  pages: RawPage[];
};

export const FORMULA_GEOMETRY_VERSION = 'span-and-line-routing-geometry-v2';

export type DetectedCandidate = {
  candidateId: string;
  pdfPage: number;
  lineIndexes: number[];
  sourceSpanIds: string[];
  sourceChecksum: string;
  detector: string;
};

export type FormulaCandidate = DetectedCandidate & {
  display: boolean;
  rationale: string;
};

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

export function spanChecksum(spans: RawSpan[]): string {
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

export function formulaGeometryChecksum(audit: SourceAudit): string {
  return sha256(
    JSON.stringify({
      version: FORMULA_GEOMETRY_VERSION,
      pages: audit.pages.map((page) => ({
        pdfPage: page.pdfPage,
        spans: page.spans.map(({ id, textRaw, font, size, bbox, origin }) => ({
          id,
          textRaw,
          font,
          size,
          bbox,
          origin,
        })),
        lines: page.lines.map(({ id, spanIds, lineRaw, bbox }) => ({
          id,
          spanIds,
          lineRaw,
          bbox,
        })),
      })),
    }),
  );
}

export function spansForLines(
  page: RawPage,
  lineIndexes: number[],
): RawSpan[] {
  const byId = new Map(page.spans.map((span) => [span.id, span]));
  return lineIndexes.flatMap((lineIndex) =>
    page.lines[lineIndex].spanIds.map((spanId) => {
      const span = byId.get(spanId);
      if (!span) throw new Error(`Missing audit span ${spanId}`);
      return span;
    }),
  );
}

function candidate(
  kind: string,
  page: RawPage,
  sequence: number,
  lineIndexes: number[],
  detector: string,
): DetectedCandidate {
  const orderedIndexes = [...lineIndexes].sort((left, right) => left - right);
  const spans = spansForLines(page, orderedIndexes);
  return {
    candidateId: `${kind}-p${String(page.pdfPage).padStart(3, '0')}-g${String(sequence).padStart(3, '0')}`,
    pdfPage: page.pdfPage,
    lineIndexes: orderedIndexes,
    sourceSpanIds: spans.map((span) => span.id),
    sourceChecksum: spanChecksum(spans),
    detector,
  };
}

export function detectFormulaCandidates(audit: SourceAudit): FormulaCandidate[] {
  const output: FormulaCandidate[] = [];
  for (const page of audit.pages) {
    const spanById = new Map(page.spans.map((span) => [span.id, span]));
    const mathLines = page.lines
      .map((line, lineIndex) => ({
        line,
        lineIndex,
        spans: line.spanIds.map((spanId) => spanById.get(spanId)!),
      }))
      .filter(({ spans }) =>
        spans.some((span) => span.font.includes('LatinModernMath')),
      )
      .sort(
        (left, right) =>
          left.line.bbox[1] - right.line.bbox[1] ||
          left.line.bbox[0] - right.line.bbox[0],
      );
    const groups: (typeof mathLines)[] = [];
    let maximumY = Number.NEGATIVE_INFINITY;
    for (const mathLine of mathLines) {
      if (
        groups.length > 0 &&
        mathLine.line.bbox[1] <= maximumY + 6
      ) {
        groups.at(-1)!.push(mathLine);
        maximumY = Math.max(maximumY, mathLine.line.bbox[3]);
      } else {
        groups.push([mathLine]);
        maximumY = mathLine.line.bbox[3];
      }
    }
    for (const [sequence, group] of groups.entries()) {
      const left = Math.min(...group.map(({ line }) => line.bbox[0]));
      const right = Math.max(...group.map(({ line }) => line.bbox[2]));
      const maximumMathSize = Math.max(
        ...group.flatMap(({ spans }) =>
          spans
            .filter((span) => span.font.includes('LatinModernMath'))
            .map((span) => span.size),
        ),
      );
      const display = left > 120 && right < 480 && maximumMathSize >= 11;
      output.push({
        ...candidate(
          'math',
          page,
          sequence,
          group.map(({ lineIndex }) => lineIndex),
          'LatinModernMath connected-component geometry v1',
        ),
        display,
        rationale: display
          ? 'Centered 11pt+ math component within the body column'
          : 'Math glyphs are embedded in a prose-width or non-centered visual line',
      });
    }
  }
  return output;
}

type BaselineRow = {
  y: number;
  lineIndexes: number[];
  anchors: number[];
};

function baselineRows(page: RawPage): BaselineRow[] {
  const rows: BaselineRow[] = [];
  for (const [lineIndex, line] of page.lines.entries()) {
    if (line.bbox[1] < 50 || line.bbox[1] > 790) continue;
    const row = rows.find((item) => Math.abs(item.y - line.bbox[1]) <= 0.8);
    if (row) {
      row.lineIndexes.push(lineIndex);
      row.anchors.push(line.bbox[0]);
    } else {
      rows.push({ y: line.bbox[1], lineIndexes: [lineIndex], anchors: [line.bbox[0]] });
    }
  }
  return rows
    .filter((row) => row.anchors.length >= 2)
    .sort((left, right) => left.y - right.y);
}

export function detectTableCandidates(audit: SourceAudit): DetectedCandidate[] {
  const output: DetectedCandidate[] = [];
  for (const page of audit.pages) {
    const rows = baselineRows(page);
    const groups: BaselineRow[][] = [];
    for (const row of rows) {
      const previous = groups.at(-1)?.at(-1);
      if (previous && row.y - previous.y <= 18) groups.at(-1)!.push(row);
      else groups.push([row]);
    }
    let sequence = 0;
    for (const group of groups) {
      if (group.length < 2) continue;
      const anchorBins = new Map<number, number>();
      for (const row of group) {
        for (const anchor of row.anchors)
          anchorBins.set(Math.round(anchor / 4), (anchorBins.get(Math.round(anchor / 4)) ?? 0) + 1);
      }
      const repeatedColumns = [...anchorBins.values()].filter(
        (count) => count >= 2,
      ).length;
      if (repeatedColumns < 2) continue;
      output.push(
        candidate(
          'table-signal',
          page,
          sequence,
          group.flatMap((row) => row.lineIndexes),
          'Repeated x-column anchors on adjacent baselines v1',
        ),
      );
      sequence += 1;
    }
  }
  return output;
}

function looksLikeCode(line: RawLine, spans: RawSpan[]): boolean {
  if (spans.some((span) => span.size > 8.9)) return false;
  return (
    spans.some((span) => span.font.includes('Black')) &&
    /(?:\b(?:def|class|return|import|from|for|if|else|while|self|torch|nn\.)\b|[=()[\]{}:]|\.\w+\()/u.test(
      line.lineRaw,
    )
  );
}

export function detectCodeCandidates(audit: SourceAudit): DetectedCandidate[] {
  const output: DetectedCandidate[] = [];
  for (const page of audit.pages) {
    const byId = new Map(page.spans.map((span) => [span.id, span]));
    const matching = page.lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line }) =>
        looksLikeCode(
          line,
          line.spanIds.map((spanId) => byId.get(spanId)!),
        ),
      );
    const groups: { lines: typeof matching; lastY: number }[] = [];
    for (const item of matching) {
      const previous = groups.at(-1);
      if (previous && item.line.bbox[1] - previous.lastY <= 14) {
        previous.lines.push(item);
        previous.lastY = item.line.bbox[1];
      } else groups.push({ lines: [item], lastY: item.line.bbox[1] });
    }
    for (const [sequence, group] of groups.entries())
      output.push(
        candidate(
          'code-signal',
          page,
          sequence,
          group.lines.map(({ lineIndex }) => lineIndex),
          'Compact 8.9pt-or-smaller code-token geometry v1',
        ),
      );
  }
  const appendixLines = audit.pages
    .filter((page) => page.pdfPage >= 161)
    .flatMap((page) =>
      page.lines
        .map((line, lineIndex) => ({ page, line, lineIndex }))
        .filter(
          ({ line }) =>
            line.bbox[1] >= 50 &&
            line.bbox[1] <= 790 &&
            line.spanIds.some((spanId) =>
              page.spans
                .find((span) => span.id === spanId)
                ?.font.includes('Black'),
            ),
        ),
    );
  if (appendixLines.length > 0) {
    const spans = appendixLines.flatMap(({ page, line }) =>
      line.spanIds.map((spanId) => page.spans.find((span) => span.id === spanId)!),
    );
    output.push({
      candidateId: 'code-signal-appendix-a',
      pdfPage: 161,
      lineIndexes: appendixLines.map(({ lineIndex }) => lineIndex),
      sourceSpanIds: spans.map((span) => span.id),
      sourceChecksum: spanChecksum(spans),
      detector: 'Contiguous compact-code region on Appendix pages 161-170 v1',
    });
  }
  return output;
}

export function detectKnowledgeCandidates(
  audit: SourceAudit,
): DetectedCandidate[] {
  return audit.outline
    .filter((item) => /(?:测试|练习|问题|思考)/u.test(item.titleRaw))
    .map((item, sequence) => {
      const page = audit.pages[item.pdfPage - 1];
      const matching = page.lines
        .map((line, lineIndex) => ({ line, lineIndex }))
        .find(({ line }) =>
          line.lineRaw.replaceAll(' ', '').includes(item.titleRaw.replaceAll(' ', '')),
        );
      const lineIndexes = matching ? [matching.lineIndex] : [];
      const spans = lineIndexes.length > 0 ? spansForLines(page, lineIndexes) : [];
      return {
        candidateId: `knowledge-signal-o${String(item.outlineIndex).padStart(4, '0')}`,
        pdfPage: item.pdfPage,
        lineIndexes,
        sourceSpanIds: spans.map((span) => span.id),
        sourceChecksum: spanChecksum(spans),
        detector: `Outline title question/check pattern v1 (${sequence})`,
      };
    });
}

export function readSourceAudit(filename: string): SourceAudit {
  return JSON.parse(gunzipSync(readFileSync(filename)).toString('utf8'));
}

export function writeSourceAudit(filename: string, audit: SourceAudit): void {
  writeFileSync(filename, gzipSync(`${JSON.stringify(audit)}\n`, { level: 9 }));
}
