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

function nestedBlocks(block: ContentBlock): ContentBlock[] {
  if (block.type === 'callout')
    return [block, ...block.blocks.flatMap(nestedBlocks)];
  if (block.type === 'knowledgeCheck')
    return [block, ...(block.answer ?? []).flatMap(nestedBlocks)];
  return [block];
}

describe('complete generated course content', () => {
  const course = loadCourse(courseData);
  const manifest = PageManifestSchema.parse(manifestData);
  const report = reportData;
  const allSections = course.units.flatMap((unit) => flattenSections(unit));
  const allBlocks = [course.overview, ...course.units]
    .flatMap((root) => flattenSections(root))
    .flatMap((section) => section.blocks)
    .flatMap(nestedBlocks);
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
    expect(allText).toContain('Neural Network 本质上只是把Week 2 的：');
    expect(allText).toContain('从一个计算单元，扩展成大量相互连接的计算单元。');
  });

  it('groups the physical-page-12 vector into one structured formula', () => {
    const vectorFormulas = allBlocks.filter(
      (block) =>
        block.type === 'formula' &&
        block.source.pdfPage === 12 &&
        block.accessibleText.includes('100') &&
        block.accessibleText.includes('3') &&
        block.accessibleText.includes('8'),
    );

    expect(vectorFormulas).toHaveLength(1);
    expect(vectorFormulas[0]).toMatchObject({
      type: 'formula',
      accessibleText: '𝑥= [\n100\n3\n8\n]',
    });
    expect(
      vectorFormulas[0]?.type === 'formula' && vectorFormulas[0].latex,
    ).toBe('x = \\begin{bmatrix} 100 \\\\ 3 \\\\ 8 \\end{bmatrix}');
  });

  it('joins wrapped Chinese and mixed-language prose into semantic paragraphs', () => {
    const paragraphs = allBlocks
      .filter((block) => block.type === 'paragraph')
      .map(blockText);

    expect(paragraphs).toContain(
      '为什么必须做representation？因为现实概念没有统一的机器运算接口。“离CBD 很近”“房屋较新”“用户很喜欢”都需要先变成可比较、可组合的数值。Representation 决定模型能够看见什么：如果输入里从未表达“距离”，再复杂的模型也无法直接利用这个信息。',
    );
    expect(paragraphs).toContain(
      '以后你会经常看到一个训练batch 最后产生一个scalar loss。因为只有一个最终Loss，才能方便地从它开始向后计算所有参数的gradient。',
    );
    expect(paragraphs).toContain(
      '这三个数字的组合才是完整representation。Vector 的dimension 表示模型用多少个数描述对象；dimension 越多不一定越好，关键是每个维度能否通过training 承载有用信息。',
    );
    expect(paragraphs).toContain(
      '只要这条链真正理解了，后面的Neural Network、Backpropagation，甚至Transformer / GPT 的训练都会顺很多。',
    );
  });

  it('retains grouped bullets as semantic lists', () => {
    const lists = allBlocks.filter((block) => block.type === 'list');
    const overviewList = lists.find((block) => block.source.pdfPage === 10);
    const weekTwoList = lists.find(
      (block) =>
        block.source.pdfPage === 21 &&
        blockText(block).includes('Feature，输入特征'),
    );

    expect(overviewList).toMatchObject({ type: 'list', ordered: false });
    expect(overviewList && blockText(overviewList)).toContain(
      'Week 3：保留指定邮件原文，公式仅转换为专业数学排版；',
    );
    expect(weekTwoList).toMatchObject({ type: 'list', ordered: false });
  });

  it('retains arrow pipelines and their source region as semantic blocks', () => {
    const weekTwoChain = allBlocks.find(
      (block) =>
        block.type === 'conceptChain' &&
        block.source.pdfPage === 21 &&
        block.steps[0] === 'Data',
    );
    const weekTwoCallout = allBlocks.find(
      (block) =>
        block.type === 'callout' &&
        block.source.pdfPage === 21 &&
        block.blocks.some((child) => child.id === weekTwoChain?.id),
    );

    expect(weekTwoChain).toMatchObject({
      type: 'conceptChain',
      steps: [
        'Data',
        'Parameters',
        'Prediction',
        'Error',
        'Loss',
        'Gradient',
        'Update',
        'Better Prediction',
      ],
    });
    expect(weekTwoCallout).toMatchObject({ type: 'callout', tone: 'concept' });
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
