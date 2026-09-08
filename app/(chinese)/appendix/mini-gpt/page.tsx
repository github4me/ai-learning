import { notFound } from 'next/navigation';

import { LessonReader } from '@/src/components/course/lesson-reader';
import { getCourse } from '@/src/content/course-runtime';
import { courseMetadata } from '@/src/content/course-metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }) {
  return courseMetadata((await params).locale === 'en' ? 'en' : 'zh', '/appendix/mini-gpt', 'mini-gpt-reference');
}

export default function MiniGptAppendixPage() {
  const appendix = getCourse().units.find(
    (unit) => unit.kind === 'appendix' && unit.slug === 'mini-gpt-reference',
  );
  if (!appendix) notFound();

  return <LessonReader unitId={appendix.id} />;
}
