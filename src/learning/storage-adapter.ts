import {
  createInitialLearningState,
  LearningStateV1Schema,
  parseLearningState,
  type LearningStateV1,
  type SectionAliases,
} from './state-schema';

export const LEARNING_STATE_KEY = 'ai-first-principles:learning-state';
export const MAX_NOTE_CODE_POINTS = 20_000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type PersistResult =
  | { ok: true }
  | { ok: false; reason: 'quota' | 'unavailable' | 'invalid'; recoverablePayload?: string };
export type ImportResult =
  | { ok: true; state: LearningStateV1 }
  | { ok: false; reason: 'quota' | 'unavailable' | 'invalid'; recoverablePayload: string };

export interface StorageAdapter {
  load(): LearningStateV1;
  persist(state: LearningStateV1): PersistResult;
  import(serialized: string): ImportResult;
  export(state: LearningStateV1): string;
  reset(): PersistResult;
  flushPendingNotes(): PersistResult;
  queueNotes(state: LearningStateV1): void;
  getRecovery(): string | undefined;
}

type Options = {
  storage?: Storage;
  contentVersion: string;
  aliases?: SectionAliases;
  clock?: () => Date;
};

function isQuota(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'QuotaExceededError'
    : error instanceof Error && /quota/i.test(error.name + error.message);
}

function hasValidNotes(state: LearningStateV1): boolean {
  return Object.values(state.notesBySection).every((note) => Array.from(note.text).length <= MAX_NOTE_CODE_POINTS);
}

export function createStorageAdapter(options: Options): StorageAdapter {
  const storage = options.storage;
  const aliases = options.aliases ?? {};
  const initial = () => createInitialLearningState(options.contentVersion, (options.clock?.() ?? new Date()).toISOString());
  let current = initial();
  let hydrated = false;
  let available = storage !== undefined;
  let recovery: string | undefined;
  let pending: LearningStateV1 | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const validate = (state: LearningStateV1): string | undefined => {
    if (!hasValidNotes(state)) return undefined;
    const parsed = LearningStateV1Schema.safeParse(state);
    return parsed.success ? JSON.stringify(parsed.data) : undefined;
  };
  const write = (serialized: string): PersistResult => {
    if (!storage || !available) return { ok: false, reason: 'unavailable', recoverablePayload: serialized };
    try {
      storage.setItem(LEARNING_STATE_KEY, serialized);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: isQuota(error) ? 'quota' : 'unavailable', recoverablePayload: serialized };
    }
  };
  const load = (): LearningStateV1 => {
    if (hydrated) return current;
    hydrated = true;
    if (!storage) return current;
    let serialized: string | null;
    try {
      serialized = storage.getItem(LEARNING_STATE_KEY);
    } catch {
      available = false;
      current = initial();
      return current;
    }
    if (!serialized) return current;
    try {
      current = parseLearningState(JSON.parse(serialized), options.contentVersion, aliases);
    } catch {
      recovery = serialized;
      current = initial();
    }
    return current;
  };
  const flushPendingNotes = (): PersistResult => {
    clearTimer();
    if (!pending) return { ok: true };
    const candidate = pending;
    pending = undefined;
    return persist(candidate);
  };
  const persist = (state: LearningStateV1): PersistResult => {
    load();
    const serialized = validate(state);
    if (!serialized) return { ok: false, reason: 'invalid', recoverablePayload: JSON.stringify(state) };
    const result = write(serialized);
    if (!result.ok) recovery = serialized;
    current = state;
    return result;
  };
  const queueNotes = (state: LearningStateV1): void => {
    pending = state;
    clearTimer();
    timer = setTimeout(() => { flushPendingNotes(); }, 350);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPendingNotes);
    window.addEventListener('blur', flushPendingNotes);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingNotes();
    });
  }

  return {
    load,
    persist,
    import(serialized) {
      load();
      if (new TextEncoder().encode(serialized).byteLength > MAX_IMPORT_BYTES) throw new Error('Import exceeds 5 MiB limit');
      let candidate: LearningStateV1;
      try {
        candidate = parseLearningState(JSON.parse(serialized), options.contentVersion, aliases);
      } catch (error) {
        if (error instanceof Error && /unsupported/i.test(error.message)) throw error;
        throw new Error(`Invalid learning-state import: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
      const canonical = validate(candidate);
      if (!canonical) throw new Error('Invalid learning-state import');
      const result = write(canonical);
      if (!result.ok) {
        recovery = canonical;
        return { ...result, recoverablePayload: canonical };
      }
      clearTimer();
      pending = undefined;
      current = candidate;
      return { ok: true, state: current };
    },
    export(state) {
      const serialized = validate(state);
      if (!serialized) throw new Error('Cannot export invalid learning state');
      return serialized;
    },
    reset() {
      if (!storage) return { ok: false, reason: 'unavailable' };
      try {
        storage.removeItem(LEARNING_STATE_KEY);
        clearTimer();
        pending = undefined;
        current = initial();
        recovery = undefined;
        return { ok: true };
      } catch {
        return { ok: false, reason: 'unavailable' };
      }
    },
    flushPendingNotes,
    queueNotes,
    getRecovery: () => recovery,
  };
}
