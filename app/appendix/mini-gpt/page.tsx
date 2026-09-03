import { notFound } from 'next/navigation';

import { LessonReader } from '@/src/components/course/lesson-reader';
import { Providers } from '@/src/components/providers';
import { getCourse } from '@/src/content/course-runtime';

export default function MiniGptAppendixPage() {
  const appendix = getCourse().units.find(
    (unit) => unit.kind === 'appendix' && unit.slug === 'mini-gpt-reference',
  );
  if (!appendix) notFound();

  return (
    <Providers>
      <LessonReader unitId={appendix.id} />
    </Providers>
  );
}
