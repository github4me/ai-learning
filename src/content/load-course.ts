import {
  CourseSchema,
  type ContentBlock,
  type Course,
  type CourseUnit,
  type SectionNode,
} from './schema';

type UnknownRecord = Record<string, unknown>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const property of Object.values(value as UnknownRecord)) {
      deepFreeze(property);
    }
  }
  return value;
}

function collectSections(section: SectionNode, output: SectionNode[]): void {
  output.push(section);
  for (const child of section.children) collectSections(child, output);
}

function collectBlockIds(blocks: readonly ContentBlock[], ids: string[]): void {
  for (const block of blocks) {
    ids.push(block.id);
    if (block.type === 'callout') collectBlockIds(block.blocks, ids);
    if (block.type === 'knowledgeCheck')
      collectBlockIds(block.answer ?? [], ids);
  }
}

function assertCourseInvariants(course: Course): void {
  const weeks = course.units.filter(
    (unit): unit is Extract<CourseUnit, { kind: 'week' }> =>
      unit.kind === 'week',
  );
  const appendices = course.units.filter((unit) => unit.kind === 'appendix');

  if (weeks.length !== 12 || appendices.length !== 1) {
    throw new Error(
      'A course must contain exactly 12 numbered weeks and Appendix A',
    );
  }
  for (let index = 0; index < 12; index += 1) {
    if (weeks[index]?.weekNumber !== index + 1) {
      throw new Error(
        'The 12 numbered weeks must be sequential from 1 through 12',
      );
    }
  }

  const ids = new Set<string>();
  const aliases = new Set<string>();
  const sections: SectionNode[] = [];
  for (const unit of course.units) collectSections(unit, sections);

  for (const section of sections) {
    if (ids.has(section.id) || aliases.has(section.id))
      throw new Error(`Duplicate stable identifier: ${section.id}`);
    ids.add(section.id);
    for (const alias of section.aliases) {
      if (ids.has(alias) || aliases.has(alias))
        throw new Error(`Duplicate stable alias: ${alias}`);
      aliases.add(alias);
    }
    const blockIds: string[] = [];
    collectBlockIds(section.blocks, blockIds);
    for (const id of blockIds) {
      if (ids.has(id) || aliases.has(id))
        throw new Error(`Duplicate stable identifier: ${id}`);
      ids.add(id);
    }
  }
}

export function loadCourse(data: unknown): Readonly<Course> {
  const course = CourseSchema.parse(data);
  assertCourseInvariants(course);
  return deepFreeze(course);
}

export function flattenSections(unit: SectionNode): readonly SectionNode[] {
  const sections: SectionNode[] = [];
  collectSections(unit, sections);
  return sections;
}

export function findSection(
  course: Pick<Course, 'units'>,
  idOrAlias: string,
): SectionNode | undefined {
  for (const unit of course.units) {
    for (const section of flattenSections(unit)) {
      if (section.id === idOrAlias || section.aliases.includes(idOrAlias))
        return section;
    }
  }
  return undefined;
}
