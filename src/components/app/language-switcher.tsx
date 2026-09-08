'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { COURSE_LOCATION_EVENT, localePath, type CourseLocale } from '@/src/content/course-paths';
import { useCourseLocale } from '@/src/components/course-locale';
import { useFlushPendingNotes } from '@/src/components/providers';

export function LanguageSwitcher() {
  const { locale } = useCourseLocale();
  const pathname = usePathname();
  const flushNotes = useFlushPendingNotes();
  const [suffix, setSuffix] = React.useState('');
  React.useEffect(() => {
    const update = () => setSuffix(window.location.search + window.location.hash);
    update();
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    window.addEventListener(COURSE_LOCATION_EVENT, update);
    return () => {
      window.removeEventListener('hashchange', update);
      window.removeEventListener('popstate', update);
      window.removeEventListener(COURSE_LOCATION_EVENT, update);
    };
  }, [pathname]);

  function prepareNavigation(event: React.MouseEvent<HTMLAnchorElement>, target: CourseLocale) {
    flushNotes();
    // The reader updates its fragment with replaceState while scrolling, which
    // does not emit hashchange. Resolve the latest position at activation time.
    event.currentTarget.href = localePath(window.location.pathname, target)
      + window.location.search + window.location.hash;
  }

  return (
    <nav className="language-switcher" aria-label="Course language / 课程语言">
      {(['zh', 'en'] as const).map((language) => (
        <a key={language} href={`${localePath(pathname, language)}${suffix}`}
          lang={language === 'zh' ? 'zh-CN' : 'en'}
          hrefLang={language === 'zh' ? 'zh-CN' : 'en'}
          aria-current={locale === language ? 'true' : undefined}
          data-language-switch="true"
          onAuxClick={(event) => prepareNavigation(event, language)}
          onClick={(event) => prepareNavigation(event, language)}>
          {language === 'zh' ? '中文' : 'English'}
        </a>
      ))}
    </nav>
  );
}
