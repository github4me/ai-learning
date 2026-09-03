import { ExternalLink } from 'lucide-react';

import { sourcePageHref } from '@/src/content/course-runtime';
import type { SourceRef } from '@/src/content/schema';

export function SourcePageLink({
  source,
  label = 'Source page',
}: {
  source: SourceRef;
  label?: string;
}) {
  const pageLabel = source.printedPageLabel
    ? `PDF page ${source.pdfPage} (printed page ${source.printedPageLabel})`
    : `PDF page ${source.pdfPage}`;

  return (
    <a
      className="block-source-link"
      href={sourcePageHref(source.pdfPage)}
      target="_blank"
      rel="noreferrer"
      aria-label={`${label}: ${pageLabel}`}
    >
      <ExternalLink aria-hidden="true" />
      <span>{pageLabel}</span>
    </a>
  );
}
