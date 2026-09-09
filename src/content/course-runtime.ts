import courseData from './course.generated.json';
import { applyCuratedContent } from './curated';
import { applyBeginnerReview } from './beginner/apply-beginner-review';
import { applyLegacyCodePromotions } from './legacy-code-promotions';
import { findSection, flattenSections, loadCourse } from './load-course';
import type { Course, CourseUnit, SectionNode } from './schema';
import { courseUnitPath } from './course-paths';
export { courseUnitPath } from './course-paths';

const generatedCourse = loadCourse(courseData);
const course = loadCourse({
  ...applyBeginnerReview(
    applyLegacyCodePromotions(applyCuratedContent(generatedCourse)),
  ),
  title: 'AI Made Simple · 轻松学 AI',
});

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

export function courseSectionPath(
  sectionIdOrAlias: string,
): string | undefined {
  const section = getSection(sectionIdOrAlias);
  const unit = getUnitForSection(sectionIdOrAlias);
  if (!section || !unit) return undefined;
  return `${courseUnitPath(unit)}#${section.id}`;
}
