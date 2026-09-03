import { describe, expect, it } from 'vitest';

import {
  findSection,
  flattenSections,
  loadCourse,
} from '@/src/content/load-course';
import { PageManifestSchema } from '@/src/content/schema';

const source = { pdfPage: 1 };

const paragraph = (id: string) => ({
  type: 'paragraph' as const,
  id,
  children: [{ type: 'text' as const, value: 'A small lesson.' }],
  source,
});

const week = (weekNumber: number) => ({
  kind: 'week' as const,
  id: `week-${String(weekNumber).padStart(2, '0')}`,
  aliases: [],
  title: `Week ${weekNumber}`,
  navDepth: 1,
  showInToc: true,
  isCompletable: false,
  source,
  blocks: [paragraph(`week-${String(weekNumber).padStart(2, '0')}-intro`)],
  children:
    weekNumber === 1
      ? [
          {
            id: 'week-01-scalars',
            aliases: [],
            title: 'Scalars',
            navDepth: 2,
            showInToc: true,
            isCompletable: true,
            source,
            blocks: [paragraph('week-01-scalars-content')],
            children: [
              {
                id: 'week-01-vectors',
                aliases: ['old-vector-anchor'],
                title: 'Vectors',
                navDepth: 3,
                showInToc: true,
                isCompletable: true,
                source,
                blocks: [paragraph('week-01-vectors-content')],
                children: [],
              },
            ],
          },
        ]
      : [],
  weekNumber,
  slug: String(weekNumber).padStart(2, '0'),
  keyQuestion: 'What should I learn?',
  objectives: ['Learn one thing.'],
  sourcePages: [1],
  estimatedReadingMinutes: 1,
});

const fixture = {
  title: 'AI First Principles',
  description: 'A minimal course fixture.',
  sourceFilename: 'source.pdf',
  version: '1.0.0',
  overview: {
    id: 'overview',
    aliases: [],
    title: 'Read me',
    navDepth: 1,
    showInToc: true,
    isCompletable: false,
    source: { pdfPage: 10, printedPageLabel: '1' },
    blocks: [
      {
        ...paragraph('overview-content'),
        source: { pdfPage: 10, printedPageLabel: '1' },
      },
    ],
    children: [],
  },
  units: [
    ...Array.from({ length: 12 }, (_, index) => week(index + 1)),
    {
      kind: 'appendix' as const,
      id: 'appendix-a',
      aliases: [],
      title: 'Appendix A',
      navDepth: 1,
      showInToc: true,
      isCompletable: false,
      source,
      blocks: [paragraph('appendix-a-content')],
      children: [],
      label: 'A',
      slug: 'mini-gpt',
    },
  ],
};

describe('course schema', () => {
  it('retains the source overview separately from the learning units', () => {
    const course = loadCourse(fixture);

    expect(course).toHaveProperty('overview.id', 'overview');
    expect(course.units).toHaveLength(13);
  });

  it('traverses nested sections in source order and resolves stable aliases', () => {
    const course = loadCourse(fixture);

    expect(findSection(course, 'overview')?.id).toBe('overview');
    expect(flattenSections(course.units[0]).map((item) => item.id)).toEqual([
      'week-01',
      'week-01-scalars',
      'week-01-vectors',
    ]);
    expect(findSection(course, 'old-vector-anchor')?.id).toBe(
      'week-01-vectors',
    );
  });

  it('rejects a course without twelve numbered weeks', () => {
    expect(() => loadCourse({ ...fixture, units: [] })).toThrow(
      /12 numbered weeks/i,
    );
  });

  it('requires Weeks 1 through 12 before Appendix A', () => {
    expect(() =>
      loadCourse({
        ...fixture,
        units: [fixture.units[12], ...fixture.units.slice(0, 12)],
      }),
    ).toThrow(/weeks 1 through 12.*appendix a/i);
  });

  it('rejects duplicate stable identifiers, invalid physical pages, and empty blocks', () => {
    expect(() =>
      loadCourse({
        ...fixture,
        units: fixture.units.map((unit, index) =>
          index === 1 ? { ...unit, id: 'week-01' } : unit,
        ),
      }),
    ).toThrow(/duplicate/i);
    expect(() =>
      loadCourse({
        ...fixture,
        units: fixture.units.map((unit, index) =>
          index === 0 ? { ...unit, source: { pdfPage: 171 } } : unit,
        ),
      }),
    ).toThrow(/pdfPage/i);
    expect(() =>
      loadCourse({
        ...fixture,
        units: fixture.units.map((unit, index) =>
          index === 0
            ? {
                ...unit,
                blocks: [{ ...paragraph('empty-block'), children: [] }],
              }
            : unit,
        ),
      }),
    ).toThrow(/children/i);
  });

  it('rejects a duplicate section alias', () => {
    expect(() =>
      loadCourse({
        ...fixture,
        units: fixture.units.map((unit, index) =>
          index === 1 ? { ...unit, aliases: ['old-vector-anchor'] } : unit,
        ),
      }),
    ).toThrow(/duplicate stable alias/i);
  });

  it('rejects a content block ID that collides with a section ID', () => {
    expect(() =>
      loadCourse({
        ...fixture,
        units: fixture.units.map((unit, index) =>
          index === 1
            ? {
                ...unit,
                blocks: [paragraph('week-01-vectors')],
              }
            : unit,
        ),
      }),
    ).toThrow(/duplicate stable identifier/i);
  });
});

describe('page manifest schema', () => {
  it('retains printed labels separately from physical PDF pages', () => {
    const manifest = PageManifestSchema.parse([
      {
        pdfPage: 10,
        printedPageLabel: '1',
        classification: 'content',
        sectionId: 'overview',
      },
    ]);

    expect(manifest[0]).toMatchObject({
      pdfPage: 10,
      printedPageLabel: '1',
    });
  });

  it('requires an audit reason whenever a page is not content', () => {
    expect(() =>
      PageManifestSchema.parse([{ pdfPage: 1, classification: 'frontMatter' }]),
    ).toThrow(/reason/i);
  });
});
