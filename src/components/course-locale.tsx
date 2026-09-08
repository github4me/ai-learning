'use client';

import * as React from 'react';
import type { Course } from '@/src/content/schema';
import type { RuntimeGlossaryEntry } from '@/src/content/glossary';
import { findSection, flattenSections } from '@/src/content/load-course';
import { courseUnitPath, localePath, type CourseLocale } from '@/src/content/course-paths';

export type CourseLocaleContextValue = {
  locale: CourseLocale;
  course: Course;
  glossary: readonly RuntimeGlossaryEntry[];
  untranslatedCount: number;
};

export const CourseLocaleContext = React.createContext<CourseLocaleContextValue | null>(null);

export function useCourseLocale() {
  const context = React.useContext(CourseLocaleContext);
  if (!context) throw new Error('Course components must be inside the course language provider');
  return context;
}

export function useCourseRuntime() {
  const context = useCourseLocale();
  return React.useMemo(() => {
    const { course, locale } = context;
    const getUnit = (id: string) => course.units.find((unit) => unit.id === id);
    const getSection = (id: string) => findSection(course, id);
    const getUnitForSection = (id: string) => course.units.find((unit) =>
      flattenSections(unit).some((section) => section.id === id || section.aliases.includes(id)),
    );
    return {
      ...context,
      getUnit, getSection, getUnitForSection,
      path: (path: string) => localePath(path, locale),
      courseUnitPath: (unit: Parameters<typeof courseUnitPath>[0]) => courseUnitPath(unit, locale),
      courseSectionPath: (id: string) => {
        const unit = getUnitForSection(id);
        const section = getSection(id);
        return unit && section ? `${courseUnitPath(unit, locale)}#${section.id}` : undefined;
      },
      text: (english: string, chinese: string) => locale === 'en' ? english : chinese,
    };
  }, [context]);
}
