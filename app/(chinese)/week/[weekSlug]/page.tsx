import { notFound } from 'next/navigation';

import { LessonReader } from '@/src/components/course/lesson-reader';
import { getCourse } from '@/src/content/course-runtime';
import { courseMetadata } from '@/src/content/course-metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale?: string; weekSlug: string }> }) {
  const { locale, weekSlug } = await params;
  if (!getCourse().units.some((unit) => unit.kind === 'week' && unit.slug === weekSlug)) notFound();
  return courseMetadata(locale === 'en' ? 'en' : 'zh', `/week/${weekSlug}`, weekSlug);
}

export function generateStaticParams() {
  return getCourse()
    .units.filter((unit) => unit.kind === 'week')
    .map((unit) => ({ weekSlug: unit.slug }));
}

export default async function WeekPage({
  params,
}: {
  params: Promise<{ weekSlug: string }>;
}) {
  const { weekSlug } = await params;
  const unit = getCourse().units.find(
    (candidate) => candidate.kind === 'week' && candidate.slug === weekSlug,
  );
  if (!unit) notFound();

  return <LessonReader unitId={unit.id} />;
}
