import katex from 'katex';
import { memo, type ReactNode } from 'react';

import { courseSectionPath } from '@/src/content/course-runtime';
import {
  isSafeContentHref,
  type ContentBlock,
  type InlineNode,
} from '@/src/content/schema';
import { CodeBlock } from './code-block';
import { DataTable } from './data-table';
import { FormulaBlock } from './formula-block';
import { SourcePageLink } from './source-page-link';

function assertNever(value: never): never {
  throw new Error(`Unsupported course content: ${JSON.stringify(value)}`);
}

function renderInlineMath(value: string): string | undefined {
  try {
    return katex.renderToString(value, {
      displayMode: false,
      throwOnError: true,
      output: 'htmlAndMathml',
    });
  } catch {
    return undefined;
  }
}

function InlineMath({ value }: { value: string }) {
  const html = renderInlineMath(value);
  if (html) {
    return (
      <span
        className="inline-math"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <math className="inline-math-fallback" aria-label={value}>
      <mtext>{value}</mtext>
    </math>
  );
}

export function renderInline(nodes: InlineNode[]): ReactNode {
  return nodes.map((node, index) => {
    switch (node.type) {
      case 'text':
        return <span key={index}>{node.value}</span>;
      case 'strong':
        return <strong key={index}>{renderInline(node.children)}</strong>;
      case 'emphasis':
        return <em key={index}>{renderInline(node.children)}</em>;
      case 'inlineCode':
        return <code key={index}>{node.value}</code>;
      case 'inlineMath':
        return <InlineMath key={index} value={node.value} />;
      case 'link': {
        const children = renderInline(node.children);
        if (!isSafeContentHref(node.href)) {
          return <span key={index}>{children}</span>;
        }
        const href = node.href.trim();
        let external = false;
        try {
          const url = new URL(href);
          external = url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
          external = false;
        }
        return (
          <a
            key={index}
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
          >
            {children}
          </a>
        );
      }
      default:
        return assertNever(node);
    }
  });
}

function renderBlock(block: ContentBlock): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return (
        <div key={block.id} className="content-block content-paragraph">
          <p id={block.id}>{renderInline(block.children)}</p>
          <SourcePageLink source={block.source} />
        </div>
      );
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <div key={block.id} className="content-block content-list">
          <List id={block.id}>
            {block.items.map((item, index) => (
              <li key={index}>{renderInline(item)}</li>
            ))}
          </List>
          <SourcePageLink source={block.source} />
        </div>
      );
    }
    case 'formula':
      return <FormulaBlock key={block.id} {...block} />;
    case 'code':
      return <CodeBlock key={block.id} {...block} />;
    case 'table':
      return (
        <DataTable key={block.id} {...block} renderInline={renderInline} />
      );
    case 'callout': {
      const labels = {
        concept: 'Concept',
        principle: 'Key principle',
        example: 'Example',
      } as const;
      const labelId = `${block.id}-label`;
      return (
        <aside
          key={block.id}
          id={block.id}
          className={`content-block callout callout-${block.tone}`}
          aria-labelledby={labelId}
        >
          <p id={labelId} className="callout-label">
            {block.title ?? labels[block.tone]}
          </p>
          <ContentRenderer blocks={block.blocks} />
          <SourcePageLink source={block.source} label="Callout source" />
        </aside>
      );
    }
    case 'conceptChain':
      return (
        <figure
          key={block.id}
          id={block.id}
          className="content-block concept-chain"
        >
          <figcaption className="sr-only">Concept sequence</figcaption>
          <ol>
            {block.steps.map((step, index) => (
              <li key={index}>
                <span>{step}</span>
                {index < block.steps.length - 1 && (
                  <span className="chain-connector" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <SourcePageLink source={block.source} label="Concept chain source" />
        </figure>
      );
    case 'knowledgeCheck': {
      const labelId = `${block.id}-label`;
      const reviewPath = courseSectionPath(block.reviewSectionId);
      return (
        <section
          key={block.id}
          id={block.id}
          className="content-block knowledge-check"
          aria-labelledby={labelId}
        >
          <p className="knowledge-check-kicker">Knowledge check</p>
          <p id={labelId} className="knowledge-check-prompt">
            {renderInline(block.prompt)}
          </p>
          {block.answer ? (
            <details>
              <summary>Reveal source-grounded answer</summary>
              <div className="knowledge-check-answer">
                <ContentRenderer blocks={block.answer} />
              </div>
            </details>
          ) : reviewPath ? (
            <a href={reviewPath}>Review the relevant lesson</a>
          ) : (
            <span>Review the relevant lesson</span>
          )}
          <SourcePageLink
            source={block.source}
            label="Knowledge check source"
          />
        </section>
      );
    }
    default:
      return assertNever(block);
  }
}

export const ContentRenderer = memo(function ContentRenderer({
  blocks,
}: {
  blocks: ContentBlock[];
}) {
  return <>{blocks.map(renderBlock)}</>;
});
