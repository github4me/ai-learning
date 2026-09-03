'use client';

import {
  BookOpenText,
  Menu,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import type { Ref } from 'react';

export type CourseProgress = {
  completed: number;
  total: number;
  percent: number;
};

export function UtilityBar({
  currentWeek,
  currentContextLabel,
  courseProgress,
  onOpenNavigation,
  onOpenSearch,
  onOpenSettings,
  onOpenStudy,
  searchTriggerRef,
  navigationTriggerRef,
  settingsTriggerRef,
  focusMode = false,
  onExitFocusMode,
}: {
  currentWeek?: number;
  currentContextLabel?: string;
  courseProgress: CourseProgress;
  onOpenNavigation: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenStudy: () => void;
  searchTriggerRef?: Ref<HTMLButtonElement>;
  navigationTriggerRef?: Ref<HTMLButtonElement>;
  settingsTriggerRef?: Ref<HTMLButtonElement>;
  focusMode?: boolean;
  onExitFocusMode?: () => void;
}) {
  const progressLabel = `Course progress: ${courseProgress.completed} of ${courseProgress.total} sections (${courseProgress.percent}%)`;
  return (
    <header className="utility-bar" aria-label="Course utilities">
      <button
        ref={navigationTriggerRef}
        type="button"
        className="utility-button mobile-navigation-trigger"
        aria-label="Open course navigation"
        onClick={onOpenNavigation}
      >
        <Menu aria-hidden="true" />
      </button>
      <p className="current-week">
        Current:{' '}
        {currentContextLabel ??
          (currentWeek ? `Week ${currentWeek}` : 'Course overview')}
      </p>
      {focusMode ? (
        <button
          type="button"
          className="utility-button exit-focus-button"
          onClick={onExitFocusMode}
        >
          <X aria-hidden="true" /> Exit focus mode
        </button>
      ) : (
        <div className="utility-actions">
          <button
            ref={searchTriggerRef}
            type="button"
            className="utility-button"
            aria-label="Search course"
            onClick={onOpenSearch}
          >
            <Search aria-hidden="true" />
          </button>
          <span className="course-progress" aria-label={progressLabel}>
            <BookOpenText aria-hidden="true" />
            {courseProgress.percent}%
          </span>
          <button
            ref={settingsTriggerRef}
            type="button"
            className="utility-button"
            aria-label="Reading settings"
            onClick={onOpenSettings}
          >
            <Settings2 aria-hidden="true" />
          </button>
          <button
            type="button"
            className="utility-button"
            aria-label="Open study tools"
            onClick={onOpenStudy}
          >
            Study
          </button>
        </div>
      )}
    </header>
  );
}
