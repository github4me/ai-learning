import courseData from '@/src/content/course.generated.json'
import { AppShell } from '@/src/components/app/app-shell'
import { Providers } from '@/src/components/providers'
import { CourseOverview } from '@/src/components/course/course-overview'
import { loadCourse } from '@/src/content/load-course'

const course = loadCourse(courseData)

export default function Home() {
  return <Providers course={course}><AppShell course={course}><CourseOverview course={course} /></AppShell></Providers>
}
