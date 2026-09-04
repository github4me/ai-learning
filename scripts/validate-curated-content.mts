import courseData from '../src/content/course.generated.json';
import { getCourse } from '../src/content/course-runtime';
import { CURATED_WEEK_REVISIONS } from '../src/content/curated';
import { findSection, loadCourse } from '../src/content/load-course';
import type { ContentBlock, Course, SectionNode, WeekUnit } from '../src/content/schema';

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Curated content validation failed: ${message}`);
}

function collectBlockIds(
  blocks: readonly ContentBlock[],
  ids: string[],
): void {
  for (const block of blocks) {
    ids.push(block.id);
    if (block.type === 'callout') collectBlockIds(block.blocks, ids);
    if (block.type === 'knowledgeCheck')
      collectBlockIds(block.answer ?? [], ids);
  }
}

function collectText(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return block.children
        .map((child) => ('value' in child ? child.value : ''))
        .join('');
    case 'list':
      return block.items
        .flat()
        .map((child) => ('value' in child ? child.value : ''))
        .join('');
    case 'formula':
      return `${block.latex} ${block.accessibleText}`;
    case 'code':
      return `${block.language} ${block.code}`;
    case 'table':
      return JSON.stringify(block);
    case 'conceptChain':
      return block.steps.join(' ');
    case 'callout':
      return `${block.title ?? ''} ${block.blocks.map(collectText).join(' ')}`;
    case 'knowledgeCheck':
      return `${block.prompt
        .map((child) => ('value' in child ? child.value : ''))
        .join(' ')} ${(block.answer ?? []).map(collectText).join(' ')}`;
  }
}

function findBlockIndex(
  blocks: readonly ContentBlock[],
  predicate: (block: ContentBlock) => boolean,
): number {
  return blocks.findIndex(predicate);
}

function validateSection(course: Course, section: SectionNode): void {
  const problemIndex = findBlockIndex(
    section.blocks,
    (block) => block.type === 'callout' && block.title === '先看问题',
  );
  const purposeIndex = findBlockIndex(
    section.blocks,
    (block) => block.type === 'callout' && block.title === '为什么需要它',
  );
  const pitfallsIndex = findBlockIndex(
    section.blocks,
    (block) => block.type === 'callout' && block.title === '常见误区',
  );
  const checkIndex = findBlockIndex(
    section.blocks,
    (block) => block.type === 'knowledgeCheck',
  );
  invariant(problemIndex === 0, `${section.id} is missing its problem frame`);
  invariant(purposeIndex === 1, `${section.id} is missing its purpose frame`);
  invariant(
    pitfallsIndex > purposeIndex + 1,
    `${section.id} is missing worked content between purpose and pitfalls`,
  );
  invariant(
    checkIndex === section.blocks.length - 1 && checkIndex > pitfallsIndex,
    `${section.id} has teaching frames in the wrong top-level order`,
  );
  const check = section.blocks[checkIndex];
  invariant(check?.type === 'knowledgeCheck', `${section.id} is missing its knowledge check`);
  invariant(
    (check.answer?.length ?? 0) > 0,
    `${section.id} has an empty knowledge-check answer`,
  );
  invariant(
    Boolean(findSection(course, check.reviewSectionId)),
    `${section.id} references an invalid review section`,
  );

  const allBlocks: ContentBlock[] = [];
  const collectBlocks = (blocks: readonly ContentBlock[]) => {
    for (const block of blocks) {
      allBlocks.push(block);
      if (block.type === 'callout') collectBlocks(block.blocks);
      if (block.type === 'knowledgeCheck') collectBlocks(block.answer ?? []);
    }
  };
  collectBlocks(section.blocks);
  for (const block of allBlocks) {
    invariant(
      !/symbol\d+/iu.test(collectText(block)),
      `${section.id} contains an extraction placeholder`,
    );
    if (block.type === 'code')
      invariant(block.code.trim().length > 0, `${block.id} has empty code`);
    if (block.type === 'formula')
      invariant(block.latex.trim().length > 0, `${block.id} has an empty formula`);
    if (block.type === 'table')
      invariant(
        block.headers.length > 0 && block.rows.length > 0,
        `${block.id} has an empty table`,
      );
  }
}

const baseline = loadCourse(courseData);
const course = getCourse();
const ids: string[] = [];

for (const revision of CURATED_WEEK_REVISIONS) {
  const baselineWeek = baseline.units.find(
    (unit): unit is WeekUnit =>
      unit.kind === 'week' && unit.slug === revision.weekSlug,
  );
  const finalWeek = course.units.find(
    (unit): unit is WeekUnit =>
      unit.kind === 'week' && unit.slug === revision.weekSlug,
  );
  invariant(baselineWeek, `missing baseline ${revision.weekSlug}`);
  invariant(finalWeek, `missing final ${revision.weekSlug}`);
  const baselineIds = baselineWeek.children.map((section) => section.id);
  const revisionIds = revision.sections.map((section) => section.sectionId);
  invariant(
    baselineIds.length === revisionIds.length &&
      baselineIds.every((id) => revisionIds.includes(id)) &&
      new Set(revisionIds).size === revisionIds.length,
    `${revision.weekSlug} does not represent every direct baseline section once`,
  );
  invariant(
    finalWeek.children.length === baselineWeek.children.length,
    `${revision.weekSlug} changed its direct-section count`,
  );
  for (const sectionId of baselineIds) {
    const section = finalWeek.children.find((child) => child.id === sectionId);
    invariant(section, `${revision.weekSlug} is missing ${sectionId}`);
    invariant(section.children.length === 0, `${sectionId} has remaining child sections`);
    validateSection(course, section);
    collectBlockIds(section.blocks, ids);
  }
}

invariant(
  new Set(ids).size === ids.length,
  'curated content uses duplicate block IDs',
);

console.log(
  `Curated content validation passed: ${JSON.stringify({ weeks: CURATED_WEEK_REVISIONS.length, blocks: ids.length })}`,
);
