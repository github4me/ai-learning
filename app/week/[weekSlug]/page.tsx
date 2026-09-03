import { notFound } from 'next/navigation';

import { Providers } from '@/src/components/providers';
import { LessonReader } from '@/src/components/course/lesson-reader';
import { getCourse } from '@/src/content/course-runtime';

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

  return (
    <Providers>
      <LessonReader unitId={unit.id} />
    </Providers>
  );
}
