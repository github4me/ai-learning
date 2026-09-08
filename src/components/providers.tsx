'use client';

import * as React from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { useShallow } from 'zustand/react/shallow';

import type { Course } from '@/src/content/schema';
import { CourseLocaleContext, type CourseLocaleContextValue } from './course-locale';
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

const emptySubscribe = () => () => undefined;
const emptySnapshot = () => undefined;

export function Providers({
  course,
  locale = 'zh',
  glossary = [],
  untranslatedCount = 0,
  store,
  children,
}: {
  course?: Course;
  locale?: CourseLocaleContextValue['locale'];
  glossary?: CourseLocaleContextValue['glossary'];
  untranslatedCount?: number;
  store?: StoreApi<LearningStore>;
  children: React.ReactNode;
}) {
  if (!course) throw new Error('Providers requires the server-selected course');
  const resolvedCourse = course;
  const localeContext = React.useMemo(() => ({
    course: resolvedCourse, locale, glossary, untranslatedCount,
  }), [resolvedCourse, locale, glossary, untranslatedCount]);
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
        recovery: learning.adapter.getRecoveryRecord(),
      });
    } catch {
      // The adapter remains usable in memory when the browser denies storage access.
    }
    return () => learning.adapter?.dispose();
  }, [learning]);

  React.useEffect(() => {
    const applyPreferences = (preferences: LearningStore['preferences']) => {
      const root = document.documentElement;
      root.dataset.theme = preferences.theme;
      root.dataset.fontSize = preferences.fontSize;
      root.dataset.lineWidth = preferences.lineWidth;
      root.dataset.focusMode = String(preferences.focusMode);
    };
    let appliedPreferences = learning.store.getState().preferences;
    applyPreferences(appliedPreferences);
    return learning.store.subscribe((state) => {
      if (
        state.preferences.theme === appliedPreferences.theme &&
        state.preferences.fontSize === appliedPreferences.fontSize &&
        state.preferences.lineWidth === appliedPreferences.lineWidth &&
        state.preferences.focusMode === appliedPreferences.focusMode
      )
        return;
      appliedPreferences = state.preferences;
      applyPreferences(appliedPreferences);
    });
  }, [learning.store]);

  return (
    <CourseLocaleContext.Provider value={localeContext}>
    <LearningStoreContext.Provider value={learning.store}>
      {children}
    </LearningStoreContext.Provider>
    </CourseLocaleContext.Provider>
  );
}

export function useLearningStore<T>(selector: (state: LearningStore) => T): T {
  const store = React.useContext(LearningStoreContext);
  if (!store) throw new Error('useLearningStore must be used inside Providers');
  const stableSelector = useShallow(selector);
  return React.useSyncExternalStore(
    store.subscribe,
    () => stableSelector(store.getState()),
    () => stableSelector(store.getInitialState()),
  );
}

export function useOptionalLearningStore<T>(
  selector: (state: LearningStore) => T,
): T | undefined {
  const store = React.useContext(LearningStoreContext);
  const stableSelector = useShallow((state: LearningStore | undefined) =>
    state === undefined ? undefined : selector(state),
  );
  return React.useSyncExternalStore(
    store?.subscribe ?? emptySubscribe,
    store ? () => stableSelector(store.getState()) : emptySnapshot,
    store ? () => stableSelector(store.getInitialState()) : emptySnapshot,
  );
}

export function useFlushPendingNotes(): () => void {
  const store = React.useContext(LearningStoreContext);
  return React.useCallback(() => {
    store?.getState().flushPendingNotes();
  }, [store]);
}
