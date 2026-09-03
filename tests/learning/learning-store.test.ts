import { describe, expect, it, vi } from 'vitest';

import { createLearningStore, selectContinueLocation, selectCourseProgress, selectWeekProgress } from '@/src/learning/learning-store';
import { createStorageAdapter } from '@/src/learning/storage-adapter';
import type { Course, SectionNode, WeekUnit } from '@/src/content/schema';

function section(id: string, title: string, completable = true): SectionNode {
  return {
    id, aliases: [], title, navDepth: 1, showInToc: true, isCompletable: completable,
    source: { pdfPage: 1 }, blocks: [{ id: `${id}-p`, type: 'paragraph', source: { pdfPage: 1 }, children: [{ type: 'text', value: title }] }], children: [],
  };
}

const course = {
  title: 'Course', description: 'Description', sourceFilename: 'source.pdf', version: 'course-1',
  overview: section('overview', 'Overview', false),
  units: [
    { ...section('week-1', 'Week 1', false), kind: 'week', weekNumber: 1, slug: 'one', keyQuestion: 'Why?', objectives: ['Learn'], sourcePages: [1], estimatedReadingMinutes: 1, children: [section('one-a', 'One A'), section('one-b', 'One B')] },
    { ...section('appendix', 'Appendix', false), kind: 'appendix', label: 'A', slug: 'appendix', children: [section('appendix-a', 'Appendix A')] },
  ],
} as Course;

describe('learning store', () => {
  it('excludes appendix reads from the course percentage', () => {
    const store = createLearningStore({ course, adapter: createStorageAdapter({ contentVersion: 'course-1' }) });
    store.getState().completeSection('appendix-a');

    expect(store.getState().appendixReadSectionIds).toEqual(['appendix-a']);
    expect(selectCourseProgress(store.getState(), course)).toMatchObject({ completed: 0, total: 2, percent: 0 });
  });

  it('chooses the first incomplete course section and review overview when complete', () => {
    const store = createLearningStore({ course, adapter: createStorageAdapter({ contentVersion: 'course-1' }) });

    expect(selectContinueLocation(store.getState(), course)).toEqual({ unitId: 'week-1', sectionId: 'one-a' });
    store.getState().completeSection('one-a');
    expect(selectContinueLocation(store.getState(), course)).toEqual({ unitId: 'week-1', sectionId: 'one-b' });
    store.getState().completeSection('one-b');
    expect(selectContinueLocation(store.getState(), course)).toEqual({ unitId: 'overview', sectionId: 'overview' });
  });

  it('calculates a week percentage only from completable leaves', () => {
    const store = createLearningStore({ course, adapter: createStorageAdapter({ contentVersion: 'course-1' }) });
    store.getState().completeSection('one-a');

    expect(selectWeekProgress(store.getState(), course.units[0]! as WeekUnit)).toMatchObject({ completed: 1, total: 2, percent: 50 });
  });

  it('debounces note persistence but persists other writes immediately and can undo a note deletion', () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const adapter = createStorageAdapter({ contentVersion: 'course-1', storage: {
      length: 0, clear() {}, key() { return null; }, getItem() { return null; }, removeItem() {}, setItem(_key, value) { writes.push(value); },
    } });
    const store = createLearningStore({ course, adapter });
    store.getState().saveNote('one-a', 'draft');
    expect(writes).toHaveLength(0);
    vi.advanceTimersByTime(350);
    expect(writes).toHaveLength(1);
    store.getState().completeSection('one-a');
    expect(writes).toHaveLength(2);
    store.getState().removeNote('one-a');
    store.getState().undoRemoveNote();
    expect(store.getState().notesBySection['one-a']?.text).toBe('draft');
    vi.useRealTimers();
  });

  it('returns persistence outcomes and retains memory when reset storage removal fails', () => {
    const storage = {
      length: 0, clear() {}, key() { return null; }, getItem() { return null; },
      removeItem() { throw new DOMException('blocked', 'SecurityError'); },
      setItem() { throw new DOMException('quota', 'QuotaExceededError'); },
    };
    const store = createLearningStore({ course, adapter: createStorageAdapter({ contentVersion: 'course-1', storage }) });

    expect(store.getState().completeSection('one-a')).toMatchObject({ ok: false, reason: 'quota' });
    expect(store.getState().flushPendingNotes()).toEqual({ ok: true });
    const beforeImport = store.getState().completedSectionIds;
    const importPayload = JSON.parse(store.getState().exportState());
    const importResult = store.getState().importState(JSON.stringify({
      ...importPayload,
      completedSectionIds: ['one-b'],
    }));
    expect(importResult).toMatchObject({ ok: false, reason: 'quota' });
    expect(store.getState().completedSectionIds).toEqual(beforeImport);
    expect(store.getState().resetState()).toEqual({ ok: false, reason: 'unavailable' });
    expect(store.getState().completedSectionIds).toEqual(['one-a']);
  });
});
