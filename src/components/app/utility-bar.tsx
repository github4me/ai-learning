'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

import {
  BookOpenText,
  FileText,
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
  courseProgress,
  onOpenNavigation,
  onOpenSearch,
  onOpenSettings,
  onOpenStudy,
  onBeforeNavigate,
  searchTriggerRef,
  focusMode = false,
  onExitFocusMode,
}: {
  currentWeek?: number;
  courseProgress: CourseProgress;
  onOpenNavigation: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  onOpenStudy: () => void;
  onBeforeNavigate?: () => void;
  searchTriggerRef?: Ref<HTMLButtonElement>;
  focusMode?: boolean;
  onExitFocusMode?: () => void;
}) {
  const progressLabel = `Course progress: ${courseProgress.completed} of ${courseProgress.total} sections (${courseProgress.percent}%)`;
  return (
    <header className="utility-bar" aria-label="Course utilities">
      <button
        type="button"
        className="utility-button mobile-navigation-trigger"
        aria-label="Open course navigation"
        onClick={onOpenNavigation}
      >
        <Menu aria-hidden="true" />
      </button>
      <p className="current-week">
        {currentWeek ? `Current: Week ${currentWeek}` : 'Course overview'}
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
          <a
            className="utility-button"
            aria-label="View original PDF"
            href="/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf"
            onClick={onBeforeNavigate}
          >
            <FileText aria-hidden="true" />
          </a>
          <button
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
