import { describe, expect, it, vi } from 'vitest';

import {
  LEARNING_STATE_KEY,
  MAX_NOTE_CODE_POINTS,
  createStorageAdapter,
} from '@/src/learning/storage-adapter';
import { createInitialLearningState } from '@/src/learning/state-schema';

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  throwOnSet = false;
  throwOnGet = false;
  throwOnRemove = false;

  get length() {
    return this.#values.size;
  }
  clear() {
    this.#values.clear();
  }
  getItem(key: string) {
    if (this.throwOnGet) throw new DOMException('blocked', 'SecurityError');
    return this.#values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    if (this.throwOnRemove) throw new DOMException('blocked', 'SecurityError');
    this.#values.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.throwOnSet) throw new DOMException('quota', 'QuotaExceededError');
    this.#values.set(key, value);
  }
}

describe('StorageAdapter', () => {
  it('creates a fresh state when browser storage is unavailable', () => {
    const adapter = createStorageAdapter({ contentVersion: 'course-1' });

    expect(adapter.load()).toMatchObject({
      schemaVersion: 1,
      contentVersion: 'course-1',
      completedSectionIds: [],
    });
    expect(adapter.persist(adapter.load())).toMatchObject({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('hydrates a valid serialized state', () => {
    const storage = new MemoryStorage();
    const writer = createStorageAdapter({ storage, contentVersion: 'course-1' });
    const state = { ...writer.load(), completedSectionIds: ['section-a'] };
    expect(writer.persist(state)).toEqual({ ok: true });

    expect(
      createStorageAdapter({ storage, contentVersion: 'course-1' }).load(),
    ).toMatchObject({ completedSectionIds: ['section-a'] });
  });

  it('recovers from invalid JSON without overwriting the raw payload', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEARNING_STATE_KEY, '{not json');
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });

    expect(adapter.load()).toMatchObject({ schemaVersion: 1 });
    expect(adapter.getRecovery()).toEqual('{not json');
    expect(storage.getItem(LEARNING_STATE_KEY)).toEqual('{not json');
  });

  it('rejects a future version atomically', () => {
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    adapter.persist({ ...adapter.load(), completedSectionIds: ['safe'] });
    const before = adapter.load();
    const rawBefore = storage.getItem(LEARNING_STATE_KEY);

    expect(() => adapter.import('{"schemaVersion":999}')).toThrow(/unsupported/i);
    expect(adapter.load()).toEqual(before);
    expect(storage.getItem(LEARNING_STATE_KEY)).toEqual(rawBefore);
  });

  it('migrates V0 identifiers through aliases and deterministically keeps the newer colliding note', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      LEARNING_STATE_KEY,
      JSON.stringify({
        ...(() => { const { schemaVersion: _schemaVersion, ...state } = createInitialLearningState('old', '2025-01-01T00:00:00.000Z'); return state; })(),
        schemaVersion: 0,
        completedSectionIds: ['old-section'],
        notesBySection: {
          'old-section': { text: 'older', updatedAt: '2025-01-01T00:00:00.000Z' },
          'new-section': { text: 'newer', updatedAt: '2025-02-01T00:00:00.000Z' },
        },
      }),
    );

    const state = createStorageAdapter({
      storage,
      contentVersion: 'course-1',
      aliases: { 'old-section': 'new-section' },
    }).load();

    expect(state.completedSectionIds).toEqual(['new-section']);
    expect(state.notesBySection['new-section']?.text).toBe('newer');
  });

  it('rejects notes above 20,000 Unicode code points', () => {
    const adapter = createStorageAdapter({
      storage: new MemoryStorage(),
      contentVersion: 'course-1',
    });
    const state = {
      ...adapter.load(),
      notesBySection: {
        section: {
          text: `${'😀'.repeat(MAX_NOTE_CODE_POINTS)}x`,
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    };

    expect(adapter.persist(state)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('rejects over-5 MiB imports before parsing and keeps storage unchanged', () => {
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    const before = storage.getItem(LEARNING_STATE_KEY);

    expect(() => adapter.import('x'.repeat(5 * 1024 * 1024 + 1))).toThrow(/5 MiB/i);
    expect(storage.getItem(LEARNING_STATE_KEY)).toBe(before);
  });

  it('retains a quota-failed candidate for export without replacing valid storage', () => {
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    adapter.persist({ ...adapter.load(), completedSectionIds: ['old'] });
    const before = storage.getItem(LEARNING_STATE_KEY);
    storage.throwOnSet = true;
    const candidate = { ...adapter.load(), completedSectionIds: ['new'] };

    const result = adapter.persist(candidate);

    expect(result).toMatchObject({ ok: false, reason: 'quota' });
    expect(result.ok || result.recoverablePayload).toContain('new');
    expect(storage.getItem(LEARNING_STATE_KEY)).toBe(before);
  });

  it('keeps active state and old storage during a quota-failed import while retaining a canonical retry payload', () => {
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    const oldState = { ...adapter.load(), completedSectionIds: ['old'] };
    adapter.persist(oldState);
    const rawBefore = storage.getItem(LEARNING_STATE_KEY);
    const candidate = { ...oldState, completedSectionIds: ['candidate'] };
    storage.throwOnSet = true;

    const result = adapter.import(JSON.stringify(candidate));

    expect(result).toMatchObject({ ok: false, reason: 'quota' });
    expect(adapter.load()).toEqual(oldState);
    expect(storage.getItem(LEARNING_STATE_KEY)).toBe(rawBefore);
    expect(adapter.getRecovery()).toContain('candidate');
    expect(adapter.getRecovery()).toEqual(result.ok ? undefined : result.recoverablePayload);
    storage.throwOnSet = false;
    expect(adapter.import(adapter.getRecovery() ?? '')).toMatchObject({ ok: true, state: candidate });
    expect(adapter.load()).toEqual(candidate);
  });

  it('treats throwing browser storage reads as unavailable', () => {
    const storage = new MemoryStorage();
    storage.throwOnGet = true;
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });

    expect(adapter.load()).toMatchObject({ completedSectionIds: [] });
    expect(adapter.persist(adapter.load())).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('keeps in-memory state when reset cannot remove browser storage', () => {
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    const state = { ...adapter.load(), completedSectionIds: ['safe'] };
    adapter.persist(state);
    storage.throwOnRemove = true;

    expect(adapter.reset()).toEqual({ ok: false, reason: 'unavailable' });
    expect(adapter.load()).toEqual(state);
  });

  it.each([
    [{ ...createInitialLearningState('course-1'), extra: true }, 'V1 unknown key'],
    [{ ...createInitialLearningState('course-1'), preferences: { ...createInitialLearningState('course-1').preferences, extra: true } }, 'V1 nested unknown key'],
    [{ ...createInitialLearningState('course-1'), schemaVersion: 0, extra: true }, 'V0 unknown key'],
    [{ ...createInitialLearningState('course-1'), schemaVersion: 0, completedSectionIds: 'bad' }, 'V0 malformed field'],
  ])('rejects strict %s payloads without replacing recoverable storage', (payload: unknown, _label: string) => {
    const storage = new MemoryStorage();
    const serialized = JSON.stringify(payload);
    storage.setItem(LEARNING_STATE_KEY, serialized);
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });

    expect(adapter.load()).toMatchObject({ completedSectionIds: [] });
    expect(adapter.getRecovery()).toBe(serialized);
    expect(() => adapter.import(serialized)).toThrow(/invalid/i);
    expect(storage.getItem(LEARNING_STATE_KEY)).toBe(serialized);
  });

  it('round-trips a valid export and flushes queued notes on pagehide', () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const adapter = createStorageAdapter({ storage, contentVersion: 'course-1' });
    const state = {
      ...adapter.load(),
      notesBySection: { section: { text: 'draft', updatedAt: '2025-01-01T00:00:00.000Z' } },
    };
    adapter.queueNotes(state);
    window.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(storage.getItem(LEARNING_STATE_KEY) ?? '')).toMatchObject({
      notesBySection: { section: { text: 'draft' } },
    });
    expect(adapter.import(adapter.export(state))).toEqual({ ok: true, state });
    vi.useRealTimers();
  });
});
