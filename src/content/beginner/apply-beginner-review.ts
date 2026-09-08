import type { ContentBlock, Course, SectionNode } from '../schema';
import { materializeBodyBlocks } from '../curated/builders';
import type { CuratedBodyBlock } from '../curated/types';
import reviewData from './review-data.json';
import { FOUNDATION_REVISIONS } from './foundation-revisions';
import { LANGUAGE_ROADMAPS } from './language-roadmaps';
import { arrangeLearningUnits } from './learning-order';

export type SectionReview = {
  sectionId: string;
  rationale: string;
  title?: string;
  body?: CuratedBodyBlock[];
  collapseChildren?: boolean;
  replacements?: { from: string; to: string }[];
  blockOverrides?: { blockId: string; block: CuratedBodyBlock }[];
  before?: CuratedBodyBlock[];
  after?: CuratedBodyBlock[];
  check?: { prompt: string; answer: CuratedBodyBlock[] };
  resources?: { label: string; href: string }[];
};

// A rewritten body replaces the earlier editorial additions as well as the old
// text. Other sections keep their reviewed corrections and stable anchors.
const reviews = new Map(
  (reviewData as SectionReview[]).map((review) => [review.sectionId, review]),
);
for (const revision of [...FOUNDATION_REVISIONS, ...LANGUAGE_ROADMAPS]) {
  reviews.set(
    revision.sectionId,
    revision.body
      ? revision
      : { ...reviews.get(revision.sectionId), ...revision },
  );
}
export const BEGINNER_SECTION_REVIEWS = [...reviews.values()];

function replaceStrings<T>(value: T, from: string, to: string): [T, number] {
  let matches = 0;
  const visit = (item: unknown): unknown => {
    if (typeof item === 'string') {
      matches += item.split(from).length - 1;
      return item.replaceAll(from, to);
    }
    if (Array.isArray(item)) return item.map(visit);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item).map(([key, field]) => [key, visit(field)]),
      );
    return item;
  };
  return [visit(value) as T, matches];
}

export function applyBeginnerReview(course: Readonly<Course>): Course {
  const byId = new Map(
    BEGINNER_SECTION_REVIEWS.map((review) => [review.sectionId, review]),
  );
  if (byId.size !== BEGINNER_SECTION_REVIEWS.length)
    throw new Error('Duplicate beginner review section');
  const applied = new Set<string>();
  function visit(section: SectionNode): SectionNode {
    let result = { ...section, children: section.children.map(visit) };
    const review = byId.get(section.id);
    if (!review) return result;
    applied.add(section.id);
    if (review.title) result.title = review.title;
    if (review.body) {
      result.blocks = materializeBodyBlocks(
        review.body,
        section.source,
        `clarity-${section.id}`,
      );
      if (review.collapseChildren) {
        const anchors = (node: SectionNode): string[] => [
          node.id,
          ...node.aliases,
          ...node.children.flatMap(anchors),
        ];
        result.aliases = [
          ...new Set([...result.aliases, ...result.children.flatMap(anchors)]),
        ];
        result.children = [];
      }
    }
    for (const replacement of review.replacements ?? []) {
      const [blocks, matches] = replaceStrings(
        result.blocks,
        replacement.from,
        replacement.to,
      );
      if (!matches)
        throw new Error(
          `Stale beginner correction: ${section.id}: ${replacement.from}`,
        );
      result = { ...result, blocks };
    }
    for (const override of review.blockOverrides ?? []) {
      let matches = 0;
      const replaceBlock = (block: ContentBlock): ContentBlock => {
        if (block.id === override.blockId) {
          matches += 1;
          const replacement = materializeBodyBlocks(
            [override.block],
            block.source,
            `beginner-${block.id}`,
          )[0];
          return { ...replacement, id: block.id };
        }
        if (block.type === 'callout')
          return { ...block, blocks: block.blocks.map(replaceBlock) };
        return block;
      };
      result = { ...result, blocks: result.blocks.map(replaceBlock) };
      if (matches !== 1)
        throw new Error(`Stale beginner block: ${override.blockId}`);
    }
    const before = materializeBodyBlocks(
      review.before ?? [],
      section.source,
      `beginner-${section.id}-before`,
    );
    const after = materializeBodyBlocks(
      review.after ?? [],
      section.source,
      `beginner-${section.id}-after`,
    );
    const blocks = [...result.blocks];
    const purpose = blocks.findIndex(
      (block) => block.type === 'callout' && block.title === '为什么需要它',
    );
    blocks.splice(purpose < 0 ? 0 : purpose + 1, 0, ...before);
    const pitfalls = blocks.findIndex(
      (block) => block.type === 'callout' && block.title === '常见误区',
    );
    const check = blocks.findIndex((block) => block.type === 'knowledgeCheck');
    const end = pitfalls >= 0 ? pitfalls : check >= 0 ? check : blocks.length;
    blocks.splice(end, 0, ...after);
    const resourceBlocks: ContentBlock[] = (review.resources ?? []).map(
      (resource, index) => ({
        type: 'paragraph',
        id: `beginner-${section.id}-resource-${index + 1}`,
        source: section.source,
        children: [
          {
            type: 'link',
            href: resource.href,
            children: [{ type: 'text', value: resource.label }],
          },
        ],
      }),
    );
    blocks.splice(end + after.length, 0, ...resourceBlocks);
    if (review.check) {
      if (blocks.some((block) => block.type === 'knowledgeCheck'))
        throw new Error(
          `Beginner check would duplicate an existing check: ${section.id}`,
        );
      blocks.push({
        type: 'knowledgeCheck',
        id: `beginner-${section.id}-check`,
        source: section.source,
        prompt: [{ type: 'text', value: review.check.prompt }],
        reviewSectionId: section.id,
        answer: materializeBodyBlocks(
          review.check.answer,
          section.source,
          `beginner-${section.id}-answer`,
        ),
      });
    }
    return { ...result, blocks };
  }
  const result = {
    ...course,
    overview: visit(course.overview),
    units: course.units.map((unit) => ({ ...unit, ...visit(unit) })),
  };
  if (applied.size !== byId.size)
    throw new Error(
      `Missing beginner sections: ${[...byId.keys()].filter((id) => !applied.has(id)).join(',')}`,
    );
  return arrangeLearningUnits(result);
}
