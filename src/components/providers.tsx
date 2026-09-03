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
    learning.store.setState(
      learning.adapter.hydrateStorage(window.localStorage, () => new Date()),
    );
  }, [learning]);

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
