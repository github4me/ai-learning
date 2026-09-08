import type { Metadata } from 'next';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource-variable/noto-sans-sc/wght.css';
import 'katex/dist/katex.min.css';
import '@/app/globals.css';
import { Providers } from '@/src/components/providers';
import { COURSE_CONTENT_VERSION } from '@/src/content/content-version';
import { getLocalizedCourse } from '@/src/content/english/localize-course';

export const metadata: Metadata = {
  applicationName: 'AI First Principles / AI 第一性原理',
  title: {
    default: 'AI First Principles · 12周 AI 第一性原理学习教程',
    template: '%s · AI First Principles',
  },
  description:
    '12周双语 AI 第一性原理学习教程：从 Linear Regression、数据、参数与梯度到可运行的 Mini GPT。',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

const preferenceBootstrap = `
(() => {
  const storageKey = 'ai-first-principles:learning-state';
  const contentVersion = '${COURSE_CONTENT_VERSION}';
  const fallback = { theme: 'system', fontSize: 'default', lineWidth: 'default', focusMode: false };
  let preferences = fallback;
  try {
    const serialized = window.localStorage.getItem(storageKey);
    if (serialized) {
      const envelope = JSON.parse(serialized);
      if (
        envelope &&
        typeof envelope === 'object' &&
        typeof envelope.contentVersion === 'string' &&
        envelope.contentVersion !== contentVersion
      ) {
        window.localStorage.removeItem(storageKey);
      } else {
        const candidate = envelope && envelope.contentVersion === contentVersion
          && (envelope.schemaVersion === 0 || envelope.schemaVersion === 1)
          ? envelope.preferences
          : undefined;
        if (candidate && typeof candidate === 'object') {
          preferences = {
            theme: ['light', 'dark', 'system'].includes(candidate.theme) ? candidate.theme : fallback.theme,
            fontSize: ['compact', 'default', 'large'].includes(candidate.fontSize) ? candidate.fontSize : fallback.fontSize,
            lineWidth: ['narrow', 'default', 'wide'].includes(candidate.lineWidth) ? candidate.lineWidth : fallback.lineWidth,
            focusMode: typeof candidate.focusMode === 'boolean' ? candidate.focusMode : fallback.focusMode,
          };
        }
      }
    }
  } catch {}
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.dataset.fontSize = preferences.fontSize;
  root.dataset.lineWidth = preferences.lineWidth;
  root.dataset.focusMode = String(preferences.focusMode);
})();`;

export default function CourseDocument({
  children,
  locale,
}: Readonly<{
  children: React.ReactNode;
  locale: 'zh' | 'en';
}>) {
  const localized = getLocalizedCourse(locale);
  return (
    <html lang={localized.locale === 'en' ? 'en' : 'zh-CN'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceBootstrap }} />
      </head>
      <body>
        <Providers {...localized}>{children}</Providers>
      </body>
    </html>
  );
}
