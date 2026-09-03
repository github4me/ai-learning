import courseData from './course.generated.json';
import { findSection, flattenSections, loadCourse } from './load-course';
import type { Course, CourseUnit, SectionNode } from './schema';

const course = loadCourse(courseData);

export function getCourse(): Course {
  return course;
}

export function getUnit(unitId: string): CourseUnit | undefined {
  return course.units.find((unit) => unit.id === unitId);
}

export function getUnitForSection(
  sectionIdOrAlias: string,
): CourseUnit | undefined {
  return course.units.find((unit) =>
    flattenSections(unit).some(
      (section) =>
        section.id === sectionIdOrAlias ||
        section.aliases.includes(sectionIdOrAlias),
    ),
  );
}

export function getSection(sectionIdOrAlias: string): SectionNode | undefined {
  return findSection(course, sectionIdOrAlias);
}

export function courseUnitPath(unit: CourseUnit): string {
  return unit.kind === 'appendix' ? '/appendix/mini-gpt' : `/week/${unit.slug}`;
}

export function courseSectionPath(
  sectionIdOrAlias: string,
): string | undefined {
  const section = getSection(sectionIdOrAlias);
  const unit = getUnitForSection(sectionIdOrAlias);
  if (!section || !unit) return undefined;
  return `${courseUnitPath(unit)}#${section.id}`;
}
