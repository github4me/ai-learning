import { render, screen } from '@testing-library/react'

import courseData from '@/src/content/course.generated.json'
import { loadCourse } from '@/src/content/load-course'
import { CourseNavigation } from '@/src/components/app/course-navigation'

const course = loadCourse(courseData)

it('renders real course groups, nested sections, completion text, and stable destinations', () => {
  render(
    <CourseNavigation
      course={course}
      currentUnitId="o0254-week-7-attention-token"
      currentSectionId="o0258-2-q-k-v"
      completedSectionIds={['o0258-2-q-k-v']}
    />,
  )

  expect(screen.getByText('Month 1')).toBeVisible()
  expect(screen.getByText('Month 2')).toBeVisible()
  expect(screen.getByText('Month 3')).toBeVisible()
  expect(screen.getByText('Reference')).toBeVisible()
  expect(screen.getAllByRole('link').find((link) => link.getAttribute('href') === '/week/week-01')).toBeDefined()
  expect(screen.getByRole('link', { name: /用搜索系统理解q、k、v/i })).toHaveAttribute(
    'href',
    '/week/week-07#o0258-2-q-k-v',
  )
  expect(screen.getAllByText('Completed').some((element) => element.classList.contains('sr-only'))).toBe(true)
  expect(screen.getByText(/current section/i)).toBeVisible()
  expect(screen.getByTestId('signal-path')).toHaveAttribute('aria-hidden', 'true')
})

it('uses an operable labelled compact section panel', async () => {
  const { user } = await import('@testing-library/user-event').then(({ default: setup }) => ({ user: setup.setup() }))
  render(<CourseNavigation course={course} mode="compact" />)

  const weekSeven = screen.getByRole('button', { name: /open week 7 sections/i })
  expect(weekSeven).toHaveAttribute('aria-expanded', 'false')
  await user.click(weekSeven)
  expect(weekSeven).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('region', { name: /week 7 sections/i })).toBeVisible()
})
