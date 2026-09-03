'use client';
/* oxlint-disable typescript/unbound-method -- Zustand actions are stable function values. */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Course } from '@/src/content/schema';
import { getCourse } from '@/src/content/course-runtime';
import { findSection } from '@/src/content/load-course';
import { selectCourseProgress } from '@/src/learning/learning-store';
import { requestSectionAnchorFocus } from '@/src/search/search-focus';
import {
  useFlushPendingNotes,
  useOptionalLearningStore,
} from '@/src/components/providers';
import { CourseNavigation } from './course-navigation';
import { UtilityBar, type CourseProgress } from './utility-bar';

type ModalSurface = 'navigation' | 'study' | 'settings' | 'search';
type ActiveSurface = 'none' | ModalSurface | `compact:${string}`;
type PersistentNavigationMode = 'full' | 'compact' | 'mobile';

function subscribeToNavigationMode(onStoreChange: () => void) {
  const compactQuery = window.matchMedia('(min-width: 1024px)');
  const fullQuery = window.matchMedia('(min-width: 1280px)');
  compactQuery.addEventListener('change', onStoreChange);
  fullQuery.addEventListener('change', onStoreChange);
  return () => {
    compactQuery.removeEventListener('change', onStoreChange);
    fullQuery.removeEventListener('change', onStoreChange);
  };
}

function getNavigationMode(): PersistentNavigationMode {
  if (window.matchMedia('(min-width: 1280px)').matches) return 'full';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'compact';
  return 'mobile';
}

function getServerNavigationMode(): PersistentNavigationMode {
  return 'full';
}

const SearchPalette = React.lazy(
  () => import('@/src/components/search/search-palette'),
);
const StudyDrawer = React.lazy(() =>
  import('@/src/components/learning/study-drawer').then((module) => ({
    default: module.StudyDrawer,
  })),
);
const ReadingSettings = React.lazy(() =>
  import('@/src/components/settings/reading-settings').then((module) => ({
    default: module.ReadingSettings,
  })),
);

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
  );
}

function isApplicationRoute(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/review' ||
    pathname === '/appendix/mini-gpt' ||
    /^\/week\/[^/]+\/?$/u.test(pathname)
  );
}

function decodeFragment(hash: string): string | undefined {
  if (!hash.startsWith('#') || hash.length === 1) return undefined;
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

export type AppShellProps = {
  course?: Course;
  children: React.ReactNode;
  currentUnitId?: string;
  currentSectionId?: string;
  completedSectionIds?: readonly string[];
  courseProgress?: CourseProgress;
  onNavigate?: (target: { unitId: string; sectionId?: string }) => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  settingsContent?: React.ReactNode;
  studyContent?: React.ReactNode;
  currentContextLabel?: string;
};

export function AppShell({
  course: injectedCourse,
  children,
  currentUnitId,
  currentSectionId,
  completedSectionIds,
  courseProgress,
  onNavigate,
  onOpenSearch,
  onOpenSettings,
  settingsContent,
  studyContent,
  currentContextLabel: injectedContextLabel,
}: AppShellProps) {
  const router = useRouter();
  const course = injectedCourse ?? getCourse();
  const [activeSurface, setActiveSurface] =
    React.useState<ActiveSurface>('none');
  const compactReturnFocusRef = React.useRef<HTMLButtonElement>(null);
  const mobileNavigationTriggerRef = React.useRef<HTMLButtonElement>(null);
  const utilitySearchRef = React.useRef<HTMLButtonElement>(null);
  const utilitySettingsRef = React.useRef<HTMLButtonElement>(null);
  const searchReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const settingsReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const flushPendingNotes = useFlushPendingNotes();
  const learningSnapshot = useOptionalLearningStore((state) => ({
    completedSectionIds: state.completedSectionIds,
    appendixReadSectionIds: state.appendixReadSectionIds,
    focusMode: state.preferences.focusMode,
  }));
  const setPreference = useOptionalLearningStore(
    (state) => state.setPreference,
  );
  const navigationMode = React.useSyncExternalStore(
    subscribeToNavigationMode,
    getNavigationMode,
    getServerNavigationMode,
  );
  const [focusMessage, setFocusMessage] = React.useState('');
  const activeUnit = course.units.find((unit) => unit.id === currentUnitId);
  const resolvedCompleted = React.useMemo(
    () =>
      completedSectionIds ??
      (learningSnapshot
        ? [
            ...learningSnapshot.completedSectionIds,
            ...learningSnapshot.appendixReadSectionIds,
          ]
        : []),
    [completedSectionIds, learningSnapshot],
  );
  const resolvedProgress = React.useMemo(
    () =>
      courseProgress ??
      (learningSnapshot
        ? selectCourseProgress(learningSnapshot, course)
        : { completed: 0, total: 0, percent: 0 }),
    [course, courseProgress, learningSnapshot],
  );
  const currentContextLabel =
    injectedContextLabel ??
    (activeUnit?.kind === 'week'
      ? `Week ${activeUnit.weekNumber}`
      : activeUnit?.kind === 'appendix'
        ? 'Appendix A'
        : 'Course overview');
  const changeModal = (surface: ModalSurface, open: boolean) =>
    setActiveSurface((current) =>
      open ? surface : current === surface ? 'none' : current,
    );
  const compactOpenUnitId = activeSurface.startsWith('compact:')
    ? activeSurface.slice('compact:'.length)
    : undefined;
  const handleNavigate = React.useCallback(
    (target: { unitId: string; sectionId?: string }) => {
      flushPendingNotes();
      onNavigate?.(target);
    },
    [flushPendingNotes, onNavigate],
  );
  const handleApplicationNavigation = React.useCallback(
    (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      )
        return;
      const anchor = event.target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target.toLowerCase() !== '_self')
      )
        return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (
        destination.origin !== window.location.origin ||
        !isApplicationRoute(destination.pathname)
      )
        return;

      flushPendingNotes();
      const current = window.location;
      if (
        destination.pathname === current.pathname &&
        destination.search === current.search
      )
        return;

      const requested = decodeFragment(destination.hash);
      const section = requested ? findSection(course, requested) : undefined;
      if (section) requestSectionAnchorFocus(section.id, event);
      event.preventDefault();
      setActiveSurface('none');
      router.push(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    },
    [course, flushPendingNotes, router],
  );
  React.useEffect(() => {
    document.addEventListener('click', handleApplicationNavigation);
    return () =>
      document.removeEventListener('click', handleApplicationNavigation);
  }, [handleApplicationNavigation]);
  const showNavigation = React.useCallback(
    () => setActiveSurface('navigation'),
    [],
  );
  const closeActiveSurface = React.useCallback(
    () => setActiveSurface('none'),
    [],
  );
  const showStudy = React.useCallback(() => setActiveSurface('study'), []);
  const showSettings = React.useCallback(() => {
    settingsReturnFocusRef.current =
      navigationMode === 'mobile'
        ? mobileNavigationTriggerRef.current
        : utilitySettingsRef.current;
    setActiveSurface('settings');
    onOpenSettings?.();
  }, [navigationMode, onOpenSettings]);
  const showSearch = React.useCallback(() => {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    searchReturnFocusRef.current =
      navigationMode === 'mobile' ||
      activeElement?.closest('[data-slot="sheet-content"]')
        ? mobileNavigationTriggerRef.current
        : (activeElement ?? utilitySearchRef.current);
    onOpenSearch?.();
    setActiveSurface('search');
  }, [navigationMode, onOpenSearch]);

  React.useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      if (
        event.key.toLowerCase() !== 'k' ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        isEditableTarget(event.target)
      )
        return;
      event.preventDefault();
      searchReturnFocusRef.current =
        navigationMode === 'mobile'
          ? mobileNavigationTriggerRef.current
          : utilitySearchRef.current;
      onOpenSearch?.();
      setActiveSurface('search');
    }
    document.addEventListener('keydown', handleSearchShortcut);
    return () => document.removeEventListener('keydown', handleSearchShortcut);
  }, [navigationMode, onOpenSearch]);

  const exitFocusMode = React.useCallback(() => {
    if (!setPreference) return;
    const result = setPreference('focusMode', false);
    setFocusMessage(
      result.ok
        ? 'Focus mode exited.'
        : 'Focus mode exited for this session, but the preference could not be saved locally.',
    );
    window.requestAnimationFrame(() => {
      document.getElementById('lesson-content')?.focus();
    });
  }, [setPreference]);

  React.useEffect(() => {
    function handleFocusEscape(event: KeyboardEvent) {
      if (
        event.key !== 'Escape' ||
        activeSurface !== 'none' ||
        !learningSnapshot?.focusMode
      )
        return;
      event.preventDefault();
      exitFocusMode();
    }
    document.addEventListener('keydown', handleFocusEscape);
    return () => document.removeEventListener('keydown', handleFocusEscape);
  }, [activeSurface, exitFocusMode, learningSnapshot?.focusMode]);

  const handleCompactNavigate = React.useCallback(
    (target: { unitId: string; sectionId?: string }) => {
      handleNavigate(target);
      setActiveSurface('none');
    },
    [handleNavigate],
  );
  const handleMobileNavigate = React.useCallback(
    (target: { unitId: string; sectionId?: string }) => {
      handleNavigate(target);
      setActiveSurface('none');
    },
    [handleNavigate],
  );
  const handleCompactOpenChange = React.useCallback(
    (unitId: string | undefined, trigger: HTMLButtonElement) => {
      compactReturnFocusRef.current = trigger;
      setActiveSurface(unitId ? `compact:${unitId}` : 'none');
      if (!unitId) window.requestAnimationFrame(() => trigger.focus());
    },
    [],
  );

  React.useEffect(() => {
    function handleCompactNavigationEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !activeSurface.startsWith('compact:'))
        return;
      event.preventDefault();
      setActiveSurface('none');
      window.requestAnimationFrame(() =>
        compactReturnFocusRef.current?.focus(),
      );
    }
    document.addEventListener('keydown', handleCompactNavigationEscape);
    return () =>
      document.removeEventListener('keydown', handleCompactNavigationEscape);
  }, [activeSurface]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lesson-content">
        Skip to lesson content
      </a>
      {navigationMode === 'full' && (
        <aside
          className="workspace-rail full-rail"
          aria-label="Course workspace"
        >
          <CourseNavigation
            course={course}
            currentUnitId={currentUnitId}
            currentSectionId={currentSectionId}
            completedSectionIds={resolvedCompleted}
            courseProgress={resolvedProgress}
            onNavigate={handleNavigate}
            onBeforeNavigate={flushPendingNotes}
            onOpenSearch={showSearch}
          />
        </aside>
      )}
      {navigationMode === 'compact' && (
        <aside
          className="workspace-rail compact-rail"
          aria-label="Compact course workspace"
        >
          <CourseNavigation
            course={course}
            mode="compact"
            currentUnitId={currentUnitId}
            currentSectionId={currentSectionId}
            completedSectionIds={resolvedCompleted}
            onNavigate={handleCompactNavigate}
            onBeforeNavigate={flushPendingNotes}
            compactOpenUnitId={compactOpenUnitId}
            onCompactOpenChange={handleCompactOpenChange}
          />
        </aside>
      )}
      <section className="workspace">
        <UtilityBar
          currentWeek={
            activeUnit?.kind === 'week' ? activeUnit.weekNumber : undefined
          }
          currentContextLabel={currentContextLabel}
          courseProgress={resolvedProgress}
          onOpenNavigation={showNavigation}
          onOpenSearch={showSearch}
          onOpenSettings={showSettings}
          onOpenStudy={showStudy}
          onBeforeNavigate={flushPendingNotes}
          searchTriggerRef={utilitySearchRef}
          focusMode={learningSnapshot?.focusMode}
          onExitFocusMode={exitFocusMode}
          navigationTriggerRef={mobileNavigationTriggerRef}
          settingsTriggerRef={utilitySettingsRef}
        />
        <main id="lesson-content" tabIndex={-1} className="lesson-content">
          {children}
        </main>
      </section>
      <output className="sr-only" aria-live="polite">
        {focusMessage}
      </output>
      <Sheet
        open={activeSurface === 'navigation'}
        onOpenChange={(open) => changeModal('navigation', open)}
      >
        {activeSurface === 'navigation' && (
          <SheetContent
            side="left"
            className="mobile-sheet"
            aria-label="Course contents"
            finalFocus={mobileNavigationTriggerRef}
          >
            <SheetHeader>
              <SheetTitle>Course contents</SheetTitle>
            </SheetHeader>
            <CourseNavigation
              course={course}
              mode="mobile"
              currentUnitId={currentUnitId}
              currentSectionId={currentSectionId}
              completedSectionIds={resolvedCompleted}
              onNavigate={handleMobileNavigate}
              onBeforeNavigate={flushPendingNotes}
              onOpenSearch={showSearch}
              onOpenSettings={showSettings}
            />
          </SheetContent>
        )}
      </Sheet>
      <Sheet
        open={activeSurface === 'study'}
        onOpenChange={(open) => changeModal('study', open)}
      >
        {activeSurface === 'study' && (
          <SheetContent
            side="right"
            className="study-sheet"
            aria-label="Study tools"
          >
            <SheetHeader>
              <SheetTitle>Study tools</SheetTitle>
            </SheetHeader>
            <div className="study-sheet-content">
              {studyContent ?? (
                <React.Suspense fallback={<p>Loading study tools…</p>}>
                  <StudyDrawer
                    activeSectionId={currentSectionId}
                    course={course}
                    onSectionNavigate={closeActiveSurface}
                  />
                </React.Suspense>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
      <Sheet
        open={activeSurface === 'settings'}
        onOpenChange={(open) => changeModal('settings', open)}
      >
        {activeSurface === 'settings' && (
          <SheetContent
            side="right"
            className="study-sheet"
            aria-label="Reading settings"
            finalFocus={settingsReturnFocusRef}
          >
            <SheetHeader>
              <SheetTitle>Reading settings</SheetTitle>
            </SheetHeader>
            <div className="study-sheet-content">
              {settingsContent ?? (
                <React.Suspense fallback={<p>Loading reading settings…</p>}>
                  <ReadingSettings />
                </React.Suspense>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
      {activeSurface === 'search' && (
        <React.Suspense
          fallback={<output className="search-loading">Loading search…</output>}
        >
          <SearchPalette
            open={activeSurface === 'search'}
            onOpenChange={(open) => changeModal('search', open)}
            returnFocusRef={searchReturnFocusRef}
          />
        </React.Suspense>
      )}
    </div>
  );
}
