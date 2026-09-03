import katex from 'katex';

import type { SourceRef } from '@/src/content/schema';
import { SourcePageLink } from './source-page-link';

export type FormulaBlockProps = {
  id: string;
  latex: string;
  accessibleText: string;
  source: SourceRef;
};

export function FormulaBlock({
  id,
  latex,
  accessibleText,
  source,
}: FormulaBlockProps) {
  let rendered: string | undefined;

  try {
    rendered = katex.renderToString(latex, {
      displayMode: true,
      throwOnError: true,
      output: 'htmlAndMathml',
    });
  } catch {
    rendered = undefined;
  }

  return (
    <figure
      id={id}
      className="formula-block content-block"
      aria-label={`Formula: ${accessibleText}`}
    >
      {rendered ? (
        <div
          className="formula-scroll"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      ) : (
        <div className="formula-fallback">
          <span>Formula:</span>{' '}
          <math aria-label={accessibleText}>
            <mtext>{accessibleText}</mtext>
          </math>
        </div>
      )}
      <SourcePageLink source={source} label="Formula source" />
    </figure>
  );
}
