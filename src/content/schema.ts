import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);
const nonBlankInlineText = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: 'Inline text must contain a non-whitespace character',
  });
const nonBlankSourceText = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: 'Source text must contain a non-whitespace character',
  });
const stableId = nonEmptyText;
const CONTENT_LINK_BASE = new URL('https://course.invalid');

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function isSafeContentHref(href: string): boolean {
  const value = href.trim();
  if (
    value.includes('\\') ||
    hasControlCharacters(value) ||
    /%(?:2f|5c)/iu.test(value)
  )
    return false;
  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('/')) {
    if (/^\/[\\/]/u.test(value)) return false;
    try {
      const url = new URL(value, CONTENT_LINK_BASE);
      return url.origin === CONTENT_LINK_BASE.origin;
    } catch {
      return false;
    }
  }
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value, CONTENT_LINK_BASE);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

const contentHref = nonEmptyText.refine(isSafeContentHref, {
  message: 'Links must use http, https, a root-relative path, or a hash anchor',
});

export const SourceRefSchema = z.object({
  pdfPage: z.int().min(1).max(170),
  printedPageLabel: nonEmptyText.optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'emphasis'; children: InlineNode[] }
  | { type: 'inlineCode'; value: string }
  | { type: 'inlineMath'; value: string; accessibleText: string }
  | { type: 'link'; href: string; children: InlineNode[] };

export const InlineNodeSchema: z.ZodType<InlineNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), value: nonBlankInlineText }),
    z.object({
      type: z.union([z.literal('strong'), z.literal('emphasis')]),
      children: z.array(InlineNodeSchema).min(1),
    }),
    z.object({ type: z.literal('inlineCode'), value: nonEmptyText }),
    z.object({
      type: z.literal('inlineMath'),
      value: nonEmptyText,
      accessibleText: nonEmptyText,
    }),
    z.object({
      type: z.literal('link'),
      href: contentHref,
      children: z.array(InlineNodeSchema).min(1),
    }),
  ]),
);

type BlockBase = { id: string; source: SourceRef };
export type ContentBlock =
  | (BlockBase & { type: 'paragraph'; children: InlineNode[] })
  | (BlockBase & { type: 'list'; ordered: boolean; items: InlineNode[][] })
  | (BlockBase & { type: 'formula'; latex: string; accessibleText: string })
  | (BlockBase & {
      type: 'code';
      language: string;
      filename?: string;
      code: string;
    })
  | (BlockBase & {
      type: 'table';
      caption?: string;
      headers: InlineNode[][];
      rows: InlineNode[][][];
    })
  | (BlockBase & {
      type: 'callout';
      tone: 'concept' | 'principle' | 'example';
      title?: string;
      blocks: ContentBlock[];
    })
  | (BlockBase & { type: 'conceptChain'; steps: string[] })
  | (BlockBase & {
      type: 'knowledgeCheck';
      prompt: InlineNode[];
      answer?: ContentBlock[];
      reviewSectionId: string;
    });

const inlineChildren = z.array(InlineNodeSchema).min(1);
const inlineRows = z.array(inlineChildren).min(1);
export const ContentBlockSchema: z.ZodType<ContentBlock> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('paragraph'),
      id: stableId,
      children: inlineChildren,
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('list'),
      id: stableId,
      ordered: z.boolean(),
      items: z.array(inlineChildren).min(1),
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('formula'),
      id: stableId,
      latex: nonEmptyText,
      accessibleText: nonEmptyText,
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('code'),
      id: stableId,
      language: nonEmptyText,
      filename: nonEmptyText.optional(),
      code: nonBlankSourceText,
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('table'),
      id: stableId,
      caption: nonEmptyText.optional(),
      headers: inlineRows,
      rows: z.array(inlineRows).min(1),
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('callout'),
      id: stableId,
      tone: z.enum(['concept', 'principle', 'example']),
      title: nonEmptyText.optional(),
      blocks: z.array(ContentBlockSchema).min(1),
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('conceptChain'),
      id: stableId,
      steps: z.array(nonEmptyText).min(1),
      source: SourceRefSchema,
    }),
    z.object({
      type: z.literal('knowledgeCheck'),
      id: stableId,
      prompt: inlineChildren,
      answer: z.array(ContentBlockSchema).min(1).optional(),
      reviewSectionId: stableId,
      source: SourceRefSchema,
    }),
  ]),
);

export interface SectionNode {
  id: string;
  aliases: string[];
  title: string;
  navDepth: number;
  showInToc: boolean;
  isCompletable: boolean;
  source: SourceRef;
  blocks: ContentBlock[];
  children: SectionNode[];
}
export const SectionNodeSchema: z.ZodType<SectionNode> = z.lazy(() =>
  z
    .object({
      id: stableId,
      aliases: z.array(stableId).default([]),
      title: nonEmptyText,
      navDepth: z.int().min(1),
      showInToc: z.boolean(),
      isCompletable: z.boolean(),
      source: SourceRefSchema,
      blocks: z.array(ContentBlockSchema),
      children: z.array(SectionNodeSchema),
    })
    .refine(
      (section) => section.blocks.length > 0 || section.children.length > 0,
      {
        message: 'A section must contain blocks or children',
      },
    ),
);

export type WeekUnit = SectionNode & {
  kind: 'week';
  weekNumber: number;
  slug: string;
  keyQuestion: string;
  objectives: string[];
  sourcePages: number[];
  estimatedReadingMinutes: number;
};
export type AppendixUnit = SectionNode & {
  kind: 'appendix';
  label: 'A';
  slug: string;
};
export type CourseUnit = WeekUnit | AppendixUnit;
const WeekUnitSchema: z.ZodType<WeekUnit> = SectionNodeSchema.and(
  z.object({
    kind: z.literal('week'),
    weekNumber: z.int().min(1).max(12),
    slug: nonEmptyText,
    keyQuestion: nonEmptyText,
    objectives: z.array(nonEmptyText).min(1),
    sourcePages: z.array(z.int().min(1).max(170)).min(1),
    estimatedReadingMinutes: z.int().positive(),
  }),
);
const AppendixUnitSchema: z.ZodType<AppendixUnit> = SectionNodeSchema.and(
  z.object({
    kind: z.literal('appendix'),
    label: z.literal('A'),
    slug: nonEmptyText,
  }),
);

export type GlossaryEntry = {
  term: string;
  definition: string;
  sectionId: string;
  aliases?: string[];
};
const GlossaryEntrySchema: z.ZodType<GlossaryEntry> = z.object({
  term: nonEmptyText,
  definition: nonEmptyText,
  sectionId: stableId,
  aliases: z.array(stableId).min(1).optional(),
});
export interface Course {
  title: string;
  description: string;
  sourceFilename: string;
  version: string;
  overview: SectionNode;
  units: CourseUnit[];
  glossary?: GlossaryEntry[];
}
export const CourseSchema: z.ZodType<Course> = z.object({
  title: nonEmptyText,
  description: nonEmptyText,
  sourceFilename: nonEmptyText,
  version: nonEmptyText,
  overview: SectionNodeSchema,
  units: z.array(z.union([WeekUnitSchema, AppendixUnitSchema])),
  glossary: z.array(GlossaryEntrySchema).optional(),
});

export const PageManifestEntrySchema = z
  .object({
    pdfPage: z.int().min(1).max(170),
    printedPageLabel: nonEmptyText.optional(),
    classification: z.enum([
      'content',
      'frontMatter',
      'navigationReplaced',
      'merged',
    ]),
    reason: nonEmptyText.optional(),
    sectionId: stableId.optional(),
    mergedIntoSectionId: stableId.optional(),
  })
  .refine(
    (entry) => entry.classification === 'content' || entry.reason !== undefined,
    {
      message: 'A non-content page classification requires a reason',
      path: ['reason'],
    },
  );
export const PageManifestSchema = z.array(PageManifestEntrySchema);
export type PageManifestEntry = z.infer<typeof PageManifestEntrySchema>;
