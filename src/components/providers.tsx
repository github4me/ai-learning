'use client'

import * as React from 'react'
import type { StoreApi } from 'zustand/vanilla'

import type { Course } from '@/src/content/schema'
import { createLearningStore, type LearningStore } from '@/src/learning/learning-store'
import { createStorageAdapter } from '@/src/learning/storage-adapter'

const LearningStoreContext = React.createContext<StoreApi<LearningStore> | null>(null)

export function Providers({
  course,
  store,
  children,
}: {
  course: Course
  store?: StoreApi<LearningStore>
  children: React.ReactNode
}) {
  const [learningStore] = React.useState<StoreApi<LearningStore>>(() =>
    store ?? createLearningStore({
      course,
      adapter: createStorageAdapter({
        contentVersion: course.version,
        storage: typeof window === 'undefined' ? undefined : window.localStorage,
      }),
    }),
  )

  return <LearningStoreContext.Provider value={learningStore}>{children}</LearningStoreContext.Provider>
}

export function useLearningStore<T>(selector: (state: LearningStore) => T): T {
  const store = React.useContext(LearningStoreContext)
  if (!store) throw new Error('useLearningStore must be used inside Providers')
  return React.useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()))
}

export function useOptionalLearningStore<T>(selector: (state: LearningStore) => T): T | undefined {
  const store = React.useContext(LearningStoreContext)
  return React.useSyncExternalStore(
    store?.subscribe ?? (() => () => undefined),
    () => (store ? selector(store.getState()) : undefined),
    () => (store ? selector(store.getState()) : undefined),
  )
}
