import { describe, expect, it, vi } from 'vitest';

import {
  LEARNING_STATE_KEY,
  MAX_NOTE_CODE_POINTS,
  createStorageAdapter,
} from '@/src/learning/storage-adapter';

class MemoryStorage implements Storage {
  #values = new Map<string, string>();
  throwOnSet = false;

  get length() {
    return this.#values.size;
  }
  clear() {
    this.#values.clear();
  }
  getItem(key: string) {
    return this.#values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#values.keys()][index] ?? null;
  }
  removeItem(key: string) {
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
        schemaVersion: 0,
        contentVersion: 'old',
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
    expect(adapter.import(adapter.export(state))).toEqual(state);
    vi.useRealTimers();
  });
});
