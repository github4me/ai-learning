'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */
/* oxlint-disable typescript/unbound-method -- Zustand actions are stable function values. */

import * as React from 'react';
import { Trash2, Undo2 } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useFlushPendingNotes,
  useLearningStore,
} from '@/src/components/providers';
import {
  GLOSSARY_ENTRIES,
  type RuntimeGlossaryEntry,
} from '@/src/content/glossary';
import { getCourse, getSection } from '@/src/content/course-runtime';
import type { Course } from '@/src/content/schema';
import { MAX_NOTE_CODE_POINTS } from '@/src/learning/storage-adapter';
import {
  isUnmodifiedPrimaryActivation,
  requestSectionAnchorFocus,
} from '@/src/search/search-focus';
import { LearningItemGroups } from './review-workspace';

const UNDO_WINDOW_MS = 8_000;

function NotesPanel({
  sectionId,
  course,
  onSectionNavigate,
}: {
  sectionId?: string;
  course: Course;
  onSectionNavigate?: () => void;
}) {
  const storedText = useLearningStore((state) =>
    sectionId ? (state.notesBySection[sectionId]?.text ?? '') : '',
  );
  const persistence = useLearningStore((state) => state.notePersistence);
  const saveNote = useLearningStore((state) => state.saveNote);
  const removeNote = useLearningStore((state) => state.removeNote);
  const undoRemoveNote = useLearningStore((state) => state.undoRemoveNote);
  const clearUndoRemoveNote = useLearningStore(
    (state) => state.clearUndoRemoveNote,
  );
  const flushPendingNotes = useLearningStore(
    (state) => state.flushPendingNotes,
  );
  const [text, setText] = React.useState(storedText);
  const [editorMessage, setEditorMessage] = React.useState('');
  const [undoAvailable, setUndoAvailable] = React.useState(false);
  const undoTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const deletedText = React.useRef('');
  const section = sectionId ? getSection(sectionId) : undefined;
  const count = Array.from(text).length;

  React.useEffect(() => {
    return () => {
      if (undoTimer.current !== undefined) clearTimeout(undoTimer.current);
      clearUndoRemoveNote();
    };
  }, [clearUndoRemoveNote]);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    if (Array.from(next).length > MAX_NOTE_CODE_POINTS) {
      setEditorMessage('Notes are limited to 20,000 characters.');
      return;
    }
    setText(next);
    setEditorMessage('');
    if (sectionId) saveNote(sectionId, next);
  }

  function handleDelete() {
    if (!sectionId || !storedText) return;
    removeNote(sectionId);
    deletedText.current = text;
    setText('');
    setUndoAvailable(true);
    if (undoTimer.current !== undefined) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setUndoAvailable(false);
      clearUndoRemoveNote();
    }, UNDO_WINDOW_MS);
  }

  function handleUndo() {
    undoRemoveNote();
    setText(deletedText.current);
    setUndoAvailable(false);
    if (undoTimer.current !== undefined) clearTimeout(undoTimer.current);
  }

  const persistenceMessage =
    persistence.status === 'saving'
      ? 'Saving…'
      : persistence.status === 'saved'
        ? 'Saved locally.'
        : persistence.status === 'error' &&
            persistence.result &&
            !persistence.result.ok &&
            persistence.result.reason === 'quota'
          ? 'Could not save locally. Your changes are still available in this session; export a backup or free browser storage.'
          : persistence.status === 'error'
            ? 'Browser storage is unavailable. Changes will not survive closing this page.'
            : '';

  return (
    <div className="notes-panel">
      <h3>{section ? `Notes for ${section.title}` : 'Section notes'}</h3>
      {sectionId ? (
        <>
          <label htmlFor="section-note">Plain-text note</label>
          <textarea
            id="section-note"
            value={text}
            rows={10}
            onChange={handleChange}
            onBlur={() => flushPendingNotes()}
          />
          <p className="note-count">
            {count.toLocaleString()} of {MAX_NOTE_CODE_POINTS.toLocaleString()}{' '}
            characters · {(MAX_NOTE_CODE_POINTS - count).toLocaleString()}{' '}
            characters remaining
          </p>
          <div className="note-actions">
            <button
              type="button"
              className="learning-button danger"
              disabled={!storedText}
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" /> Delete note
            </button>
            {undoAvailable && (
              <button
                type="button"
                className="learning-button"
                onClick={handleUndo}
              >
                <Undo2 aria-hidden="true" /> Undo delete
              </button>
            )}
          </div>
          <output className="learning-live" aria-live="polite">
            {editorMessage || persistenceMessage}
          </output>
        </>
      ) : (
        <p>Open a course section to write a note.</p>
      )}
      <h3>All notes</h3>
      <LearningItemGroups
        course={course}
        kinds={['note']}
        compact
        onNavigate={onSectionNavigate}
      />
    </div>
  );
}

function GlossaryPanel({
  entries,
  onSectionNavigate,
}: {
  entries: readonly RuntimeGlossaryEntry[];
  onSectionNavigate?: () => void;
}) {
  const [query, setQuery] = React.useState('');
  const flushPendingNotes = useFlushPendingNotes();
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = entries.filter((entry) =>
    [entry.term, ...entry.aliases, entry.definition]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized),
  );

  if (entries.length === 0)
    return <p>Glossary is not available in this course version.</p>;
  return (
    <div className="glossary-panel">
      <label htmlFor="glossary-filter">Filter source-grounded glossary</label>
      <input
        id="glossary-filter"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p>{filtered.length} terms</p>
      {filtered.length === 0 ? (
        <p>No glossary terms match this filter.</p>
      ) : (
        <dl>
          {filtered.map((entry) => (
            <div key={entry.sectionId} className="glossary-entry">
              <dt>{entry.term}</dt>
              <dd>
                {entry.aliases.length > 0 && (
                  <span className="glossary-aliases">
                    Also: {entry.aliases.join(', ')}.{' '}
                  </span>
                )}
                {entry.definition}{' '}
                <a
                  href={entry.route}
                  onClick={(event) => {
                    requestSectionAnchorFocus(entry.sectionId, event);
                    flushPendingNotes();
                    if (isUnmodifiedPrimaryActivation(event))
                      onSectionNavigate?.();
                  }}
                >
                  Open source lesson
                </a>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function StudyDrawer({
  activeSectionId,
  course = getCourse(),
  glossary = GLOSSARY_ENTRIES,
  onSectionNavigate,
}: {
  activeSectionId?: string;
  course?: Course;
  glossary?: readonly RuntimeGlossaryEntry[];
  onSectionNavigate?: () => void;
}) {
  return (
    <Tabs defaultValue="notes" className="study-tabs">
      <TabsList aria-label="Study tool sections" variant="line">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
        <TabsTrigger value="glossary">Glossary</TabsTrigger>
      </TabsList>
      <TabsContent value="notes">
        <NotesPanel
          key={activeSectionId ?? 'no-section'}
          sectionId={activeSectionId}
          course={course}
          onSectionNavigate={onSectionNavigate}
        />
      </TabsContent>
      <TabsContent value="bookmarks">
        <LearningItemGroups
          course={course}
          kinds={['bookmark']}
          compact
          onNavigate={onSectionNavigate}
        />
      </TabsContent>
      <TabsContent value="glossary">
        <GlossaryPanel
          entries={glossary}
          onSectionNavigate={onSectionNavigate}
        />
      </TabsContent>
    </Tabs>
  );
}
