import { AppShell } from '@/src/components/app/app-shell';
import { CourseOverview } from '@/src/components/course/course-overview';
import { courseMetadata } from '@/src/content/course-metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }) {
  return courseMetadata((await params).locale === 'en' ? 'en' : 'zh', '/');
}

export default function Home() {
  return (
    <AppShell>
      <CourseOverview />
    </AppShell>
  );
}
