import { describe, expect, it } from 'vitest';

import courseData from '@/src/content/course.generated.json';
import manifestData from '@/src/content/page-manifest.generated.json';
import reportData from '@/src/content/conversion-report.generated.json';
import { flattenSections, loadCourse } from '@/src/content/load-course';
import {
  PageManifestSchema,
  type ContentBlock,
  type InlineNode,
} from '@/src/content/schema';

function inlineText(nodes: InlineNode[]): string {
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
      return `${block.latex}\n${block.accessibleText}`;
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

describe('complete generated course content', () => {
  const course = loadCourse(courseData);
  const manifest = PageManifestSchema.parse(manifestData);
  const report = reportData;
  const allSections = course.units.flatMap((unit) => flattenSections(unit));
  const allText = allSections
    .flatMap((section) => section.blocks)
    .map(blockText)
    .join('\n');

  it('contains the complete learning path and physical-page manifest', () => {
    expect(course.units.filter((unit) => unit.kind === 'week')).toHaveLength(
      12,
    );
    expect(course.units.at(-1)?.kind).toBe('appendix');
    expect(manifest).toHaveLength(170);
    expect(new Set(manifest.map((entry) => entry.pdfPage)).size).toBe(170);
  });

  it('has complete, reviewed conversion evidence', () => {
    expect(report.outline.coveragePercent).toBe(100);
    expect(report.unresolvedWarnings).toEqual([]);
    expect(report.reviewed.formulas).toBe(report.discovered.formulas);
    expect(report.reviewed.tables).toBe(report.discovered.tables);
    expect(report.reviewed.codeBlocks).toBe(report.discovered.codeBlocks);
    expect(report.reviewed.knowledgeChecks).toBe(
      report.discovered.knowledgeChecks,
    );
  });

  it('preserves representative Week 2 and Week 3 source excerpts exactly', () => {
    expect(allText).toContain(
      'Data → Parameters → Prediction → Error → Loss → Gradient → Update → Better Prediction',
    );
    expect(allText).toContain('Neural Network 本质上只是把 Week 2 的：');
    expect(allText).toContain('从一个计算单元，扩展成大量相互连接的计算单元。');
  });

  it('keeps links on one-based physical PDF pages', () => {
    expect(manifest[9]).toMatchObject({
      pdfPage: 10,
      sectionId: 'o0000-readme',
    });
    expect(course.units[3]?.source.pdfPage).toBe(74);
    expect(course.units[12]?.source.pdfPage).toBe(161);
  });
});
