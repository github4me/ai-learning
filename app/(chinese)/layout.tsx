import CourseDocument from '@/src/components/app/course-document';
export { metadata } from '@/src/components/app/course-document';

export default function ChineseLayout({ children }: { children: React.ReactNode }) {
  return <CourseDocument locale="zh">{children}</CourseDocument>;
}
