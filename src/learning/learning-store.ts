import { createStore, type StoreApi } from 'zustand/vanilla';

import { flattenSections } from '@/src/content/load-course';
import type { Course, SectionNode, WeekUnit } from '@/src/content/schema';
import type { LearningStateV1 } from './state-schema';
import type { ImportResult, PersistResult, StorageAdapter } from './storage-adapter';

type Location = { unitId: string; sectionId: string };
type Progress = { completed: number; total: number; percent: number };
type UndoNote = { sectionId: string; note: LearningStateV1['notesBySection'][string] } | null;

function snapshot(state: LearningStateV1): LearningStateV1 {
  return {
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    lastLocation: state.lastLocation,
    completedSectionIds: state.completedSectionIds,
    appendixReadSectionIds: state.appendixReadSectionIds,
    bookmarks: state.bookmarks,
    notesBySection: state.notesBySection,
    quizAttemptsByQuestion: state.quizAttemptsByQuestion,
    preferences: state.preferences,
    updatedAt: state.updatedAt,
  };
}

export type LearningStore = LearningStateV1 & {
  flushPendingNotes(): PersistResult;
  completeSection(sectionId: string): PersistResult;
  reopenSection(sectionId: string): PersistResult;
  visitSection(unitId: string, sectionId: string): PersistResult;
  toggleBookmark(sectionId: string, excerpt: string): PersistResult;
  saveNote(sectionId: string, text: string): PersistResult;
  removeNote(sectionId: string): PersistResult;
  undoRemoveNote(): PersistResult;
  assessQuestion(questionId: string, status: 'understood' | 'review'): PersistResult;
  setPreference<K extends keyof LearningStateV1['preferences']>(key: K, value: LearningStateV1['preferences'][K]): PersistResult;
  importState(serialized: string): ImportResult;
  exportState(): string;
  resetState(): PersistResult;
};

function leaves(root: SectionNode): SectionNode[] {
  return [...flattenSections(root)].filter((section) => section.children.length === 0 && section.isCompletable);
}
function courseLeaves(course: Course): Array<{ unitId: string; section: SectionNode }> {
  return course.units
    .filter((unit) => unit.kind === 'week')
    .flatMap((unit) => leaves(unit).map((section) => ({ unitId: unit.id, section })));
}
function progressFor(ids: readonly string[], completed: readonly string[]): Progress {
  const valid = new Set(ids);
  const done = new Set(completed.filter((id) => valid.has(id))).size;
  return { completed: done, total: ids.length, percent: ids.length === 0 ? 0 : Math.round((done / ids.length) * 100) };
}

export function selectCourseProgress(state: Pick<LearningStateV1, 'completedSectionIds'>, course: Course): Progress {
  return progressFor(courseLeaves(course).map(({ section }) => section.id), state.completedSectionIds);
}

export function selectWeekProgress(state: Pick<LearningStateV1, 'completedSectionIds'>, week: WeekUnit): Progress {
  return progressFor(leaves(week).map((section) => section.id), state.completedSectionIds);
}

export function selectContinueLocation(state: Pick<LearningStateV1, 'completedSectionIds' | 'lastLocation'>, course: Course): Location {
  const eligible = courseLeaves(course);
  const completed = new Set(state.completedSectionIds);
  const next = eligible.find(({ section }) => !completed.has(section.id));
  if (next) return { unitId: next.unitId, sectionId: next.section.id };
  return { unitId: course.overview.id, sectionId: course.overview.id };
}

export function createLearningStore({ course, adapter, clock = () => new Date() }: { course: Course; adapter: StorageAdapter; clock?: () => Date }): StoreApi<LearningStore> {
  const state = adapter.load();
  const timestamp = () => clock().toISOString();
  const persist = (next: LearningStateV1) => adapter.persist(next);
  let undoNote: UndoNote = null;
  return createStore<LearningStore>((set, get) => {
    const immediate = (change: (current: LearningStore) => Partial<LearningStateV1>): PersistResult => {
      const next = { ...snapshot(get()), ...change(get()), updatedAt: timestamp() } as LearningStateV1;
      set(next);
      return persist(next);
    };
    return {
      ...state,
      flushPendingNotes: () => adapter.flushPendingNotes(),
      completeSection(sectionId) {
        const isAppendix = course.units.filter((unit) => unit.kind === 'appendix').flatMap(leaves).some((section) => section.id === sectionId);
        return immediate((current) => isAppendix
          ? { appendixReadSectionIds: [...new Set([...current.appendixReadSectionIds, sectionId])] }
          : { completedSectionIds: [...new Set([...current.completedSectionIds, sectionId])] });
      },
      reopenSection(sectionId) { return immediate((current) => ({ completedSectionIds: current.completedSectionIds.filter((id) => id !== sectionId), appendixReadSectionIds: current.appendixReadSectionIds.filter((id) => id !== sectionId) })); },
      visitSection(unitId, sectionId) { return immediate(() => ({ lastLocation: { unitId, sectionId } })); },
      toggleBookmark(sectionId, excerpt) {
        return immediate((current) => {
          const existing = current.bookmarks.find((bookmark) => bookmark.sectionId === sectionId);
          return { bookmarks: existing ? current.bookmarks.filter((bookmark) => bookmark.sectionId !== sectionId) : [...current.bookmarks, { id: `${sectionId}:${timestamp()}`, sectionId, excerpt, createdAt: timestamp() }] };
        });
      },
      saveNote(sectionId, text) {
        if (Array.from(text).length > 20_000) throw new Error('Notes cannot exceed 20,000 code points');
        const next = { ...snapshot(get()), notesBySection: text === '' ? Object.fromEntries(Object.entries(get().notesBySection).filter(([id]) => id !== sectionId)) : { ...get().notesBySection, [sectionId]: { text, updatedAt: timestamp() } }, updatedAt: timestamp() } as LearningStateV1;
        set(next);
        adapter.queueNotes(next);
        return { ok: true };
      },
      removeNote(sectionId) {
        const note = get().notesBySection[sectionId];
        if (!note) return { ok: true };
        const next = { ...snapshot(get()), notesBySection: Object.fromEntries(Object.entries(get().notesBySection).filter(([id]) => id !== sectionId)), updatedAt: timestamp() } as LearningStateV1;
        undoNote = { sectionId, note };
        set(next);
        adapter.queueNotes(next);
        return { ok: true };
      },
      undoRemoveNote() {
        if (!undoNote) return { ok: true };
        const next = { ...snapshot(get()), notesBySection: { ...get().notesBySection, [undoNote.sectionId]: undoNote.note }, updatedAt: timestamp() } as LearningStateV1;
        undoNote = null;
        set(next);
        adapter.queueNotes(next);
        return { ok: true };
      },
      assessQuestion(questionId, status) { return immediate((current) => ({ quizAttemptsByQuestion: { ...current.quizAttemptsByQuestion, [questionId]: { status, reviewedAt: timestamp() } } })); },
      setPreference(key, value) { return immediate((current) => ({ preferences: { ...current.preferences, [key]: value } })); },
      importState(serialized) {
        const result = adapter.import(serialized);
        if (result.ok) set(result.state);
        return result;
      },
      exportState() { return adapter.export(snapshot(get())); },
      resetState() { const result = adapter.reset(); if (result.ok) set(adapter.load()); return result; },
    };
  });
}
