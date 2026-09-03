import MiniSearch from 'minisearch';

import { flattenSections } from '@/src/content/load-course';
import type { ContentBlock, Course, InlineNode } from '@/src/content/schema';

const HYPHENS = /[‐‑‒–−]/g;
export type SearchResult = {
  sectionId: string;
  unitId: string;
  unitTitle: string;
  weekNumber?: number;
  anchor: string;
  title: string;
  excerpt: string;
  group: { unitId: string; title: string };
};
type SearchDocument = Omit<SearchResult, 'excerpt'> & {
  id: string;
  text: string;
  order: number;
  isUnitRoot: boolean;
};
export type CourseSearchIndex = {
  miniSearch: MiniSearch<SearchDocument>;
  documents: SearchDocument[];
  segmenter: boolean;
};

export type SearchGlossaryEntry = {
  term: string;
  definition: string;
  sectionId: string;
  aliases?: readonly string[];
  unitId?: string;
  route?: string;
};

function normalize(value: string): string {
  return value.normalize('NFKC').replace(HYPHENS, '-').toLowerCase();
}
function tokens(value: string, useSegmenter: boolean): string[] {
  const normalized = normalize(value);
  const base = normalized
    .split(/[^\p{L}\p{N}\u3400-\u9fff\uf900-\ufaff-]+/u)
    .filter(Boolean);
  const output = new Set(
    base.flatMap((term) => [term, term.replaceAll('-', '')]),
  );
  const cjkRuns = normalized.match(/[\u3400-\u9fff\uf900-\ufaff]+/gu) ?? [];
  if (useSegmenter && typeof Intl.Segmenter !== 'undefined') {
    const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
    for (const run of cjkRuns)
      for (const part of segmenter.segment(run))
        if (part.isWordLike) output.add(part.segment);
  }
  for (const run of cjkRuns) {
    const points = Array.from(run);
    output.add(run);
    if (!useSegmenter)
      for (let index = 0; index < points.length - 1; index += 1)
        output.add(points.slice(index, index + 2).join(''));
  }
  return [...output];
}
function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((node) => {
      if ('children' in node) return inlineText(node.children);
      return node.type === 'inlineMath' ? node.accessibleText : node.value;
    })
    .join('');
}
function blockText(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items.map(inlineText).join('\n');
    case 'formula':
      return block.accessibleText;
    case 'code':
      return `${block.filename ?? ''}\n${block.language}\n${block.code}`;
    case 'table':
      return [block.caption ?? '', ...block.headers, ...block.rows.flat()]
        .map((row) => (Array.isArray(row) ? inlineText(row) : row))
        .join('\n');
    case 'callout':
      return `${block.title ?? ''}\n${block.blocks.map(blockText).join('\n')}`;
    case 'conceptChain':
      return block.steps.join(' → ');
    case 'knowledgeCheck':
      return `${inlineText(block.prompt)}\n${(block.answer ?? []).map(blockText).join('\n')}`;
  }
}
function plainExcerpt(text: string, query: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const normalized = normalize(clean);
  const needle =
    tokens(query, false).find((token) => token.length > 1) ?? normalize(query);
  const at = Math.max(0, normalized.indexOf(needle));
  const start = Math.max(0, at - 40);
  const points = Array.from(clean)
    .slice(start, start + 140)
    .join('');
  return points.slice(0, 140);
}

export function createCourseSearch(
  course: Course,
  options: {
    segmenter?: boolean;
    glossary?: readonly SearchGlossaryEntry[];
  } = {},
): CourseSearchIndex {
  const useSegmenter =
    options.segmenter !== false && typeof Intl.Segmenter !== 'undefined';
  const documents: SearchDocument[] = [];
  const glossaryEntries: readonly SearchGlossaryEntry[] = [
    ...(course.glossary ?? []),
    ...(options.glossary ?? []),
  ];
  let order = 0;
  // The bespoke overview does not render the generated overview section tree,
  // so only routable lesson and appendix units become selectable results.
  const roots = course.units;
  for (const root of roots) {
    const unit = root as typeof root & {
      kind?: 'week' | 'appendix';
      weekNumber?: number;
    };
    for (const section of flattenSections(root).filter(
      (item) => item.showInToc,
    )) {
      const glossary = glossaryEntries
        .filter(
          (entry) =>
            entry.sectionId === section.id &&
            (entry.unitId === undefined || entry.unitId === root.id),
        )
        .flatMap((entry) => [
          entry.term,
          entry.definition,
          ...(entry.aliases ?? []),
          ...(entry.route ? [entry.route] : []),
        ])
        .join('\n');
      const rawText = [
        section.title,
        root.title,
        ...section.blocks.map(blockText),
        glossary,
      ]
        .filter(Boolean)
        .join('\n');
      const result: SearchDocument = {
        id: section.id,
        sectionId: section.id,
        unitId: root.id,
        unitTitle: root.title,
        weekNumber: unit.kind === 'week' ? unit.weekNumber : undefined,
        anchor: `#${section.id}`,
        title: section.title,
        text: rawText,
        order: order++,
        isUnitRoot: section.id === root.id,
        group: { unitId: root.id, title: root.title },
      };
      documents.push(result);
    }
  }
  const miniSearch = new MiniSearch<SearchDocument>({
    fields: ['title', 'unitTitle', 'text'],
    storeFields: [
      'sectionId',
      'unitId',
      'unitTitle',
      'weekNumber',
      'anchor',
      'title',
      'text',
      'order',
      'isUnitRoot',
      'group',
    ],
    tokenize: (value) => tokens(value, useSegmenter),
  });
  miniSearch.addAll(documents);
  return { miniSearch, documents, segmenter: useSegmenter };
}

export function searchCourse(
  index: CourseSearchIndex,
  query: string,
): SearchResult[] {
  if (!query.trim()) return [];
  const normalized = normalize(query);
  const compactQuery = normalized.replaceAll('-', '');
  const matches = index.miniSearch.search(normalized, {
    prefix: true,
    fuzzy: 0.2,
    boost: { title: 4, unitTitle: 6, text: 1 },
  }) as unknown as Array<SearchDocument & { score: number }>;
  return matches
    .sort((left, right) => {
      const rootTitleBoost = (document: SearchDocument) =>
        document.isUnitRoot &&
        normalize(document.title).replaceAll('-', '').includes(compactQuery)
          ? 20
          : 0;
      return (
        right.score +
          rootTitleBoost(right) -
          (left.score + rootTitleBoost(left)) ||
        left.order - right.order ||
        left.sectionId.localeCompare(right.sectionId)
      );
    })
    .slice(0, 30)
    .map(({ text, ...result }) => ({
      ...result,
      excerpt: plainExcerpt(text, normalized),
    }));
}

export function suggestCourse(
  index: CourseSearchIndex,
  query: string,
): string[] {
  if (!query.trim()) return [];
  return index.miniSearch
    .autoSuggest(normalize(query), { prefix: true, fuzzy: 0.3 })
    .slice(0, 5)
    .map(({ suggestion }) => suggestion);
}
