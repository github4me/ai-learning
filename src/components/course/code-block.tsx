'use client';

import * as React from 'react';
import { Check, Clipboard, TriangleAlert } from 'lucide-react';
import { Highlight, Prism, themes } from 'prism-react-renderer';

import type { SourceRef } from '@/src/content/schema';

// Comments carry teaching explanations and need the same readable contrast as code.
const readableCodeTheme = {
  ...themes.oneDark,
  styles: [...themes.oneDark.styles, {
    types: ['comment', 'prolog', 'doctype', 'cdata'],
    style: { color: '#a9b7c6' },
  }],
};

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- The labelled code scroller must be keyboard-focusable. */

export type CodeBlockProps = {
  id: string;
  language: string;
  filename?: string;
  code: string;
  source: SourceRef;
};

export function CodeBlock({
  id,
  language,
  filename,
  code,
}: CodeBlockProps) {
  const [copyState, setCopyState] = React.useState<
    'idle' | 'copied' | 'failed'
  >('idle');
  const normalizedLanguage = language.toLowerCase();
  const highlightedLanguage = Prism.languages[normalizedLanguage]
    ? normalizedLanguage
    : 'plain';
  const codeLabel = filename
    ? `${language} code: ${filename}`
    : `${language} code`;

  async function copyCode() {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <figure className="code-block content-block">
      <figcaption className="code-block-header">
        <span>{filename ?? language}</span>
        <button type="button" className="copy-code-button" onClick={copyCode}>
          {copyState === 'copied' ? (
            <Check aria-hidden="true" />
          ) : copyState === 'failed' ? (
            <TriangleAlert aria-hidden="true" />
          ) : (
            <Clipboard aria-hidden="true" />
          )}
          Copy code
        </button>
      </figcaption>
      <Highlight
        theme={readableCodeTheme}
        code={code}
        language={highlightedLanguage}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => {
          const tokenText = tokens
            .map((line) => line.map((token) => token.content).join(''))
            .join('\n');
          const exactHighlight = tokenText === code;
          return (
            <pre
              id={id}
              className={`${className} code-scroll`}
              style={style}
              tabIndex={0}
              aria-label={codeLabel}
              data-language={language}
            >
              <code>
                {exactHighlight
                  ? tokens.map((line, lineIndex) => (
                      <React.Fragment key={lineIndex}>
                        <span {...getLineProps({ line })}>
                          {line.map((token, tokenIndex) => (
                            <span
                              key={tokenIndex}
                              {...getTokenProps({ token })}
                            />
                          ))}
                        </span>
                        {lineIndex < tokens.length - 1 ? '\n' : null}
                      </React.Fragment>
                    ))
                  : code}
              </code>
            </pre>
          );
        }}
      </Highlight>
      <p className="copy-status" aria-live="polite" aria-atomic="true">
        {copyState === 'copied'
          ? 'Copied'
          : copyState === 'failed'
            ? 'Copy failed. Select and copy the code manually.'
            : ''}
      </p>
    </figure>
  );
}
