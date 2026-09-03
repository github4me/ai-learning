'use client'
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

import * as React from 'react'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'

import type { Course, CourseUnit, SectionNode, WeekUnit } from '@/src/content/schema'

export type CourseNavigationProps = {
  course: Course
  currentUnitId?: string
  currentSectionId?: string
  completedSectionIds?: readonly string[]
  mode?: 'full' | 'compact' | 'mobile'
  onNavigate?: (target: { unitId: string; sectionId?: string }) => void
}

function unitPath(unit: CourseUnit): string {
  return unit.kind === 'appendix' ? '/appendix/mini-gpt' : `/week/${unit.slug}`
}

function SectionLinks({
  nodes,
  unit,
  currentSectionId,
  completed,
  onNavigate,
  depth = 0,
}: {
  nodes: readonly SectionNode[]
  unit: CourseUnit
  currentSectionId?: string
  completed: ReadonlySet<string>
  onNavigate?: CourseNavigationProps['onNavigate']
  depth?: number
}) {
  return (
    <ul className="course-section-list" data-depth={depth}>
      {nodes.filter((node) => node.showInToc).map((node) => {
        const isCurrent = node.id === currentSectionId
        const isComplete = completed.has(node.id)
        return (
          <li key={node.id}>
            <a
              className="course-section-link"
              data-current={isCurrent || undefined}
              href={`${unitPath(unit)}#${node.id}`}
              aria-current={isCurrent ? 'location' : undefined}
              onClick={() => onNavigate?.({ unitId: unit.id, sectionId: node.id })}
            >
              {isComplete ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
              <span>{node.title}</span>
              {isCurrent && <span className="nav-state">Current section</span>}
              <span className="sr-only">{isComplete ? 'Completed' : 'Not completed'}</span>
            </a>
            {node.children.length > 0 && (
              <SectionLinks
                nodes={node.children}
                unit={unit}
                currentSectionId={currentSectionId}
                completed={completed}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

function UnitOutline({
  unit,
  currentUnitId,
  currentSectionId,
  completed,
  onNavigate,
}: {
  unit: CourseUnit
  currentUnitId?: string
  currentSectionId?: string
  completed: ReadonlySet<string>
  onNavigate?: CourseNavigationProps['onNavigate']
}) {
  const unitLabel = unit.kind === 'week' ? `Week ${unit.weekNumber}` : 'Appendix A'
  const current = unit.id === currentUnitId
  return (
    <div className="course-unit" data-current={current || undefined}>
      <a
        className="course-unit-link"
        href={unitPath(unit)}
        aria-current={current ? 'page' : undefined}
        onClick={() => onNavigate?.({ unitId: unit.id })}
      >
        <span className="course-unit-kicker">{unitLabel}</span>
        <span>{unit.title}</span>
        {current && <span className="nav-state">Current week</span>}
      </a>
      <SectionLinks
        nodes={unit.children}
        unit={unit}
        currentSectionId={currentSectionId}
        completed={completed}
        onNavigate={onNavigate}
      />
    </div>
  )
}

function CompactNavigation({ course, onNavigate }: Pick<CourseNavigationProps, 'course' | 'onNavigate'>) {
  const [selectedWeek, setSelectedWeek] = React.useState<WeekUnit | null>(null)
  const panelId = 'compact-week-sections'
  return (
    <nav aria-label="Week selector" className="compact-course-navigation">
      <span className="sr-only" data-testid="signal-path" aria-hidden="true" />
      <ol className="compact-week-list">
        {course.units.filter((unit): unit is WeekUnit => unit.kind === 'week').map((week) => {
          const open = selectedWeek?.id === week.id
          return (
            <li key={week.id}>
              <button
                type="button"
                className="compact-week-button"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={`Open Week ${week.weekNumber} sections`}
                onClick={() => setSelectedWeek(open ? null : week)}
              >
                {week.weekNumber}
              </button>
            </li>
          )
        })}
      </ol>
      {selectedWeek && (
        <section id={panelId} aria-label={`Week ${selectedWeek.weekNumber} sections`} className="compact-section-panel">
          <a href={unitPath(selectedWeek)} onClick={() => onNavigate?.({ unitId: selectedWeek.id })}>
            Week {selectedWeek.weekNumber}: {selectedWeek.title}
          </a>
          <SectionLinks nodes={selectedWeek.children} unit={selectedWeek} completed={new Set()} onNavigate={onNavigate} />
        </section>
      )}
    </nav>
  )
}

export function CourseNavigation({
  course,
  currentUnitId,
  currentSectionId,
  completedSectionIds = [],
  mode = 'full',
  onNavigate,
}: CourseNavigationProps) {
  if (mode === 'compact') return <CompactNavigation course={course} onNavigate={onNavigate} />
  const completed = new Set(completedSectionIds)
  const monthGroups = [
    { label: 'Month 1', weeks: [1, 2, 3, 4] },
    { label: 'Month 2', weeks: [5, 6, 7, 8] },
    { label: 'Month 3', weeks: [9, 10, 11, 12] },
  ]
  const appendix = course.units.find((unit) => unit.kind === 'appendix')
  return (
    <nav aria-label="Course contents" className={`course-navigation course-navigation-${mode}`}>
      <div className="signal-path" data-testid="signal-path" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <a className="course-identity" href="/">
        <span>AI First Principles</span>
        <small>核心教程深度扩展版</small>
      </a>
      {monthGroups.map(({ label, weeks }) => (
        <section key={label} className="course-month" aria-labelledby={`${label.toLowerCase().replace(' ', '-')}-heading`}>
          <h2 id={`${label.toLowerCase().replace(' ', '-')}-heading`}>{label}</h2>
          {course.units
            .filter((unit): unit is WeekUnit => unit.kind === 'week' && weeks.includes(unit.weekNumber))
            .map((unit) => (
              <UnitOutline
                key={unit.id}
                unit={unit}
                currentUnitId={currentUnitId}
                currentSectionId={currentSectionId}
                completed={completed}
                onNavigate={onNavigate}
              />
            ))}
        </section>
      ))}
      {appendix && (
        <section className="course-month" aria-labelledby="reference-heading">
          <h2 id="reference-heading">Reference</h2>
          <UnitOutline
            unit={appendix}
            currentUnitId={currentUnitId}
            currentSectionId={currentSectionId}
            completed={completed}
            onNavigate={onNavigate}
          />
        </section>
      )}
      <a className="source-pdf-link" href="/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf">View original PDF <ChevronRight aria-hidden="true" /></a>
    </nav>
  )
}
