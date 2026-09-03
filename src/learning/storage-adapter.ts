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

export type StorageFailureReason = 'quota' | 'unavailable' | 'invalid';
export type RecoveryRecord =
  | { kind: 'corrupt-load'; reason: 'invalid'; payload: string }
  | {
      kind: 'failed-write';
      reason: StorageFailureReason;
      payload: string;
    }
  | {
      kind: 'failed-import';
      reason: Exclude<StorageFailureReason, 'invalid'>;
      payload: string;
    };

export type PersistResult =
  | { ok: true }
  | {
      ok: false;
      reason: StorageFailureReason;
      recovery?: Extract<RecoveryRecord, { kind: 'failed-write' }>;
      recoverablePayload?: string;
    };
export type ImportResult =
  | { ok: true; state: LearningStateV1 }
  | {
      ok: false;
      reason: Exclude<StorageFailureReason, 'invalid'>;
      recovery: Extract<RecoveryRecord, { kind: 'failed-import' }>;
      recoverablePayload: string;
    };

export interface StorageAdapter {
  load(): LearningStateV1;
  persist(state: LearningStateV1): PersistResult;
  previewImport(serialized: string): LearningStateV1;
  import(serialized: string): ImportResult;
  export(state: LearningStateV1): string;
  reset(): PersistResult;
  flushPendingNotes(): PersistResult;
  queueNotes(state: LearningStateV1): void;
  subscribeNotePersistence(
    listener: (result: PersistResult) => void,
  ): () => void;
  /** Returns the raw payload for compatibility with non-UI adapter consumers. */
  getRecovery(): string | undefined;
  getRecoveryRecord(): RecoveryRecord | undefined;
  dismissRecovery(): void;
}

export interface HydratableStorageAdapter extends StorageAdapter {
  hydrateStorage(storage: Storage, clock?: () => Date): LearningStateV1;
  dispose(): void;
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
  return Object.values(state.notesBySection).every(
    (note) => Array.from(note.text).length <= MAX_NOTE_CODE_POINTS,
  );
}

export function createStorageAdapter(
  options: Options,
): HydratableStorageAdapter {
  let storage = options.storage;
  const aliases = options.aliases ?? {};
  let clock = options.clock ?? (() => new Date());
  const initial = () =>
    createInitialLearningState(options.contentVersion, clock().toISOString());
  let current = initial();
  let hydrated = false;
  let available = storage !== undefined;
  let recovery: RecoveryRecord | undefined;
  let pending: LearningStateV1 | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let listening = false;
  const noteListeners = new Set<(result: PersistResult) => void>();

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
    if (!storage || !available)
      return {
        ok: false,
        reason: 'unavailable',
        recovery: {
          kind: 'failed-write',
          reason: 'unavailable',
          payload: serialized,
        },
        recoverablePayload: serialized,
      };
    try {
      storage.setItem(LEARNING_STATE_KEY, serialized);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        reason: isQuota(error) ? 'quota' : 'unavailable',
        recovery: {
          kind: 'failed-write',
          reason: isQuota(error) ? 'quota' : 'unavailable',
          payload: serialized,
        },
        recoverablePayload: serialized,
      };
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
      current = parseLearningState(
        JSON.parse(serialized),
        options.contentVersion,
        aliases,
      );
    } catch {
      recovery = {
        kind: 'corrupt-load',
        reason: 'invalid',
        payload: serialized,
      };
      current = initial();
    }
    return current;
  };
  const flushPendingNotes = (): PersistResult => {
    clearTimer();
    if (!pending) return { ok: true };
    const candidate = pending;
    pending = undefined;
    const result = persist(candidate);
    noteListeners.forEach((listener) => listener(result));
    return result;
  };
  const persist = (state: LearningStateV1): PersistResult => {
    load();
    const supersedesPendingNotes = pending !== undefined;
    if (supersedesPendingNotes) {
      clearTimer();
      pending = undefined;
    }
    const serialized = validate(state);
    if (!serialized) {
      const payload = JSON.stringify(state);
      const result: PersistResult = {
        ok: false,
        reason: 'invalid',
        recovery: { kind: 'failed-write', reason: 'invalid', payload },
        recoverablePayload: payload,
      };
      current = state;
      recovery = result.recovery;
      if (supersedesPendingNotes)
        noteListeners.forEach((listener) => listener(result));
      return result;
    }
    const result = write(serialized);
    if (!result.ok) recovery = result.recovery;
    else if (recovery?.kind === 'failed-write') recovery = undefined;
    current = state;
    if (supersedesPendingNotes)
      noteListeners.forEach((listener) => listener(result));
    return result;
  };
  const queueNotes = (state: LearningStateV1): void => {
    pending = state;
    clearTimer();
    timer = setTimeout(() => {
      flushPendingNotes();
    }, 350);
  };

  const previewImport = (serialized: string): LearningStateV1 => {
    load();
    if (new TextEncoder().encode(serialized).byteLength > MAX_IMPORT_BYTES)
      throw new Error('Import exceeds 5 MiB limit');
    let candidate: LearningStateV1;
    try {
      candidate = parseLearningState(
        JSON.parse(serialized),
        options.contentVersion,
        aliases,
      );
    } catch (error) {
      if (error instanceof Error && /unsupported/i.test(error.message))
        throw error;
      throw new Error(
        `Invalid learning-state import: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    if (!validate(candidate)) throw new Error('Invalid learning-state import');
    return candidate;
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushPendingNotes();
  };
  const startListening = () => {
    if (listening || typeof window === 'undefined') return;
    window.addEventListener('pagehide', flushPendingNotes);
    window.addEventListener('blur', flushPendingNotes);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    listening = true;
  };
  const dispose = () => {
    flushPendingNotes();
    if (listening) {
      window.removeEventListener('pagehide', flushPendingNotes);
      window.removeEventListener('blur', flushPendingNotes);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      listening = false;
    }
    clearTimer();
  };

  return {
    load,
    hydrateStorage(nextStorage, nextClock) {
      storage = nextStorage;
      clock = nextClock ?? clock;
      available = true;
      hydrated = false;
      startListening();
      return load();
    },
    persist,
    previewImport,
    import(serialized) {
      const candidate = previewImport(serialized);
      const canonical = validate(candidate)!;
      const result = write(canonical);
      if (!result.ok) {
        const importRecovery: Extract<
          RecoveryRecord,
          { kind: 'failed-import' }
        > = {
          kind: 'failed-import',
          reason: result.reason === 'quota' ? 'quota' : 'unavailable',
          payload: canonical,
        };
        recovery = importRecovery;
        return {
          ok: false,
          reason: importRecovery.reason,
          recovery: importRecovery,
          recoverablePayload: canonical,
        };
      }
      clearTimer();
      pending = undefined;
      current = candidate;
      if (recovery?.kind !== 'corrupt-load') recovery = undefined;
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
    subscribeNotePersistence(listener) {
      noteListeners.add(listener);
      return () => noteListeners.delete(listener);
    },
    getRecovery: () => recovery?.payload,
    getRecoveryRecord: () => recovery,
    dismissRecovery() {
      recovery = undefined;
    },
    dispose,
  };
}
