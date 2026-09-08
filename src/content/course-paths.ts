import type { CourseUnit } from './schema';

export type CourseLocale = 'zh' | 'en';
export const COURSE_LOCATION_EVENT = 'course-reading-location';

export function localePath(path: string, locale: CourseLocale): string {
  const unprefixed = path.replace(/^\/en(?=\/|#|\?|$)/u, '') || '/';
  if (locale === 'zh') return unprefixed;
  return unprefixed === '/' ? '/en' : `/en${unprefixed}`;
}

export function courseUnitPath(unit: CourseUnit, locale: CourseLocale = 'zh'): string {
  return localePath(
    unit.kind === 'appendix' ? '/appendix/mini-gpt' : `/week/${unit.slug}`,
    locale,
  );
}

export function isCoursePath(path: string): boolean {
  // Fragment-only content links must stay relative to the current lesson.
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  const pathname = path.split(/[?#]/u)[0].replace(/^\/en(?=\/|$)/u, '') || '/';
  return pathname === '/' || pathname === '/review' || pathname === '/appendix/mini-gpt'
    || /^\/week\/[^/]+\/?$/u.test(pathname);
}
