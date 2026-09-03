/* oxlint-disable typescript/no-explicit-any -- mutation fixtures intentionally inspect untrusted JSON */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
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
  for (const fixture of fixtures.splice(0))
    rmSync(fixture, { recursive: true });
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
  const reviewLedger = path.resolve('src/content/candidate-review-ledger.json');
  if (existsSync(reviewLedger)) {
    copyFileSync(
      reviewLedger,
      path.join(root, 'src/content/candidate-review-ledger.json'),
    );
  } else {
    const report = JSON.parse(
      readFileSync(
        path.resolve('src/content/conversion-report.generated.json'),
        'utf8',
      ),
    );
    writeFileSync(
      path.join(root, 'src/content/candidate-review-ledger.json'),
      JSON.stringify(
        {
          sourceSha256: report.source.sha256,
          decisions: report.candidateAudit,
        },
        null,
        2,
      ) + '\n',
    );
  }
  const visualEvidence = path.resolve('reports/content-review-evidence');
  if (existsSync(visualEvidence))
    cpSync(visualEvidence, path.join(root, 'reports/content-review-evidence'), {
      recursive: true,
    });
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
      const moved = report.spanAccounting.assigned.filter(
        (assignment: any) => assignment.blockId === removedBlockId,
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

  it('rejects a source-line paragraph split even when report spans are reassigned', () => {
    const root = validationFixture();
    const firstLine =
      '为什么必须做representation？因为现实概念没有统一的机器运算接口。“离CBD 很近”“房屋较新”';
    const secondAndThirdLines =
      '“用户很喜欢”都需要先变成可比较、可组合的数值。Representation 决定模型能够看见什么：如果输入里从未表达“距离”，再复杂的模型也无法直接利用这个信息。';
    const newBlockId = 'body-00048-coordinated-split';
    mutateJson(root, 'course.generated.json', (course) => {
      const section = flattenSections(course.units[0]).find((item) =>
        item.blocks.some((block: any) => block.id === 'body-00048'),
      );
      const index = section.blocks.findIndex(
        (block: any) => block.id === 'body-00048',
      );
      const original = section.blocks[index];
      original.children = [{ type: 'text', value: firstLine }];
      section.blocks.splice(index + 1, 0, {
        ...original,
        id: newBlockId,
        children: [{ type: 'text', value: secondAndThirdLines }],
      });
    });
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      for (const assignment of report.spanAccounting.assigned) {
        if (
          assignment.blockId === 'body-00048' &&
          ['p011-s00062', 'p011-s00063'].includes(assignment.spanId)
        ) {
          assignment.blockId = newBlockId;
        }
      }
    });

    expect(() => validateGeneratedContent(root)).toThrow(
      /independent semantic paragraph/i,
    );
  });

  it('rejects coordinated source-derived outline identity mutations', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      course.units[0].id = 'coordinated-week-one-id';
    });
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      report.outlineMap[1].sectionId = 'coordinated-week-one-id';
    });
    mutateJson(root, 'page-manifest.generated.json', (manifest) => {
      for (const entry of manifest) {
        if (entry.sectionId === 'o0001-week-1')
          entry.sectionId = 'coordinated-week-one-id';
      }
    });

    expect(() => validateGeneratedContent(root)).toThrow(
      /source-derived section id/i,
    );
  });

  it('rejects altered heading page and line evidence', () => {
    const root = validationFixture();
    mutateJson(root, 'conversion-report.generated.json', (report) => {
      report.outlineMap[1].headingPdfPage = 99;
      report.outlineMap[1].headingLineIndexes = [99];
    });

    expect(() => validateGeneratedContent(root)).toThrow(
      /source-derived heading/i,
    );
  });

  it('rejects a runtime outline title changed independently of its source', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      course.units[0].title = 'Fabricated Week 1 title';
    });

    expect(() => validateGeneratedContent(root)).toThrow(
      /source-derived title/i,
    );
  });

  it('rejects a runtime section moved under the wrong source parent', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      const week = course.units[0];
      const moved = week.children.shift();
      week.children[0].children.push(moved);
    });

    expect(() => validateGeneratedContent(root)).toThrow(
      /source-derived parent/i,
    );
  });

  it('rejects a flattened multi-row formula despite preserved accessible text', () => {
    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      const formula = [course.overview, ...course.units]
        .flatMap(flattenSections)
        .flatMap((section) => section.blocks)
        .flatMap(flattenBlocks)
        .find(
          (block) =>
            block.type === 'formula' &&
            block.source.pdfPage === 12 &&
            block.accessibleText === '𝑥= [\n100\n3\n8\n]',
        );
      formula.latex = '\\text{x = [100 3 8]}';
    });

    expect(() => validateGeneratedContent(root)).toThrow(/multi-row formula/i);
  });

  it('rejects a missing or changed immutable candidate review decision', () => {
    const missingRoot = validationFixture();
    mutateJson(missingRoot, 'candidate-review-ledger.json', (ledger) => {
      ledger.decisions.splice(0, 1);
    });
    expect(() => validateGeneratedContent(missingRoot)).toThrow(
      /review ledger/i,
    );

    const changedRoot = validationFixture();
    mutateJson(changedRoot, 'candidate-review-ledger.json', (ledger) => {
      const positive = ledger.decisions.find((decision: any) =>
        ['table', 'code', 'knowledgeCheck'].includes(decision.disposition),
      );
      positive.disposition =
        'not' +
        positive.disposition[0].toUpperCase() +
        positive.disposition.slice(1);
      delete positive.blockId;
      delete positive.targetBlockId;
    });
    expect(() => validateGeneratedContent(changedRoot)).toThrow(
      /review ledger/i,
    );
  });

  it('rejects visual-review evidence whose checked index is changed', () => {
    const root = validationFixture();
    const indexPath = path.join(
      root,
      'reports/content-review-evidence/index.json',
    );
    if (!existsSync(indexPath)) {
      mkdirSync(path.dirname(indexPath), { recursive: true });
      writeFileSync(
        indexPath,
        JSON.stringify({ sourceSha256: 'placeholder', sheets: [] }, null, 2) +
          '\n',
      );
    }
    mutateJson(
      root,
      '../../reports/content-review-evidence/index.json',
      (index) => {
        index.sourceSha256 = 'tampered';
      },
    );

    expect(() => validateGeneratedContent(root)).toThrow(
      /visual review evidence/i,
    );
  });

  it('rejects malformed Appendix syntax without invoking a host-specific Python', () => {
    expect(() => assertValidPythonSyntax('def broken(:\n    pass\n')).toThrow(
      /Python syntax/i,
    );

    const root = validationFixture();
    mutateJson(root, 'course.generated.json', (course) => {
      const appendix = course.units.at(-1);
      appendix.blocks.find((block: any) => block.type === 'code').code =
        'def broken(:\n    pass\n';
    });

    expect(() => validateGeneratedContent(root)).toThrow(/Appendix/i);
  });
});
