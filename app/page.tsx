import { AppShell } from '@/src/components/app/app-shell';
import { Providers } from '@/src/components/providers';
import { CourseOverview } from '@/src/components/course/course-overview';

export default function Home() {
  return (
    <Providers>
      <AppShell>
        <CourseOverview />
      </AppShell>
    </Providers>
  );
}
