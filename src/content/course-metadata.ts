import type { Metadata } from 'next';
import { getLocalizedCourse } from './english/localize-course';
import { localePath, type CourseLocale } from './course-paths';

const publicOrigin = 'https://ai-learning-geadc0g3f5c9h3ek.australiasoutheast-01.azurewebsites.net';

export function courseMetadata(locale: CourseLocale, path: string, slug?: string): Metadata {
  const { course } = getLocalizedCourse(locale);
  const unit = slug ? course.units.find((candidate) => candidate.slug === slug) : undefined;
  const review = path === '/review';
  const title = unit?.title ?? (review
    ? (locale === 'en' ? 'Review notes and bookmarks' : '笔记与书签复习')
    : (locale === 'en' ? 'A 12-week course from first principles to Mini GPT' : '12 周 AI 第一性原理课程'));
  const description = (unit?.kind === 'week' ? unit.keyQuestion : undefined) ?? (locale === 'en'
    ? 'Learn AI through clear explanations, worked numerical examples and runnable Python: from gradients to attention, Transformers and Mini GPT.'
    : '通过通俗讲解、具体数值和可运行 Python，理解梯度、Attention、Transformer，最终实现教学版 Mini GPT。');
  const url = new URL(localePath(path, locale), publicOrigin).href;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        'zh-CN': new URL(localePath(path, 'zh'), publicOrigin).href,
        en: new URL(localePath(path, 'en'), publicOrigin).href,
        'x-default': new URL(localePath(path, 'zh'), publicOrigin).href,
      },
    },
    openGraph: { title, description, url, siteName: 'AI Made Simple', type: 'website', locale: locale === 'en' ? 'en_US' : 'zh_CN', alternateLocale: locale === 'en' ? 'zh_CN' : 'en_US' },
    ...(review ? { robots: { index: false, follow: true } } : {}),
  };
}
