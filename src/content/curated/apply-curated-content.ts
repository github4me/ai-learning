import { COURSE_CONTENT_VERSION } from '../content-version';
import type { ContentBlock, Course, SectionNode, WeekUnit } from '../schema';
import { materializeTeachingSection } from './builders';
import { CURATED_WEEK_REVISIONS } from './index';
import type { CuratedWeekRevision } from './types';

function collectDescendantAnchors(section: SectionNode): string[] {
  const anchors: string[] = [];
  for (const child of section.children) {
    anchors.push(
      child.id,
      ...child.aliases,
      ...collectDescendantAnchors(child),
    );
  }
  return anchors;
}

function collectBlockIds(
  blocks: readonly ContentBlock[],
  output: string[],
): void {
  for (const block of blocks) {
    output.push(block.id);
    if (block.type === 'callout') collectBlockIds(block.blocks, output);
    if (block.type === 'knowledgeCheck')
      collectBlockIds(block.answer ?? [], output);
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function applyWeekRevision(
  week: WeekUnit,
  revision: CuratedWeekRevision,
): WeekUnit {
  const revisionsBySectionId = new Map(
    revision.sections.map((section) => [section.sectionId, section]),
  );
  if (revisionsBySectionId.size !== revision.sections.length)
    throw new Error(
      `Duplicate curated section revision in ${revision.weekSlug}`,
    );

  const directSectionIds = week.children.map((section) => section.id);
  const missing = directSectionIds.filter(
    (id) => !revisionsBySectionId.has(id),
  );
  const extra = revision.sections
    .map((section) => section.sectionId)
    .filter((id) => !directSectionIds.includes(id));
  if (missing.length || extra.length)
    throw new Error(
      `Curated sections for ${revision.weekSlug} must exactly match direct sections; missing=${missing.join(',')}; extra=${extra.join(',')}`,
    );

  const curatedBlockIds: string[] = [];
  const children = week.children.map((section) => {
    const sectionRevision = revisionsBySectionId.get(section.id)!;
    const blocks = materializeTeachingSection(
      revision.weekSlug,
      sectionRevision,
      section.source,
    );
    collectBlockIds(blocks, curatedBlockIds);
    const aliases = sectionRevision.collapseChildren
      ? unique([...section.aliases, ...collectDescendantAnchors(section)])
      : section.aliases;
    return {
      ...section,
      ...(sectionRevision.title ? { title: sectionRevision.title } : {}),
      aliases,
      blocks,
      children: sectionRevision.collapseChildren ? [] : section.children,
    };
  });
  if (new Set(curatedBlockIds).size !== curatedBlockIds.length)
    throw new Error(`Duplicate curated block ID in ${revision.weekSlug}`);

  return {
    ...week,
    title: revision.title,
    keyQuestion: revision.keyQuestion,
    objectives: revision.objectives,
    estimatedReadingMinutes: revision.estimatedReadingMinutes,
    children,
  };
}

export function applyCuratedContent(course: Readonly<Course>): Course {
  return applyCuratedContentWithRevisions(course, CURATED_WEEK_REVISIONS);
}

function applyCuratedContentWithRevisions(
  course: Readonly<Course>,
  revisions: readonly CuratedWeekRevision[],
): Course {
  const revisionsByWeekSlug = new Map<string, CuratedWeekRevision>(
    revisions.map((revision) => [revision.weekSlug, revision]),
  );
  if (revisionsByWeekSlug.size !== revisions.length)
    throw new Error('Duplicate curated week revision slug');

  const units = course.units.map((unit) => {
    if (unit.kind !== 'week') return unit;
    const revision = revisionsByWeekSlug.get(unit.slug);
    return revision ? applyWeekRevision(unit, revision) : unit;
  });
  const knownWeekSlugs = new Set(
    course.units
      .filter((unit): unit is WeekUnit => unit.kind === 'week')
      .map((unit) => unit.slug),
  );
  const missingWeeks = revisions.filter(
    (revision) => !knownWeekSlugs.has(revision.weekSlug),
  );
  if (missingWeeks.length)
    throw new Error(
      `Curated revision targets missing week(s): ${missingWeeks.map((revision) => revision.weekSlug).join(',')}`,
    );

  return { ...course, version: COURSE_CONTENT_VERSION, units };
}
