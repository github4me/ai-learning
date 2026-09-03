'use client'

import * as React from 'react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Course } from '@/src/content/schema'
import { selectCourseProgress } from '@/src/learning/learning-store'
import { useOptionalLearningStore } from '@/src/components/providers'
import { CourseNavigation } from './course-navigation'
import { UtilityBar, type CourseProgress } from './utility-bar'

type ActiveModal = 'none' | 'navigation' | 'study' | 'settings'

export type AppShellProps = {
  course: Course
  children: React.ReactNode
  currentUnitId?: string
  currentSectionId?: string
  completedSectionIds?: readonly string[]
  courseProgress?: CourseProgress
  onNavigate?: (target: { unitId: string; sectionId?: string }) => void
  onOpenSearch?: () => void
  onOpenSettings?: () => void
  settingsContent?: React.ReactNode
  studyContent?: React.ReactNode
}

export function AppShell({
  course,
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
  const [activeModal, setActiveModal] = React.useState<ActiveModal>('none')
  const learningState = useOptionalLearningStore((state) => state)
  const activeUnit = course.units.find((unit) => unit.id === currentUnitId)
  const resolvedCompleted = completedSectionIds ?? learningState?.completedSectionIds ?? []
  const resolvedProgress = courseProgress ?? (learningState ? selectCourseProgress(learningState, course) : { completed: 0, total: 0, percent: 0 })
  const closeModal = () => setActiveModal('none')
  const showNavigation = () => setActiveModal('navigation')
  const showStudy = () => setActiveModal('study')
  const showSettings = () => {
    setActiveModal('settings')
    onOpenSettings?.()
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#lesson-content">Skip to lesson content</a>
      <aside className="workspace-rail full-rail" aria-label="Course workspace">
        <CourseNavigation
          course={course}
          currentUnitId={currentUnitId}
          currentSectionId={currentSectionId}
          completedSectionIds={resolvedCompleted}
          onNavigate={onNavigate}
        />
      </aside>
      <aside className="workspace-rail compact-rail" aria-label="Compact course workspace">
        <CourseNavigation course={course} mode="compact" onNavigate={onNavigate} />
      </aside>
      <section className="workspace">
        <UtilityBar
          currentWeek={activeUnit?.kind === 'week' ? activeUnit.weekNumber : undefined}
          courseProgress={resolvedProgress}
          onOpenNavigation={showNavigation}
          onOpenSearch={onOpenSearch}
          onOpenSettings={showSettings}
          onOpenStudy={showStudy}
        />
        <main id="lesson-content" tabIndex={-1} className="lesson-content">{children}</main>
      </section>
      <Sheet open={activeModal === 'navigation'} onOpenChange={(open) => setActiveModal(open ? 'navigation' : 'none')}>
        {activeModal === 'navigation' && (
          <SheetContent side="left" className="mobile-sheet" aria-label="Course contents">
            <SheetHeader><SheetTitle>Course contents</SheetTitle></SheetHeader>
            <CourseNavigation
              course={course}
              mode="mobile"
              currentUnitId={currentUnitId}
              currentSectionId={currentSectionId}
              completedSectionIds={resolvedCompleted}
              onNavigate={(target) => { onNavigate?.(target); closeModal() }}
            />
          </SheetContent>
        )}
      </Sheet>
      <Sheet open={activeModal === 'study'} onOpenChange={(open) => setActiveModal(open ? 'study' : 'none')}>
        {activeModal === 'study' && (
          <SheetContent side="right" className="study-sheet" aria-label="Study tools">
            <SheetHeader><SheetTitle>Study tools</SheetTitle></SheetHeader>
            <div className="study-sheet-content">{studyContent ?? <p>Study tools will appear here.</p>}</div>
          </SheetContent>
        )}
      </Sheet>
      <Sheet open={activeModal === 'settings'} onOpenChange={(open) => setActiveModal(open ? 'settings' : 'none')}>
        {activeModal === 'settings' && (
          <SheetContent side="right" className="study-sheet" aria-label="Reading settings">
            <SheetHeader><SheetTitle>Reading settings</SheetTitle></SheetHeader>
            <div className="study-sheet-content">{settingsContent ?? <p>Reading settings will appear here.</p>}</div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  )
}
