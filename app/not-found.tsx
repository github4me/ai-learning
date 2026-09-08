'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */
import { usePathname } from 'next/navigation';
import { localePath } from '@/src/content/course-paths';

export default function NotFound() {
  const pathname = usePathname();
  const locale = /^\/en(?:\/|$)/.test(pathname) ? 'en' : 'zh';
  return (
    <main id="lesson-content" className="not-found-page">
      <p className="eyebrow">Route not found</p>
      <h1>This lesson is not in the course</h1>
      <p>
        The address may contain an old week slug or section anchor. Return to
        the course map, or start from the nearest valid week.
      </p>
      <div className="not-found-actions">
        <a className="primary-action" href={localePath('/', locale)}>
          Course overview
        </a>
        <a href={localePath('/week/week-01', locale)}>Open Week 1</a>
        <a href={locale === 'en' ? '/' : '/en'} lang={locale === 'en' ? 'zh-CN' : 'en'}>
          {locale === 'en' ? '中文版课程' : 'English course'}
        </a>
      </div>
    </main>
  );
}
