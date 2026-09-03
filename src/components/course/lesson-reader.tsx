'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */
/* oxlint-disable typescript/unbound-method -- Zustand stores actions as stable function values. */

import * as React from 'react';

import { AppShell } from '@/src/components/app/app-shell';
import { useLearningStore } from '@/src/components/providers';
import {
  courseUnitPath,
  getCourse,
  getSection,
  getUnit,
  getUnitForSection,
} from '@/src/content/course-runtime';
import { flattenSections } from '@/src/content/load-course';
import type { CourseUnit, SectionNode } from '@/src/content/schema';
import {
  consumeSearchResultFocus,
  SEARCH_RESULT_FOCUS_EVENT,
} from '@/src/search/search-focus';
import { ContentRenderer } from './content-renderer';
import { SourcePageLink } from './source-page-link';

type ReadingLocation = { unit: CourseUnit; section: SectionNode };

function unitLeaves(unit: CourseUnit): SectionNode[] {
  const leaves = [...flattenSections(unit)].filter(
    (section) => section.children.length === 0,
  );
  if (unit.kind === 'appendix') return leaves;
  return leaves.filter((section) => section.isCompletable);
}

function readingOrder(): ReadingLocation[] {
  return getCourse().units.flatMap((unit) =>
    unitLeaves(unit).map((section) => ({ unit, section })),
  );
}

function aliases(section: SectionNode) {
  return section.aliases.map((alias) => (
    <span key={alias} id={alias} className="alias-anchor" aria-hidden="true" />
  ));
}

function SectionStream({ section }: { section: SectionNode }) {
  const level = Math.min(6, Math.max(2, section.navDepth + 1));
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const headingId = `${section.id}-heading`;

  return (
    <section
      id={section.id}
      className="lesson-section"
      aria-labelledby={headingId}
      data-section-id={section.id}
    >
      {aliases(section)}
      <header className="lesson-section-header">
        <Heading id={headingId} tabIndex={-1}>
          {section.title}
        </Heading>
        <SourcePageLink source={section.source} label="Section source" />
      </header>
      <ContentRenderer blocks={section.blocks} />
      {section.children.map((child) => (
        <SectionStream key={child.id} section={child} />
      ))}
    </section>
  );
}

function decodeHash(hash: string): string {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function locationHref(location: ReadingLocation): string {
  return `${courseUnitPath(location.unit)}#${location.section.id}`;
}

export function LessonReader({ unitId }: { unitId: string }) {
  const unit = getUnit(unitId);
  if (!unit) throw new Error(`Unknown course unit: ${unitId}`);

  const initialSection = unitLeaves(unit)[0] ?? unit;
  const [activeSectionId, setActiveSectionId] = React.useState(
    initialSection.id,
  );
  const articleRef = React.useRef<HTMLElement>(null);
  const visibleSections = React.useRef(new Map<string, DOMRectReadOnly>());
  const lastVisited = React.useRef('');
  const visitSection = useLearningStore((state) => state.visitSection);
  const flushPendingNotes = useLearningStore(
    (state) => state.flushPendingNotes,
  );
  const currentUnitId = unit.id;

  React.useEffect(() => {
    function resolveHash() {
      const requested = decodeHash(window.location.hash);
      if (!requested) return;
      const section = getSection(requested);
      const sectionUnit = getUnitForSection(requested);
      if (!section || sectionUnit?.id !== currentUnitId) return;

      if (requested !== section.id) {
        window.history.replaceState(
          window.history.state,
          '',
          `${window.location.pathname}${window.location.search}#${section.id}`,
        );
      }

      setActiveSectionId(section.id);
      document.getElementById(section.id)?.scrollIntoView({ block: 'start' });
      if (!consumeSearchResultFocus(section.id)) return;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const heading = document.getElementById(`${section.id}-heading`);
          heading?.focus({ preventScroll: true });
        });
      });
    }

    resolveHash();
    window.addEventListener('hashchange', resolveHash);
    window.addEventListener(SEARCH_RESULT_FOCUS_EVENT, resolveHash);
    return () => {
      window.removeEventListener('hashchange', resolveHash);
      window.removeEventListener(SEARCH_RESULT_FOCUS_EVENT, resolveHash);
    };
  }, [currentUnitId]);

  React.useEffect(() => {
    const article = articleRef.current;
    if (!article || typeof IntersectionObserver === 'undefined') return;
    const visible = visibleSections.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.sectionId;
          if (!id) continue;
          if (entry.isIntersecting) visible.set(id, entry.boundingClientRect);
          else visible.delete(id);
        }

        const closest = [...visible.entries()].sort(
          ([leftId, left], [rightId, right]) =>
            Math.abs(left.top - 72) - Math.abs(right.top - 72) ||
            leftId.localeCompare(rightId),
        )[0];
        if (!closest) return;
        const sectionId = closest[0];
        setActiveSectionId(sectionId);
        const visitKey = `${unit.id}:${sectionId}`;
        if (lastVisited.current === visitKey) return;
        lastVisited.current = visitKey;
        if (window.location.hash !== `#${sectionId}`) {
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${window.location.search}#${sectionId}`,
          );
        }
        visitSection(unit.id, sectionId);
      },
      { rootMargin: '-64px 0px -55% 0px', threshold: [0, 0.2, 0.65] },
    );

    const targets = article.querySelectorAll<HTMLElement>('[data-section-id]');
    targets.forEach((target) => observer.observe(target));
    return () => {
      observer.disconnect();
      visible.clear();
    };
  }, [unit.id, visitSection]);

  const order = readingOrder();
  const unitStart = order.findIndex((entry) => entry.unit.id === unit.id);
  const activeIndex = order.findIndex(
    (entry) => entry.section.id === activeSectionId,
  );
  const resolvedIndex = activeIndex >= 0 ? activeIndex : unitStart;
  const previous = resolvedIndex > 0 ? order[resolvedIndex - 1] : undefined;
  const next = resolvedIndex >= 0 ? order[resolvedIndex + 1] : undefined;

  function flushNavigation() {
    flushPendingNotes();
  }

  return (
    <AppShell
      currentUnitId={unit.id}
      currentSectionId={activeSectionId}
      onNavigate={flushNavigation}
    >
      <article
        ref={articleRef}
        id={unit.id}
        className="lesson-reader"
        data-section-id={unit.id}
        aria-labelledby={`${unit.id}-heading`}
      >
        {aliases(unit)}
        <header className="lesson-header">
          <p className="eyebrow">
            {unit.kind === 'week' ? `Week ${unit.weekNumber}` : 'Appendix A'}
          </p>
          <h1 id={`${unit.id}-heading`} tabIndex={-1}>
            {unit.title}
          </h1>
          {unit.kind === 'week' && (
            <>
              <p className="lesson-key-question">
                <span>Key question</span>
                {unit.keyQuestion}
              </p>
              <section
                className="lesson-objectives"
                aria-labelledby="lesson-objectives-heading"
              >
                <h2 id="lesson-objectives-heading">Learning objectives</h2>
                <ul>
                  {unit.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
                <p>{unit.estimatedReadingMinutes} min estimated reading time</p>
              </section>
            </>
          )}
          <SourcePageLink source={unit.source} label="Unit source" />
        </header>

        <ContentRenderer blocks={unit.blocks} />
        {unit.children.map((section) => (
          <SectionStream key={section.id} section={section} />
        ))}

        <nav className="lesson-continuity" aria-label="Lesson continuity">
          {previous ? (
            <a
              className="lesson-previous"
              href={locationHref(previous)}
              onClick={flushNavigation}
            >
              <span>Previous lesson</span>
              <strong>Previous: {previous.section.title}</strong>
            </a>
          ) : (
            <span aria-hidden="true" />
          )}
          {next ? (
            <a
              className="lesson-next"
              href={locationHref(next)}
              onClick={flushNavigation}
            >
              <span>Next lesson</span>
              <strong>Next: {next.section.title}</strong>
            </a>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>
      </article>
    </AppShell>
  );
}
