'use client';

import * as React from 'react';
import type { StoreApi } from 'zustand/vanilla';

import type { Course } from '@/src/content/schema';
import { getCourse } from '@/src/content/course-runtime';
import {
  createLearningStore,
  type LearningStore,
} from '@/src/learning/learning-store';
import {
  createStorageAdapter,
  type HydratableStorageAdapter,
} from '@/src/learning/storage-adapter';

const LearningStoreContext =
  React.createContext<StoreApi<LearningStore> | null>(null);

export function Providers({
  course,
  store,
  children,
}: {
  course?: Course;
  store?: StoreApi<LearningStore>;
  children: React.ReactNode;
}) {
  const resolvedCourse = course ?? getCourse();
  const [learning] = React.useState<{
    store: StoreApi<LearningStore>;
    adapter?: HydratableStorageAdapter;
  }>(() => {
    if (store) return { store };
    const adapter = createStorageAdapter({
      contentVersion: resolvedCourse.version,
      clock: () => new Date(0),
    });
    return {
      store: createLearningStore({ course: resolvedCourse, adapter }),
      adapter,
    };
  });

  React.useEffect(() => {
    if (!learning.adapter) return;
    try {
      learning.store.setState({
        ...learning.adapter.hydrateStorage(
          window.localStorage,
          () => new Date(),
        ),
        recoveryPayload: learning.adapter.getRecovery(),
      });
    } catch {
      // The adapter remains usable in memory when the browser denies storage access.
    }
    return () => learning.adapter?.dispose();
  }, [learning]);

  React.useEffect(() => {
    const applyPreferences = () => {
      const { preferences } = learning.store.getState();
      const root = document.documentElement;
      root.dataset.theme = preferences.theme;
      root.dataset.fontSize = preferences.fontSize;
      root.dataset.lineWidth = preferences.lineWidth;
      root.dataset.focusMode = String(preferences.focusMode);
    };
    applyPreferences();
    return learning.store.subscribe(applyPreferences);
  }, [learning.store]);

  return (
    <LearningStoreContext.Provider value={learning.store}>
      {children}
    </LearningStoreContext.Provider>
  );
}

export function useLearningStore<T>(selector: (state: LearningStore) => T): T {
  const store = React.useContext(LearningStoreContext);
  if (!store) throw new Error('useLearningStore must be used inside Providers');
  return React.useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

export function useOptionalLearningStore<T>(
  selector: (state: LearningStore) => T,
): T | undefined {
  const store = React.useContext(LearningStoreContext);
  return React.useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    () => (store ? selector(store.getState()) : undefined),
    () => (store ? selector(store.getState()) : undefined),
  );
}

export function useFlushPendingNotes(): () => void {
  const store = React.useContext(LearningStoreContext);
  return React.useCallback(() => {
    store?.getState().flushPendingNotes();
  }, [store]);
}
