import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CourseDocument, { metadata as sharedMetadata } from '@/src/components/app/course-document';

export const metadata: Metadata = {
  ...sharedMetadata,
  title: { default: 'AI Made Simple · A 12-week course', template: '%s · AI Made Simple' },
  description: 'Understand AI from numerical examples and working code: from linear regression and gradients to attention, Transformers and a small GPT.',
};

export default async function EnglishLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  if ((await params).locale !== 'en') notFound();
  return <CourseDocument locale="en">{children}</CourseDocument>;
}
