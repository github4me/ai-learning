import type { ContentBlock, InlineNode, SourceRef } from '../schema';
import type { CuratedBodyBlock, TeachingSectionRevision } from './types';

type BlockIdFactory = (role: string) => string;

function text(value: string): InlineNode[] {
  return [{ type: 'text', value }];
}

function createBlockIdFactory(weekSlug: string, sectionId: string): BlockIdFactory {
  const weekNumber = weekSlug.match(/^week-(\d+)$/u)?.[1]?.padStart(2, '0');
  if (!weekNumber) throw new Error(`Invalid curated week slug: ${weekSlug}`);
  let sequence = 0;
  return (role) => {
    sequence += 1;
    return `curated-w${weekNumber}-${sectionId}-${role}-${sequence}`;
  };
}

function materializeBodyBlock(
  block: CuratedBodyBlock,
  source: SourceRef,
  nextId: BlockIdFactory,
  role: string,
): ContentBlock {
  const id = nextId(role);
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', id, source, children: text(block.text) };
    case 'list':
      return {
        type: 'list',
        id,
        source,
        ordered: block.ordered ?? false,
        items: block.items.map(text),
      };
    case 'formula':
      return {
        type: 'formula',
        id,
        source,
        latex: block.latex,
        accessibleText: block.accessibleText,
      };
    case 'code':
      return {
        type: 'code',
        id,
        source,
        language: block.language,
        ...(block.filename ? { filename: block.filename } : {}),
        code: block.code,
      };
    case 'table':
      return {
        type: 'table',
        id,
        source,
        ...(block.caption ? { caption: block.caption } : {}),
        headers: block.headers.map(text),
        rows: block.rows.map((row) => row.map(text)),
      };
    case 'conceptChain':
      return { type: 'conceptChain', id, source, steps: block.steps };
    case 'callout':
      return {
        type: 'callout',
        id,
        source,
        tone: block.tone,
        title: block.title,
        blocks: block.blocks.map((nested, index) =>
          materializeBodyBlock(
            nested,
            source,
            nextId,
            `${role}-${nested.type}-${index + 1}`,
          ),
        ),
      };
  }
}

export function materializeTeachingSection(
  weekSlug: string,
  revision: TeachingSectionRevision,
  source: SourceRef,
): ContentBlock[] {
  if (revision.blocks.length === 0)
    throw new Error(
      `Curated section ${revision.sectionId} must include worked content`,
    );
  const nextId = createBlockIdFactory(weekSlug, revision.sectionId);
  return [
    {
      type: 'callout',
      id: nextId('problem'),
      source,
      tone: 'concept',
      title: '先看问题',
      blocks: [
        {
          type: 'paragraph',
          id: nextId('problem-paragraph'),
          source,
          children: text(revision.problem),
        },
      ],
    },
    {
      type: 'callout',
      id: nextId('purpose'),
      source,
      tone: 'principle',
      title: '为什么需要它',
      blocks: [
        {
          type: 'list',
          id: nextId('purpose-list'),
          source,
          ordered: false,
          items: revision.purpose.map(text),
        },
      ],
    },
    ...revision.blocks.map((block, index) =>
      materializeBodyBlock(block, source, nextId, `worked-${index + 1}`),
    ),
    {
      type: 'callout',
      id: nextId('pitfalls'),
      source,
      tone: 'example',
      title: '常见误区',
      blocks: [
        {
          type: 'list',
          id: nextId('pitfalls-list'),
          source,
          ordered: false,
          items: revision.pitfalls.map(text),
        },
      ],
    },
    {
      type: 'knowledgeCheck',
      id: nextId('knowledge-check'),
      source,
      prompt: text(revision.check.prompt),
      answer: revision.check.answer.map((block, index) =>
        materializeBodyBlock(block, source, nextId, `answer-${index + 1}`),
      ),
      reviewSectionId: revision.sectionId,
    },
  ];
}
