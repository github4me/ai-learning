'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

import { CheckCircle2, Circle } from 'lucide-react';
import * as React from 'react';

import type {
  Course,
  CourseUnit,
  SectionNode,
  WeekUnit,
} from '@/src/content/schema';
import {
  isUnmodifiedPrimaryActivation,
  requestSectionAnchorFocus,
} from '@/src/search/search-focus';

export type CourseNavigationProps = {
  course: Course;
  currentUnitId?: string;
  currentSectionId?: string;
  completedSectionIds?: readonly string[];
  courseProgress?: { completed: number; total: number; percent: number };
  mode?: 'full' | 'compact' | 'mobile';
  onNavigate?: (target: { unitId: string; sectionId?: string }) => void;
  onBeforeNavigate?: () => void;
  onOpenSearch?: () => void;
  onOpenSettings?: () => void;
  compactOpenUnitId?: string;
  onCompactOpenChange?: (
    unitId: string | undefined,
    trigger: HTMLButtonElement,
  ) => void;
};

type CompletionStatus = {
  completed: number;
  total: number;
  isDirectTarget: boolean;
};

function unitPath(unit: CourseUnit): string {
  return unit.kind === 'appendix' ? '/appendix/mini-gpt' : `/week/${unit.slug}`;
}

function completionStatusMap(
  unit: CourseUnit,
  completed: ReadonlySet<string>,
): ReadonlyMap<string, CompletionStatus> {
  const statuses = new Map<string, CompletionStatus>();
  const visit = (section: SectionNode): string[] => {
    const descendantIds = section.children.flatMap(visit);
    const isDirectTarget =
      section.children.length === 0 &&
      (unit.kind === 'appendix' || section.isCompletable);
    const trackedIds = isDirectTarget
      ? [section.id, ...descendantIds]
      : descendantIds;
    if (trackedIds.length > 0) {
      statuses.set(section.id, {
        completed: trackedIds.filter((id) => completed.has(id)).length,
        total: trackedIds.length,
        isDirectTarget,
      });
    }
    return trackedIds;
  };
  visit(unit);
  return statuses;
}

function SectionLinks({
  nodes,
  unit,
  currentSectionId,
  completed,
  completionStatuses,
  onNavigate,
  depth = 0,
}: {
  nodes: readonly SectionNode[];
  unit: CourseUnit;
  currentSectionId?: string;
  completed: ReadonlySet<string>;
  completionStatuses: ReadonlyMap<string, CompletionStatus>;
  onNavigate?: CourseNavigationProps['onNavigate'];
  depth?: number;
}) {
  return (
    <ul className="course-section-list" data-depth={depth}>
      {nodes
        .filter((node) => node.showInToc)
        .map((node) => {
          const isCurrent = node.id === currentSectionId;
          const status = completionStatuses.get(node.id);
          const isComplete =
            status !== undefined && status.completed === status.total;
          const statusLabel = status?.isDirectTarget
            ? unit.kind === 'appendix'
              ? isComplete
                ? 'Read'
                : 'Not read'
              : isComplete
                ? 'Completed'
                : 'Not completed'
            : status
              ? unit.kind === 'appendix'
                ? `${status.completed} of ${status.total} reference sections read`
                : `${status.completed} of ${status.total} sections completed`
              : undefined;
          return (
            <li key={node.id}>
              <a
                className="course-section-link"
                data-current={isCurrent || undefined}
                href={`${unitPath(unit)}#${node.id}`}
                aria-current={isCurrent ? 'location' : undefined}
                onClick={(event) => {
                  requestSectionAnchorFocus(node.id, event);
                  if (isUnmodifiedPrimaryActivation(event))
                    onNavigate?.({ unitId: unit.id, sectionId: node.id });
                }}
              >
                {status &&
                  (isComplete ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <Circle aria-hidden="true" />
                  ))}
                <span>{node.title}</span>
                {isCurrent && (
                  <span className="nav-state">Current section</span>
                )}
                {statusLabel && <span className="sr-only">{statusLabel}</span>}
              </a>
              {node.children.length > 0 && (
                <MemoSectionLinks
                  nodes={node.children}
                  unit={unit}
                  currentSectionId={currentSectionId}
                  completed={completed}
                  completionStatuses={completionStatuses}
                  onNavigate={onNavigate}
                  depth={depth + 1}
                />
              )}
            </li>
          );
        })}
    </ul>
  );
}

const MemoSectionLinks = React.memo(SectionLinks);

function UnitOutline({
  unit,
  currentUnitId,
  currentSectionId,
  completed,
  onNavigate,
}: {
  unit: CourseUnit;
  currentUnitId?: string;
  currentSectionId?: string;
  completed: ReadonlySet<string>;
  onNavigate?: CourseNavigationProps['onNavigate'];
}) {
  const unitLabel =
    unit.kind === 'week' ? `Week ${unit.weekNumber}` : 'Appendix A';
  const current = unit.id === currentUnitId;
  const completionStatuses = React.useMemo(
    () => completionStatusMap(unit, completed),
    [completed, unit],
  );
  const appendixStatus =
    unit.kind === 'appendix' ? completionStatuses.get(unit.id) : undefined;
  const appendixRead =
    appendixStatus !== undefined &&
    appendixStatus.completed === appendixStatus.total;
  return (
    <div className="course-unit" data-current={current || undefined}>
      <a
        className="course-unit-link"
        href={unitPath(unit)}
        aria-current={current ? 'page' : undefined}
        onClick={(event) => {
          if (isUnmodifiedPrimaryActivation(event))
            onNavigate?.({ unitId: unit.id });
        }}
      >
        {unit.kind === 'appendix' &&
          (appendixRead ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          ))}
        <span className="course-unit-kicker">{unitLabel}</span>
        <span>{unit.title}</span>
        {appendixRead && <span className="nav-state">Read</span>}
        {appendixStatus && !appendixRead && (
          <span className="sr-only">
            {appendixStatus.completed} of {appendixStatus.total} reference
            sections read
          </span>
        )}
        {current && <span className="nav-state">Current unit</span>}
      </a>
      <MemoSectionLinks
        nodes={unit.children}
        unit={unit}
        currentSectionId={currentSectionId}
        completed={completed}
        completionStatuses={completionStatuses}
        onNavigate={onNavigate}
      />
    </div>
  );
}

const MemoUnitOutline = React.memo(UnitOutline);

function CompactNavigation({
  course,
  currentUnitId,
  currentSectionId,
  completedSectionIds = [],
  onNavigate,
  onBeforeNavigate,
  compactOpenUnitId,
  onCompactOpenChange,
}: Pick<
  CourseNavigationProps,
  | 'course'
  | 'currentUnitId'
  | 'currentSectionId'
  | 'completedSectionIds'
  | 'onNavigate'
  | 'onBeforeNavigate'
  | 'compactOpenUnitId'
  | 'onCompactOpenChange'
>) {
  const selectedWeek = course.units.find(
    (unit): unit is WeekUnit =>
      unit.kind === 'week' && unit.id === compactOpenUnitId,
  );
  const completed = React.useMemo(
    () => new Set(completedSectionIds),
    [completedSectionIds],
  );
  const panelId = 'compact-week-sections';
  const appendix = course.units.find((unit) => unit.kind === 'appendix');
  return (
    <nav aria-label="Course destinations" className="compact-course-navigation">
      <span className="sr-only" data-testid="signal-path" aria-hidden="true" />
      <ol className="compact-week-list">
        <li>
          <a
            className="compact-destination-link"
            href="/"
            aria-label="Course overview"
            onClick={(event) => {
              if (isUnmodifiedPrimaryActivation(event))
                onNavigate?.({
                  unitId: course.overview.id,
                  sectionId: course.overview.id,
                });
            }}
          >
            <span aria-hidden="true">⌂</span>
          </a>
        </li>
        {course.units
          .filter((unit): unit is WeekUnit => unit.kind === 'week')
          .map((week) => {
            const open = selectedWeek?.id === week.id;
            return (
              <li key={week.id}>
                <button
                  type="button"
                  className="compact-week-button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  aria-label={`Open Week ${week.weekNumber} sections`}
                  onClick={(event) =>
                    onCompactOpenChange?.(
                      open ? undefined : week.id,
                      event.currentTarget,
                    )
                  }
                >
                  {week.weekNumber}
                </button>
              </li>
            );
          })}
        {appendix && (
          <li>
            <a
              className="compact-destination-link"
              href={unitPath(appendix)}
              aria-label="Appendix A reference"
              aria-current={appendix.id === currentUnitId ? 'page' : undefined}
              onClick={(event) => {
                if (isUnmodifiedPrimaryActivation(event))
                  onNavigate?.({ unitId: appendix.id });
              }}
            >
              <span aria-hidden="true">A</span>
            </a>
          </li>
        )}
        <li>
          <a
            className="compact-destination-link"
            href="/review"
            aria-label="Review notes and bookmarks"
            onClick={onBeforeNavigate}
          >
            <span aria-hidden="true">R</span>
          </a>
        </li>
      </ol>
      {selectedWeek && (
        <section
          id={panelId}
          aria-label={`Week ${selectedWeek.weekNumber} sections`}
          className="compact-section-panel"
        >
          <a
            className="course-unit-link"
            href={unitPath(selectedWeek)}
            aria-current={
              selectedWeek.id === currentUnitId ? 'page' : undefined
            }
            onClick={(event) => {
              if (isUnmodifiedPrimaryActivation(event))
                onNavigate?.({ unitId: selectedWeek.id });
            }}
          >
            Week {selectedWeek.weekNumber}: {selectedWeek.title}
            {selectedWeek.id === currentUnitId && (
              <span className="nav-state">Current week</span>
            )}
          </a>
          <MemoSectionLinks
            nodes={selectedWeek.children}
            unit={selectedWeek}
            currentSectionId={currentSectionId}
            completed={completed}
            completionStatuses={completionStatusMap(selectedWeek, completed)}
            onNavigate={onNavigate}
          />
        </section>
      )}
    </nav>
  );
}

export const CourseNavigation = React.memo(function CourseNavigation({
  course,
  currentUnitId,
  currentSectionId,
  completedSectionIds = [],
  courseProgress,
  mode = 'full',
  onNavigate,
  onBeforeNavigate,
  onOpenSearch,
  onOpenSettings,
  compactOpenUnitId,
  onCompactOpenChange,
}: CourseNavigationProps) {
  const completed = React.useMemo(
    () => new Set(completedSectionIds),
    [completedSectionIds],
  );
  if (mode === 'compact') {
    return (
      <CompactNavigation
        course={course}
        currentUnitId={currentUnitId}
        currentSectionId={currentSectionId}
        completedSectionIds={completedSectionIds}
        onNavigate={onNavigate}
        onBeforeNavigate={onBeforeNavigate}
        compactOpenUnitId={compactOpenUnitId}
        onCompactOpenChange={onCompactOpenChange}
      />
    );
  }
  const monthGroups = [
    { label: 'Month 1', weeks: [1, 2, 3, 4] },
    { label: 'Month 2', weeks: [5, 6, 7, 8] },
    { label: 'Month 3', weeks: [9, 10, 11, 12] },
  ];
  const appendix = course.units.find((unit) => unit.kind === 'appendix');
  return (
    <nav
      aria-label="Course contents"
      className={`course-navigation course-navigation-${mode}`}
    >
      <div className="signal-path" data-testid="signal-path" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <a
        className="course-identity"
        href="/"
        onClick={(event) => {
          if (isUnmodifiedPrimaryActivation(event))
            onNavigate?.({
              unitId: course.overview.id,
              sectionId: course.overview.id,
            });
        }}
      >
        <span>AI First Principles</span>
        <small>核心教程深度扩展版</small>
      </a>
      {mode === 'mobile' && (
        <div className="mobile-rail-actions">
          <button
            type="button"
            className="rail-search-button mobile-search-button"
            onClick={onOpenSearch}
            aria-label="Search course"
          >
            Search course / 搜索课程
          </button>
          <button
            type="button"
            className="rail-search-button mobile-settings-button"
            onClick={onOpenSettings}
            aria-label="Reading settings and local data backup"
          >
            Reading settings / 阅读设置
          </button>
        </div>
      )}
      {monthGroups.map(({ label, weeks }) => (
        <section
          key={label}
          className="course-month"
          aria-labelledby={`${label.toLowerCase().replace(' ', '-')}-heading`}
        >
          <p
            id={`${label.toLowerCase().replace(' ', '-')}-heading`}
            className="course-group-label"
          >
            {label}
          </p>
          {course.units
            .filter(
              (unit): unit is WeekUnit =>
                unit.kind === 'week' && weeks.includes(unit.weekNumber),
            )
            .map((unit) => (
              <MemoUnitOutline
                key={unit.id}
                unit={unit}
                currentUnitId={currentUnitId}
                currentSectionId={
                  unit.id === currentUnitId ? currentSectionId : undefined
                }
                completed={completed}
                onNavigate={onNavigate}
              />
            ))}
        </section>
      ))}
      {appendix && (
        <section className="course-month" aria-labelledby="reference-heading">
          <p id="reference-heading" className="course-group-label">
            Reference
          </p>
          <MemoUnitOutline
            unit={appendix}
            currentUnitId={currentUnitId}
            currentSectionId={
              appendix.id === currentUnitId ? currentSectionId : undefined
            }
            completed={completed}
            onNavigate={onNavigate}
          />
        </section>
      )}
      {mode === 'full' && courseProgress && (
        <div className="rail-tools">
          <p className="rail-progress">
            Course progress: {courseProgress.completed} of{' '}
            {courseProgress.total} sections ({courseProgress.percent}%)
          </p>
          <button
            type="button"
            className="rail-search-button"
            onClick={onOpenSearch}
          >
            Open search
          </button>
        </div>
      )}
      <a
        className="review-navigation-link"
        href="/review"
        onClick={onBeforeNavigate}
      >
        Review notes and bookmarks
      </a>
    </nav>
  );
});
