import { AppShell } from '@/src/components/app/app-shell';
import { ReviewWorkspace } from '@/src/components/learning/review-workspace';

export default function ReviewPage() {
  return (
    <AppShell currentContextLabel="Review">
      <ReviewWorkspace />
    </AppShell>
  );
}
