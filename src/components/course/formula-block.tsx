import katex from 'katex';

import type { SourceRef } from '@/src/content/schema';
import { SourcePageLink } from './source-page-link';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- KaTeX HTML+MathML needs one labelled ARIA math wrapper. */
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The labelled formula scroller must be keyboard-focusable. */

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
    <figure id={id} className="formula-block content-block">
      <div className="formula-math" role="math" aria-label={accessibleText}>
        <div
          className="formula-scroll"
          role="region"
          aria-label="Scrollable formula"
          tabIndex={0}
        >
          {rendered ? (
            <div dangerouslySetInnerHTML={{ __html: rendered }} />
          ) : (
            <div className="formula-fallback">
              <span aria-hidden="true">Formula:</span>{' '}
              <code>{accessibleText}</code>
            </div>
          )}
        </div>
      </div>
      <SourcePageLink source={source} label="Formula source" />
    </figure>
  );
}
