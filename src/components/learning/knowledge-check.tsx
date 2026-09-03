'use client';
/* oxlint-disable next/no-html-link-for-pages -- Vinext routes are intentionally not Next runtime routes. */
/* oxlint-disable typescript/unbound-method -- Zustand actions are stable function values. */

import * as React from 'react';
import { Check, RotateCcw } from 'lucide-react';

import { useLearningStore } from '@/src/components/providers';
import { courseSectionPath } from '@/src/content/course-runtime';
import type { InlineNode, SourceRef } from '@/src/content/schema';
import { SourcePageLink } from '@/src/components/course/source-page-link';

export function KnowledgeCheck({
  questionId,
  prompt,
  answer,
  reviewSectionId,
  source,
  renderPrompt,
}: {
  questionId: string;
  prompt: InlineNode[];
  answer?: React.ReactNode;
  reviewSectionId: string;
  source: SourceRef;
  renderPrompt: (nodes: InlineNode[]) => React.ReactNode;
}) {
  const attempt = useLearningStore(
    (state) => state.quizAttemptsByQuestion[questionId],
  );
  const assessQuestion = useLearningStore((state) => state.assessQuestion);
  const [revealed, setRevealed] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const reviewPath = courseSectionPath(reviewSectionId);

  function assess(status: 'understood' | 'review') {
    const result = assessQuestion(questionId, status);
    setMessage(
      result.ok
        ? 'Self-assessment saved locally.'
        : result.reason === 'quota'
          ? 'Could not save locally. Your changes are still available in this session; export a backup or free browser storage.'
          : 'Browser storage is unavailable. Changes will not survive closing this page.',
    );
  }

  const reviewedDate = attempt
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(attempt.reviewedAt))
    : undefined;

  return (
    <section
      id={questionId}
      className="content-block knowledge-check"
      aria-labelledby={`${questionId}-label`}
    >
      <p className="knowledge-check-kicker">Knowledge check</p>
      <p id={`${questionId}-label`} className="knowledge-check-prompt">
        {renderPrompt(prompt)}
      </p>
      {answer ? (
        <>
          <button
            type="button"
            className="learning-button"
            aria-expanded={revealed}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? 'Hide answer' : 'Reveal source-grounded answer'}
          </button>
          {revealed && (
            <div className="knowledge-check-answer">
              {answer}
              <SourcePageLink source={source} label="Answer source" />
            </div>
          )}
        </>
      ) : reviewPath ? (
        <a className="learning-button" href={reviewPath}>
          Review the relevant lesson
        </a>
      ) : (
        <span>Review the relevant lesson</span>
      )}
      <div className="assessment-actions" aria-label="Self-assessment">
        <button
          type="button"
          className="learning-button"
          aria-pressed={attempt?.status === 'understood'}
          onClick={() => assess('understood')}
        >
          <Check aria-hidden="true" /> Understood
        </button>
        <button
          type="button"
          className="learning-button"
          aria-pressed={attempt?.status === 'review'}
          onClick={() => assess('review')}
        >
          <RotateCcw aria-hidden="true" /> Review again
        </button>
      </div>
      {attempt && (
        <p className="assessment-status">
          Marked {attempt.status === 'understood' ? 'understood' : 'for review'}{' '}
          on {reviewedDate}. This is your self-assessment, not a score.
        </p>
      )}
      <output className="learning-live" aria-live="polite">
        {message}
      </output>
      <SourcePageLink source={source} label="Knowledge check source" />
    </section>
  );
}
