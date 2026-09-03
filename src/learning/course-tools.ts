import { flattenSections } from '@/src/content/load-course';
import type {
  ContentBlock,
  Course,
  CourseUnit,
  InlineNode,
  SectionNode,
} from '@/src/content/schema';
import { courseUnitPath } from '@/src/content/course-runtime';

export type SectionReference = {
  section: SectionNode;
  unit: CourseUnit;
  href: string;
  groupLabel: string;
  groupOrder: number;
};

function inlineText(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
        case 'inlineCode':
        case 'inlineMath':
          return node.value;
        case 'strong':
        case 'emphasis':
        case 'link':
          return inlineText(node.children);
      }
    })
    .join('');
}

function blockText(block: ContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items.map(inlineText).join(' ');
    case 'formula':
      return block.accessibleText;
    case 'code':
      return block.code;
    case 'table':
      return [
        ...(block.caption ? [block.caption] : []),
        ...block.headers.map(inlineText),
        ...block.rows.flat().map(inlineText),
      ].join(' ');
    case 'callout':
      return [block.title, ...block.blocks.map(blockText)]
        .filter(Boolean)
        .join(' ');
    case 'conceptChain':
      return block.steps.join(' → ');
    case 'knowledgeCheck':
      return inlineText(block.prompt);
  }
}

export function sectionExcerpt(section: SectionNode, limit = 180): string {
  const text = section.blocks
    .map(blockText)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const points = Array.from(text);
  return points.length > limit
    ? `${points.slice(0, Math.max(0, limit - 1)).join('')}…`
    : text;
}

export function sectionReferenceMap(
  course: Course,
): ReadonlyMap<string, SectionReference> {
  const references = new Map<string, SectionReference>();
  course.units.forEach((unit, index) => {
    const groupLabel =
      unit.kind === 'week'
        ? `Week ${unit.weekNumber}: ${unit.title}`
        : `Appendix ${unit.label}: ${unit.title}`;
    for (const section of flattenSections(unit)) {
      const reference = {
        section,
        unit,
        href: `${courseUnitPath(unit)}#${section.id}`,
        groupLabel,
        groupOrder: index,
      };
      references.set(section.id, reference);
      section.aliases.forEach((alias) => references.set(alias, reference));
    }
  });
  return references;
}
