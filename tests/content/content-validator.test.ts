/* oxlint-disable typescript/no-explicit-any -- mutation fixtures intentionally inspect untrusted JSON */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  assertValidPythonSyntax,
  validateGeneratedContent,
} from '@/scripts/validate-content.mts';

const fixtures: string[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true });
});

function validationFixture(options: { includeRaw?: boolean } = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'course-validation-'));
  fixtures.push(root);
  for (const directory of ['src/content', 'public', 'tmp/pdf-extraction'])
    mkdirSync(path.join(root, directory), { recursive: true });
  for (const filename of [
    'course.generated.json',
    'page-manifest.generated.json',
    'conversion-report.generated.json',
    'source-audit.generated.json.gz',
  ]) {
    const source = path.resolve('src/content', filename);
    try {
      copyFileSync(source, path.join(root, 'src/content', filename));
    } catch {
      // The clean-checkout audit artifact is intentionally absent in the RED run.
    }
  }
  copyFileSync(
    path.resolve(
      'public/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf',
    ),
    path.join(
      root,
      'public/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf',
    ),
  );
  if (options.includeRaw !== false)
    copyFileSync(
      path.resolve('tmp/pdf-extraction/raw.json'),
      path.join(root, 'tmp/pdf-extraction/raw.json'),
    );
  return root;
}

function mutateJson(
  root: string,
  filename: string,
  mutation: (value: any) => void,
): any {
  const artifactPath = path.join(root, 'src/content', filename);
  const value = JSON.parse(readFileSync(artifactPath, 'utf8'));
  mutation(value);
  writeFileSync(artifactPath, `${JSON.stringify(value, null, 2)}\n`);
  return value;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokenSequence(value: string): string[] {
  return (
    value
      .normalize('NFKC')
      .replace(/[‐‑–−]/g, '-')
      .replaceAll('\u0000', '')
      .replace(/(\p{Script=Han})/gu, ' $1 ')
      .match(/[\p{L}\p{N}_]+|[^\s]/gu) ?? []
  );
}

function inlineText(nodes: any[]): string {
  return nodes
    .map((node) =>
      'children' in node ? inlineText(node.children) : node.value,
    )
    .join('');
}

function blockText(block: any): string {
  if (block.type === 'paragraph') return inlineText(block.children);
  if (block.type === 'list') return block.items.map(inlineText).join('\n');
  if (block.type === 'formula') return block.accessibleText;
  if (block.type === 'code') return block.code;
  if (block.type === 'table')
    return [...block.headers, ...block.rows.flat()].map(inlineText).join('\n');
  if (block.type === 'callout') return block.blocks.map(blockText).join('\n');
  if (block.type === 'conceptChain') return block.steps.join('\n');
  if (block.type === 'knowledgeCheck')
    return [
      inlineText(block.prompt),
      ...(block.answer ?? []).map(blockText),
    ].join('\n');
  throw new Error(`Unknown block ${block.type}`);
}

function flattenSections(root: any): any[] {
  return [root, ...root.children.flatMap(flattenSections)];
}

function flattenBlocks(block: any): any[] {
  if (block.type === 'callout')
    return [block, ...block.blocks.flatMap(flattenBlocks)];
  return [block];
}

describe('content validator', () => {
  it('recomputes every fidelity gate from checked-in source evidence and generated artifacts', () => {
    expect(() =>
      validateGeneratedContent(validationFixture({ includeRaw: false })),
    ).not.toThrow();
  });

  it('rejects an independently discovered formula candidate omitted with matching decremented claims', () => {
    const root = validationFixture();
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      const index = report.specialCandidates.findIndex(
        (candidate: any) => candidate.type === 'formula',
      );
      const [removed] = report.specialCandidates.splice(index, 1);
      const auditIndex = report.candidateAudit.findIndex(
        (candidate: any) => candidate.blockId === removed.blockId,
      );
      report.candidateAudit.splice(auditIndex, 1);
      report.discovered.formulas -= 1;
      report.reviewed.formulas -= 1;
    });

    expect(() => validateGeneratedContent(root)).toThrow(/formula candidate/i);
  });

  it('rejects altered outline title, page, or parent evidence', () => {
    const root = validationFixture();
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      report.outlineMap[1].titleRaw = 'fabricated title';
      report.outlineMap[1].pdfPage = 99;
      report.outlineMap[1].parentOutlineIndex = null;
    });

    expect(() => validateGeneratedContent(root)).toThrow(/outline.*source/i);
  });

  it('rejects an exclusion reason that is not allowed by source coordinates and type', () => {
    const root = validationFixture();
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      report.spanAccounting.excluded[100].reason = 'Fabricated but nonempty';
    });

    expect(() => validateGeneratedContent(root)).toThrow(/exclusion.*reason/i);
  });

  it('rejects a reviewed candidate with an invalid disposition', () => {
    const root = validationFixture();
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      report.specialCandidates[0].disposition = 'trust me';
    });

    expect(() => validateGeneratedContent(root)).toThrow(/disposition/i);
  });

  it('rejects a compatibility-character change hidden by NFKC', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      const weekTwo = course.units[1];
      const block = flattenSections(weekTwo)
        .flatMap((section) => section.blocks)
        .flatMap(flattenBlocks)
        .find(
          (item) =>
            item.type === 'conceptChain' &&
            item.source.pdfPage === 21 &&
            item.steps[0] === 'Data',
        );
      block.steps[0] = block.steps[0].replace('Data', 'Ｄata');
    });

    expect(() => validateGeneratedContent(root)).toThrow(/week2.*token/i);
  });

  it('rejects prose moved from a Week 2 runtime block into exclusions', () => {
    const root = validationFixture();
    let removedBlockId = '';
    const course = mutateJson(root, 'course.generated.json', (value) => {
      const sections = flattenSections(value.units[1]);
      for (const section of sections) {
        const index = section.blocks.findIndex(
          (block: any) =>
            block.type === 'paragraph' &&
            inlineText(block.children).startsWith(
              'Linear Regression（线性回归）用来预测连续数值',
            ),
        );
        if (index >= 0) {
          removedBlockId = section.blocks[index].id;
          section.blocks.splice(index, 1);
          return;
        }
      }
      throw new Error('Week 2 mutation target missing');
    });
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      const liveIds = new Set(
        flattenSections(course.units[1]).flatMap((section) =>
          section.blocks.map((block: any) => block.id),
        ),
      );
      const moved = report.spanAccounting.assigned.filter((assignment: any) =>
        assignment.blockId === removedBlockId,
      );
      report.spanAccounting.assigned = report.spanAccounting.assigned.filter(
        (assignment: any) => assignment.blockId !== removedBlockId,
      );
      report.spanAccounting.excluded.push(
        ...moved.map((assignment: any) => ({
          spanId: assignment.spanId,
          pdfPage: 21,
          reason: 'Repeated running header',
          status: 'reviewed',
        })),
      );
      report.spanAccounting.assignedCount =
        report.spanAccounting.assigned.length;
      report.spanAccounting.excludedCount =
        report.spanAccounting.excluded.length;

      const raw = JSON.parse(
        readFileSync(path.join(root, 'tmp/pdf-extraction/raw.json'), 'utf8'),
      );
      const assignedIds = new Set(
        report.spanAccounting.assigned
          .filter((item: any) => liveIds.has(item.blockId))
          .map((item: any) => item.spanId),
      );
      const source = raw.pages
        .flatMap((page: any) => page.lines)
        .filter((line: any) =>
          line.spanIds.some((spanId: string) => assignedIds.has(spanId)),
        )
        .map((line: any) => line.lineRaw)
        .join('\n');
      const output = flattenSections(course.units[1])
        .flatMap((section) => section.blocks)
        .map(blockText)
        .join('\n');
      report.prosePreservation.week2.sourceTokenChecksum = sha256(
        JSON.stringify(tokenSequence(source)),
      );
      report.prosePreservation.week2.normalizedTokenChecksum = sha256(
        JSON.stringify(tokenSequence(output)),
      );
    });

    expect(() => validateGeneratedContent(root)).toThrow(/excluded prose/i);
  });

  it('rejects a semantic paragraph regressed into visual-line blocks', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      for (const section of flattenSections(course.units[1])) {
        const index = section.blocks.findIndex(
          (block: any) =>
            block.type === 'paragraph' &&
            inlineText(block.children).startsWith(
              'Linear Regression（线性回归）用来预测连续数值',
            ),
        );
        if (index < 0) continue;
        const block = section.blocks[index];
        const value = inlineText(block.children);
        const splitAt = value.indexOf('例如');
        block.children = [{ type: 'text', value: value.slice(0, splitAt) }];
        section.blocks.splice(index + 1, 0, {
          ...block,
          id: `${block.id}-visual-line-regression`,
          children: [{ type: 'text', value: value.slice(splitAt) }],
        });
        return;
      }
      throw new Error('semantic paragraph mutation target missing');
    });

    expect(() => validateGeneratedContent(root)).toThrow(/semantic paragraph/i);
  });

  it('rejects malformed Appendix syntax without invoking a host-specific Python', () => {
    expect(() =>
      assertValidPythonSyntax('def broken(:\n    pass\n'),
    ).toThrow(/Python syntax/i);

    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      const appendix = course.units.at(-1);
      appendix.blocks.find((block: any) => block.type === 'code').code =
        'def broken(:\n    pass\n';
    });

    expect(() => validateGeneratedContent(root)).toThrow(/Appendix/i);
  });
});
