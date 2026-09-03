/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

export default function NotFound() {
  return (
    <main id="lesson-content" className="not-found-page">
      <p className="eyebrow">Route not found</p>
      <h1>This lesson is not in the course</h1>
      <p>
        The address may contain an old week slug or section anchor. Return to
        the course map, or start from the nearest valid week.
      </p>
      <div className="not-found-actions">
        <a className="primary-action" href="/">
          Course overview
        </a>
        <a href="/week/week-01">Open Week 1</a>
      </div>
    </main>
  );
}
