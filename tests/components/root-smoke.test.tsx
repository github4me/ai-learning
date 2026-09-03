import { render, screen } from '@testing-library/react'
import { CourseOverview } from '@/src/components/course/course-overview'

it('renders the course identity and start action', () => {
  render(<CourseOverview />)

  expect(screen.getByRole('heading', { name: /AI First Principles/i })).toBeVisible()
  expect(screen.getByRole('link', { name: /Start Week 1/i })).toBeVisible()
})
