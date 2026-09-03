import type { SourceAudit } from './source-audit.mts';

export type SourceHeadingAnchor = {
  outlineIndex: number;
  pdfPage: number;
  lineIndexes: number[];
};

function fail(message: string): never {
  throw new Error(`Source heading derivation failed: ${message}`);
}

function headingProjection(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/[‐‑–−]/gu, '-')
    .replace(/[➀❶]/gu, '1')
    .replace(/[➁❷]/gu, '2')
    .replace(/[➂❸]/gu, '3')
    .replace(/\\sqrt\{([^}]*)\}/gu, '√$1')
    .replaceAll('\\infty', '∞')
    .replace(/[{}_\\]/gu, '')
    .replace(/\s+/gu, '');
}

function hasHeadingTypography(
  audit: SourceAudit,
  pdfPage: number,
  lineIndexes: readonly number[],
): boolean {
  const page = audit.pages[pdfPage - 1];
  const spans = new Map(page.spans.map((span) => [span.id, span]));
  return lineIndexes.every((lineIndex) =>
    page.lines[lineIndex].spanIds.some((spanId) =>
      spans.get(spanId)?.font.includes('Black'),
    ),
  );
}

function sourcePosition(anchor: SourceHeadingAnchor): [number, number] {
  return [anchor.pdfPage, anchor.lineIndexes[0]];
}

/**
 * Resolves outline destinations from checked source geometry only. The PDF
 * outline can point at the page immediately before a heading, so both its
 * destination page and the following physical page are searched. Typography
 * distinguishes real headings from repeated body/formula text.
 */
export function deriveSourceHeadingAnchors(
  audit: SourceAudit,
): SourceHeadingAnchor[] {
  const anchors = audit.outline.map((outline) => {
    const target = headingProjection(outline.titleRaw);
    const matches: SourceHeadingAnchor[] = [];
    const lastPage = Math.min(audit.pages.length, outline.pdfPage + 1);
    for (let pdfPage = outline.pdfPage; pdfPage <= lastPage; pdfPage += 1) {
      const page = audit.pages[pdfPage - 1];
      for (let start = 0; start < page.lines.length; start += 1) {
        let projection = '';
        for (let length = 1; length <= 4; length += 1) {
          const line = page.lines[start + length - 1];
          if (!line) break;
          projection += headingProjection(line.lineRaw);
          if (projection === target) {
            const lineIndexes = Array.from(
              { length },
              (_, offset) => start + offset,
            );
            if (hasHeadingTypography(audit, pdfPage, lineIndexes)) {
              matches.push({
                outlineIndex: outline.outlineIndex,
                pdfPage,
                lineIndexes,
              });
            }
            break;
          }
          if (projection.length > target.length) break;
        }
      }
    }
    if (matches.length !== 1) {
      fail(
        `outline ${outline.outlineIndex} (${outline.titleRaw}) has ${matches.length} source matches`,
      );
    }
    return matches[0];
  });

  const claimedLines = new Set<string>();
  let previous: [number, number] = [0, -1];
  for (const anchor of anchors) {
    const outline = audit.outline[anchor.outlineIndex];
    if (outline.parentOutlineIndex !== null) {
      const parent = audit.outline[outline.parentOutlineIndex];
      if (
        outline.parentOutlineIndex >= outline.outlineIndex ||
        parent.depth + 1 !== outline.depth
      ) {
        fail(`outline ${anchor.outlineIndex} has invalid source hierarchy`);
      }
    }
    const current = sourcePosition(anchor);
    if (
      current[0] < previous[0] ||
      (current[0] === previous[0] && current[1] <= previous[1])
    ) {
      fail(`outline ${anchor.outlineIndex} is out of source order`);
    }
    for (const lineIndex of anchor.lineIndexes) {
      const key = `${anchor.pdfPage}:${lineIndex}`;
      if (claimedLines.has(key))
        fail(`outline ${anchor.outlineIndex} overlaps source line ${key}`);
      claimedLines.add(key);
    }
    previous = current;
  }
  return anchors;
}
