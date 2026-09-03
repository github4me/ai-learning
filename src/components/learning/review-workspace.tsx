'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */

import { Bookmark, FileText } from 'lucide-react';
import * as React from 'react';

import {
  useFlushPendingNotes,
  useLearningStore,
} from '@/src/components/providers';
import { getCourse } from '@/src/content/course-runtime';
import type { Course } from '@/src/content/schema';
import { sectionReferenceMap } from '@/src/learning/course-tools';
import type { LearningStore } from '@/src/learning/learning-store';
import { requestSectionAnchorFocus } from '@/src/search/search-focus';

type ReviewItem = {
  key: string;
  sectionId: string;
  title: string;
  text: string;
  href?: string;
  kind: 'note' | 'bookmark';
  groupLabel: string;
  groupOrder: number;
};

function collectItems(
  course: Course,
  state: Pick<LearningStore, 'notesBySection' | 'bookmarks'>,
): ReviewItem[] {
  const references = sectionReferenceMap(course);
  const orphanLabel = 'Unavailable in this course version';
  const items: ReviewItem[] = [];
  for (const [sectionId, note] of Object.entries(state.notesBySection)) {
    const reference = references.get(sectionId);
    items.push({
      key: `note:${sectionId}`,
      sectionId,
      title: reference?.section.title ?? sectionId,
      text: note.text,
      href: reference?.href,
      kind: 'note',
      groupLabel: reference?.groupLabel ?? orphanLabel,
      groupOrder: reference?.groupOrder ?? Number.MAX_SAFE_INTEGER,
    });
  }
  state.bookmarks.forEach((bookmark) => {
    const reference = references.get(bookmark.sectionId);
    items.push({
      key: `bookmark:${bookmark.id}`,
      sectionId: bookmark.sectionId,
      title: reference?.section.title ?? bookmark.sectionId,
      text: bookmark.excerpt,
      href: reference?.href,
      kind: 'bookmark',
      groupLabel: reference?.groupLabel ?? orphanLabel,
      groupOrder: reference?.groupOrder ?? Number.MAX_SAFE_INTEGER,
    });
  });
  return items.sort(
    (left, right) =>
      left.groupOrder - right.groupOrder ||
      left.title.localeCompare(right.title) ||
      left.kind.localeCompare(right.kind),
  );
}

export function LearningItemGroups({
  course = getCourse(),
  kinds = ['note', 'bookmark'],
  compact = false,
  onNavigate,
}: {
  course?: Course;
  kinds?: Array<'note' | 'bookmark'>;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const state = useLearningStore((current) => ({
    notesBySection: current.notesBySection,
    bookmarks: current.bookmarks,
  }));
  const flushPendingNotes = useFlushPendingNotes();
  const items = React.useMemo(() => {
    const allowed = new Set(kinds);
    return collectItems(course, state).filter((item) => allowed.has(item.kind));
  }, [course, kinds, state]);

  if (items.length === 0) {
    return (
      <div className="learning-empty">
        <p>
          No saved {kinds.length === 1 ? `${kinds[0]}s` : 'notes or bookmarks'}{' '}
          yet.
        </p>
        <p>Open Study tools while reading to add the first one.</p>
      </div>
    );
  }

  const groups = new Map<string, ReviewItem[]>();
  items.forEach((item) => {
    const group = groups.get(item.groupLabel) ?? [];
    group.push(item);
    groups.set(item.groupLabel, group);
  });
  const GroupHeading = compact ? 'h3' : 'h2';
  return (
    <div className={compact ? 'learning-groups compact' : 'learning-groups'}>
      {[...groups].map(([label, groupItems]) => (
        <section
          key={label}
          className="learning-group"
          aria-labelledby={`${kinds.join('-')}-group-${groupItems[0]!.groupOrder}`}
        >
          <GroupHeading
            id={`${kinds.join('-')}-group-${groupItems[0]!.groupOrder}`}
          >
            {label}
          </GroupHeading>
          {label === 'Unavailable in this course version' && (
            <p className="orphan-explanation">
              These saved items are preserved, but their original lesson is not
              in the current course version.
            </p>
          )}
          <ul>
            {groupItems.map((item) => (
              <li key={item.key} className="learning-item">
                <p className="learning-item-kind">
                  {item.kind === 'note' ? (
                    <FileText aria-hidden="true" />
                  ) : (
                    <Bookmark aria-hidden="true" />
                  )}
                  {item.kind === 'note' ? 'Note' : 'Bookmark'}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    onClick={(event) => {
                      requestSectionAnchorFocus(item.sectionId, event);
                      flushPendingNotes();
                      onNavigate?.();
                    }}
                  >
                    {item.title}
                  </a>
                ) : (
                  <strong>{item.title}</strong>
                )}
                <p className="learning-item-text">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ReviewWorkspace({ course = getCourse() }: { course?: Course }) {
  return (
    <article className="review-workspace">
      <p className="eyebrow">Local learning workspace</p>
      <h1>Review notes and bookmarks</h1>
      <p>
        Revisit what you saved across the twelve weeks and Appendix A. Notes are
        shown as plain text.
      </p>
      <LearningItemGroups course={course} />
    </article>
  );
}
