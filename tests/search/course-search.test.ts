import { describe, expect, it } from 'vitest';

import courseData from '@/src/content/course.generated.json';
import { loadCourse } from '@/src/content/load-course';
import { createCourseSearch, searchCourse } from '@/src/search/course-search';
import type { Course, SectionNode } from '@/src/content/schema';

describe('course search', () => {
  const course = loadCourse(courseData);
  const index = createCourseSearch(course);

  it('finds generated bilingual material with useful deterministic metadata', () => {
    const canonical = [
      ['梯度', 'o0048-9-gradient-descent', '梯度下降'],
      ['神经网络', 'o0077-week-3-neural-network-neuron', '神经网络'],
      ['Attention', 'o0254-week-7-attention-token', 'Attention'],
      ['CrossEntropyLoss', 'o0243-12-pytorch-crossentropyloss-logits', 'CrossEntropyLoss'],
    ] as const;

    for (const [query, sectionId, visibleText] of canonical) {
      const result = searchCourse(index, query)[0];
      expect(result?.sectionId).toBe(sectionId);
      expect(result?.excerpt).toContain(visibleText);
      expect(result?.excerpt).not.toMatch(/<[^>]+>/);
    }
  });

  it('normalizes NFKC case and hyphens, including the CJK fallback', () => {
    expect(searchCourse(index, 'ＡＴＴＥＮＴＩＯＮ').map((result) => result.sectionId)).toEqual(searchCourse(index, 'attention').map((result) => result.sectionId));
    expect(searchCourse(index, 'Cross‑EntropyLoss').length).toBeGreaterThan(0);
    const original = Intl.Segmenter;
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
    try {
      expect(searchCourse(createCourseSearch(course), '神经网络')[0]?.sectionId).toBe('o0077-week-3-neural-network-neuron');
    } finally {
      Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: original });
    }
  });

  it('returns source-stable escaped plain-text excerpts capped at 140 characters', () => {
    const first = searchCourse(index, 'gradient')[0]!;
    expect(first.excerpt.length).toBeLessThanOrEqual(140);
    expect(first.excerpt).not.toMatch(/<[^>]+>/);
    expect(searchCourse(index, 'attentin').map((result) => result.sectionId)).toEqual(searchCourse(index, 'attentin').map((result) => result.sectionId));
    expect(searchCourse(index, ' ').length).toBe(0);
  });

  it('includes glossary relationships in linked section results', () => {
    const target: SectionNode = { id: 'glossary-target', aliases: [], title: 'Target', navDepth: 1, showInToc: true, isCompletable: true, source: { pdfPage: 1 }, blocks: [{ id: 'p', type: 'paragraph', source: { pdfPage: 1 }, children: [{ type: 'text', value: 'Plain text' }] }], children: [] };
    const fixture = { title: 'Fixture', description: 'Fixture', sourceFilename: 'x', version: '1', overview: target, units: [], glossary: [{ term: '反向传播', definition: 'Backpropagation', sectionId: 'glossary-target', aliases: ['BP'] }] } as Course;

    expect(searchCourse(createCourseSearch(fixture), 'BP')[0]).toMatchObject({ sectionId: 'glossary-target', anchor: '#glossary-target' });
  });
});
