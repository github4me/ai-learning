import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureAxe } from 'vitest-axe'

import courseData from '@/src/content/course.generated.json'
import { loadCourse } from '@/src/content/load-course'
import { AppShell } from '@/src/components/app/app-shell'

const course = loadCourse(courseData)
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } })

function renderShell() {
  return render(
    <AppShell
      course={course}
      currentUnitId="o0002-week-1-ai"
      currentSectionId="o0004-section"
      completedSectionIds={['o0004-section']}
      courseProgress={{ completed: 1, total: 102, percent: 1 }}
      studyContent={<p>Notes and bookmarks arrive in the study tools.</p>}
    >
      <h1>Overview</h1>
    </AppShell>,
  )
}

it('provides the course workspace landmarks and canonical source link', async () => {
  const { container } = renderShell()

  expect(screen.getByRole('link', { name: /skip to lesson content/i })).toHaveAttribute('href', '#lesson-content')
  expect(screen.getByRole('navigation', { name: /course contents/i })).toBeVisible()
  expect(screen.getByText(/current: week 1/i)).toBeVisible()
  expect(screen.getByRole('main')).toHaveAttribute('id', 'lesson-content')
  expect(screen.getAllByRole('link', { name: /view original pdf/i })).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ href: expect.stringContaining('/AI_First_Principles_12_Week_Complete_Guide_Expanded.pdf') }),
    ]),
  )

  expect((await axe(container)).violations).toHaveLength(0)
}, 30_000)

it('keeps navigation and study tools mutually exclusive and restores focus on escape', async () => {
  const user = userEvent.setup()
  renderShell()

  const navigation = screen.getByRole('button', { name: /open course navigation/i })
  await user.click(navigation)
  expect(screen.getByRole('dialog', { name: /course contents/i })).toBeVisible()

  await user.keyboard('{Escape}')
  expect(navigation).toHaveFocus()

  const study = screen.getByRole('button', { name: /open study tools/i })
  await user.click(study)
  expect(screen.queryByRole('dialog', { name: /course contents/i })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: /study tools/i })).toBeVisible()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(study).toHaveFocus()

  const settings = screen.getByRole('button', { name: /reading settings/i })
  await user.click(settings)
  expect(screen.queryByRole('dialog', { name: /study tools/i })).not.toBeInTheDocument()
  expect(screen.getByRole('dialog', { name: /reading settings/i })).toBeVisible()
})
