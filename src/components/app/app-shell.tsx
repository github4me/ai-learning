'use client';
/* oxlint-disable typescript/unbound-method -- Zustand actions are stable function values. */

import * as React from 'react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { Course } from '@/src/content/schema';
import { getCourse } from '@/src/content/course-runtime';
import { selectCourseProgress } from '@/src/learning/learning-store';
import {
  useFlushPendingNotes,
  useOptionalLearningStore,
} from '@/src/components/providers';
import { CourseNavigation } from './course-navigation';
import { UtilityBar, type CourseProgress } from './utility-bar';

type ActiveModal = 'none' | 'navigation' | 'study' | 'settings' | 'search';

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
}: AppShellProps) {
  const course = injectedCourse ?? getCourse();
  const [activeModal, setActiveModal] = React.useState<ActiveModal>('none');
  const utilitySearchRef = React.useRef<HTMLButtonElement>(null);
  const searchReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const flushPendingNotes = useFlushPendingNotes();
  const learningState = useOptionalLearningStore((state) => state);
  const setPreference = useOptionalLearningStore(
    (state) => state.setPreference,
  );
  const [focusMessage, setFocusMessage] = React.useState('');
  const activeUnit = course.units.find((unit) => unit.id === currentUnitId);
  const resolvedCompleted =
    completedSectionIds ??
    (learningState
      ? [
          ...learningState.completedSectionIds,
          ...learningState.appendixReadSectionIds,
        ]
      : []);
  const resolvedProgress =
    courseProgress ??
    (learningState
      ? selectCourseProgress(learningState, course)
      : { completed: 0, total: 0, percent: 0 });
  const closeModal = () => setActiveModal('none');
  const changeModal = (surface: Exclude<ActiveModal, 'none'>, open: boolean) =>
    setActiveModal((current) =>
      open ? surface : current === surface ? 'none' : current,
    );
  const handleNavigate = React.useCallback(
    (target: { unitId: string; sectionId?: string }) => {
      flushPendingNotes();
      onNavigate?.(target);
    },
    [flushPendingNotes, onNavigate],
  );
  const handleContentNavigation = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target instanceof Element && event.target.closest('a[href]')) {
        flushPendingNotes();
      }
    },
    [flushPendingNotes],
  );
  const showNavigation = () => setActiveModal('navigation');
  const showStudy = () => setActiveModal('study');
  const showSettings = () => {
    setActiveModal('settings');
    onOpenSettings?.();
  };
  const showSearch = React.useCallback(() => {
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    searchReturnFocusRef.current = activeElement?.closest(
      '[data-slot="sheet-content"]',
    )
      ? utilitySearchRef.current
      : (activeElement ?? utilitySearchRef.current);
    onOpenSearch?.();
    setActiveModal('search');
  }, [onOpenSearch]);

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
      searchReturnFocusRef.current = utilitySearchRef.current;
      onOpenSearch?.();
      setActiveModal('search');
    }
    document.addEventListener('keydown', handleSearchShortcut);
    return () => document.removeEventListener('keydown', handleSearchShortcut);
  }, [onOpenSearch]);

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
        activeModal !== 'none' ||
        !learningState?.preferences.focusMode
      )
        return;
      event.preventDefault();
      exitFocusMode();
    }
    document.addEventListener('keydown', handleFocusEscape);
    return () => document.removeEventListener('keydown', handleFocusEscape);
  }, [activeModal, exitFocusMode, learningState?.preferences.focusMode]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lesson-content">
        Skip to lesson content
      </a>
      <aside className="workspace-rail full-rail" aria-label="Course workspace">
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
      <aside
        className="workspace-rail compact-rail"
        aria-label="Compact course workspace"
      >
        <CourseNavigation
          key={currentUnitId ?? 'course-overview'}
          course={course}
          mode="compact"
          currentUnitId={currentUnitId}
          currentSectionId={currentSectionId}
          completedSectionIds={resolvedCompleted}
          onNavigate={handleNavigate}
        />
      </aside>
      <section className="workspace">
        <UtilityBar
          currentWeek={
            activeUnit?.kind === 'week' ? activeUnit.weekNumber : undefined
          }
          courseProgress={resolvedProgress}
          onOpenNavigation={showNavigation}
          onOpenSearch={showSearch}
          onOpenSettings={showSettings}
          onOpenStudy={showStudy}
          onBeforeNavigate={flushPendingNotes}
          searchTriggerRef={utilitySearchRef}
          focusMode={learningState?.preferences.focusMode}
          onExitFocusMode={exitFocusMode}
        />
        <main
          id="lesson-content"
          tabIndex={-1}
          className="lesson-content"
          onClickCapture={handleContentNavigation}
        >
          {children}
        </main>
      </section>
      <output className="sr-only" aria-live="polite">
        {focusMessage}
      </output>
      <Sheet
        open={activeModal === 'navigation'}
        onOpenChange={(open) => changeModal('navigation', open)}
      >
        {activeModal === 'navigation' && (
          <SheetContent
            side="left"
            className="mobile-sheet"
            aria-label="Course contents"
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
              onNavigate={(target) => {
                handleNavigate(target);
                closeModal();
              }}
              onBeforeNavigate={flushPendingNotes}
              onOpenSearch={showSearch}
            />
          </SheetContent>
        )}
      </Sheet>
      <Sheet
        open={activeModal === 'study'}
        onOpenChange={(open) => changeModal('study', open)}
      >
        {activeModal === 'study' && (
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
                  />
                </React.Suspense>
              )}
            </div>
          </SheetContent>
        )}
      </Sheet>
      <Sheet
        open={activeModal === 'settings'}
        onOpenChange={(open) => changeModal('settings', open)}
      >
        {activeModal === 'settings' && (
          <SheetContent
            side="right"
            className="study-sheet"
            aria-label="Reading settings"
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
      {activeModal === 'search' && (
        <React.Suspense
          fallback={<output className="search-loading">Loading search…</output>}
        >
          <SearchPalette
            open={activeModal === 'search'}
            onOpenChange={(open) => changeModal('search', open)}
            returnFocusRef={searchReturnFocusRef}
          />
        </React.Suspense>
      )}
    </div>
  );
}
