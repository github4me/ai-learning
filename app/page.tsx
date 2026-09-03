import { AppShell } from '@/src/components/app/app-shell';
import { CourseOverview } from '@/src/components/course/course-overview';

export default function Home() {
  return (
    <AppShell>
      <CourseOverview />
    </AppShell>
  );
}
