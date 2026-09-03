import { render, screen } from '@testing-library/react'
import courseData from '@/src/content/course.generated.json'
import { CourseOverview } from '@/src/components/course/course-overview'
import { loadCourse } from '@/src/content/load-course'

const course = loadCourse(courseData)

it('renders the course identity and start action', () => {
  render(<CourseOverview course={course} />)

  expect(screen.getByRole('heading', { name: course.title })).toBeVisible()
  expect(screen.getByRole('link', { name: /Start Week 1/i })).toBeVisible()
})
