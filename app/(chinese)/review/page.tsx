import { AppShell } from '@/src/components/app/app-shell';
import { ReviewWorkspace } from '@/src/components/learning/review-workspace';
import { courseMetadata } from '@/src/content/course-metadata';

export async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }) {
  return courseMetadata((await params).locale === 'en' ? 'en' : 'zh', '/review');
}

export default function ReviewPage() {
  return (
    <AppShell currentContextLabel="Review">
      <ReviewWorkspace />
    </AppShell>
  );
}
