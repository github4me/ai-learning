'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

import * as React from 'react';

import type { Course } from '@/src/content/schema';
import { useCourseRuntime } from '@/src/components/course-locale';
import {
  useFlushPendingNotes,
  useOptionalLearningStore,
} from '@/src/components/providers';
import {
  selectContinueLocation,
  selectCourseProgress,
  selectSavedContinueLocation,
} from '@/src/learning/learning-store';
import { requestSectionAnchorFocus } from '@/src/search/search-focus';

export function CourseOverview({
  course: injectedCourse,
  continueLocation: injectedContinueLocation,
  courseProgress: injectedCourseProgress,
}: {
  course?: Course;
  continueLocation?: { unitId: string; sectionId: string };
  courseProgress?: { completed: number; total: number; percent: number };
}) {
  const { course: localizedCourse, path, courseUnitPath, text } = useCourseRuntime();
  const course = injectedCourse ?? localizedCourse;
  const flushPendingNotes = useFlushPendingNotes();
  const learningSnapshot = useOptionalLearningStore((state) => ({
    completedSectionIds: state.completedSectionIds,
    lastLocation: state.lastLocation,
  }));
  const continueLocation = React.useMemo(
    () =>
      injectedContinueLocation ??
      (learningSnapshot
        ? selectContinueLocation(learningSnapshot, course)
        : selectContinueLocation(
            { completedSectionIds: [], lastLocation: null },
            course,
          )),
    [course, injectedContinueLocation, learningSnapshot],
  );
  const courseProgress = React.useMemo(
    () =>
      injectedCourseProgress ??
      (learningSnapshot
        ? selectCourseProgress(learningSnapshot, course)
        : { completed: 0, total: 0, percent: 0 }),
    [course, injectedCourseProgress, learningSnapshot],
  );
  const unit = course.units.find(
    (candidate) => candidate.id === continueLocation.unitId,
  );
  const hasSavedContinueLocation = Boolean(
    selectSavedContinueLocation(
      learningSnapshot ?? {
        completedSectionIds: [],
        lastLocation: injectedContinueLocation ?? null,
      },
      course,
    ),
  );
  const completed = unit === undefined;
  const destination = unit
    ? `${courseUnitPath(unit)}#${continueLocation.sectionId}`
    : path('/review');
  const actionLabel = completed
    ? 'Review your learning'
    : hasSavedContinueLocation
      ? 'Continue learning'
      : 'Start Week 1';
  return (
    <article className="course-overview">
      <p className="eyebrow">Course workspace</p>
      <h1>{course.title}</h1>
      <p className="course-premise">
        {course.description}{' '}
        {text('Work through the lessons in order, following the calculations and trying the exercises yourself.', '阅读以原始教程为准，按周次、章节与可验证练习持续推进。')}
      </p>
      <div
        className="overview-status"
        aria-label={`Course progress: ${courseProgress.completed} of ${courseProgress.total} sections (${courseProgress.percent}%)`}
      >
        <strong>{courseProgress.percent}%</strong>
        <span>
          Course progress · {courseProgress.completed} of {courseProgress.total}{' '}
          sections
        </span>
      </div>
      <a
        className="primary-action"
        href={destination}
        onClick={(event) => {
          requestSectionAnchorFocus(continueLocation.sectionId, event);
          flushPendingNotes();
        }}
      >
        {actionLabel}
      </a>
      {completed && (
        <a className="review-link" href={path('/review')} onClick={flushPendingNotes}>
          Review notes and bookmarks
        </a>
      )}
      <section
        className="overview-path"
        aria-labelledby="learning-path-heading"
      >
        <h2 id="learning-path-heading">12-week learning path</h2>
        <ol>
          {course.units
            .filter((unit) => unit.kind === 'week')
            .map((week) => (
              <li key={week.id}>
                <a href={courseUnitPath(week)} onClick={flushPendingNotes}>
                  <span>Week {week.weekNumber}</span>
                  {week.title}
                </a>
              </li>
            ))}
        </ol>
      </section>
    </article>
  );
}
