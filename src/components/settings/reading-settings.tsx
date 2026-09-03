'use client';
/* oxlint-disable typescript/unbound-method -- Zustand actions are stable function values. */

import * as React from 'react';
import { Download, Upload } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLearningStore } from '@/src/components/providers';
import type { LearningStateV1 } from '@/src/learning/state-schema';
import {
  MAX_IMPORT_BYTES,
  type RecoveryRecord,
} from '@/src/learning/storage-adapter';

export const PRIVACY_COPY =
  'Your progress, notes, bookmarks, knowledge-check self-assessments, and reading preferences stay only in this browser on this device. This site has no account, cloud sync, or server database. Export a backup to keep or move this data.';

function downloadPayload(payload: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([payload], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function localDateFilename() {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `ai-first-principles-progress-${year}-${month}-${day}.json`;
}

function resultMessage(result: { ok: boolean; reason?: string }): string {
  if (result.ok) return 'Saved locally.';
  return result.reason === 'quota'
    ? 'Could not save locally. Your changes are still available in this session; export a backup or free browser storage.'
    : 'Browser storage is unavailable. Changes will not survive closing this page.';
}

function recoveryDetails(recovery: RecoveryRecord): {
  message: string;
  action: string;
  filename: string;
} {
  if (recovery.kind === 'corrupt-load') {
    return {
      message:
        'Stored local data could not be read. The original payload is preserved for download; the course opened with clean in-memory data.',
      action: 'Download unreadable data',
      filename: 'ai-first-principles-unreadable-data.json',
    };
  }
  if (recovery.kind === 'failed-import') {
    return {
      message:
        recovery.reason === 'quota'
          ? 'The validated import could not be saved because browser storage is full. Your existing learning data is unchanged. Download the failed import payload below; Export backup downloads your current data instead.'
          : 'The validated import could not be saved because browser storage is unavailable. Your existing learning data is unchanged. Download the failed import payload below; Export backup downloads your current data instead.',
      action: 'Download failed import',
      filename: 'ai-first-principles-failed-import.json',
    };
  }
  return {
    message:
      recovery.reason === 'quota'
        ? 'A recent change could not be saved because browser storage is full. It remains available in this session; download this recovery payload or free browser storage.'
        : recovery.reason === 'invalid'
          ? 'A recent change could not be validated for local storage. It remains available in this session; download this recovery payload.'
          : 'A recent change could not be saved because browser storage is unavailable. It remains available in this session; download this recovery payload.',
    action: 'Download unsaved learning data',
    filename: 'ai-first-principles-unsaved-data.json',
  };
}

export function ReadingSettings() {
  const preferences = useLearningStore((state) => state.preferences);
  const recovery = useLearningStore((state) => state.recovery);
  const setPreference = useLearningStore((state) => state.setPreference);
  const exportState = useLearningStore((state) => state.exportState);
  const previewImport = useLearningStore((state) => state.previewImport);
  const importState = useLearningStore((state) => state.importState);
  const resetState = useLearningStore((state) => state.resetState);
  const dismissRecovery = useLearningStore((state) => state.dismissRecovery);
  const [message, setMessage] = React.useState('');
  const [importCandidate, setImportCandidate] = React.useState<{
    serialized: string;
    state: LearningStateV1;
  }>();
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetText, setResetText] = React.useState('');
  const [resetMessage, setResetMessage] = React.useState('');

  function changePreference<K extends keyof LearningStateV1['preferences']>(
    key: K,
    value: LearningStateV1['preferences'][K],
  ) {
    setMessage(resultMessage(setPreference(key, value)));
  }

  function handleExport() {
    try {
      downloadPayload(exportState(), localDateFilename());
      setMessage('Progress exported.');
    } catch {
      setMessage('Could not export this learning data.');
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage('Import is limited to 5 MiB.');
      return;
    }
    try {
      const serialized = await file.text();
      const state = previewImport(serialized);
      setImportCandidate({ serialized, state });
      setMessage('Backup validated. Review the counts before importing.');
    } catch (error) {
      setMessage(
        error instanceof Error && /unsupported/i.test(error.message)
          ? 'This backup uses a newer version and was not imported.'
          : error instanceof Error && /5 MiB/i.test(error.message)
            ? 'Import is limited to 5 MiB.'
            : 'This backup is invalid and was not imported.',
      );
    }
  }

  function confirmImport() {
    if (!importCandidate) return;
    const result = importState(importCandidate.serialized);
    if (result.ok) {
      setImportCandidate(undefined);
      setMessage('Learning data imported.');
      return;
    }
    setImportCandidate(undefined);
    setMessage(
      result.reason === 'quota'
        ? 'Import was not applied because browser storage is full. Current data is unchanged; use Download failed import in the recovery notice.'
        : 'Import was not applied because browser storage is unavailable. Current data is unchanged; use Download failed import in the recovery notice.',
    );
  }

  function confirmReset() {
    if (resetText !== 'RESET') return;
    const result = resetState();
    if (result.ok) {
      setResetOpen(false);
      setResetText('');
      setMessage('Learning data reset.');
    } else {
      setResetMessage('Could not clear learning data. Nothing was reset.');
    }
  }

  const counts = importCandidate
    ? {
        completed:
          importCandidate.state.completedSectionIds.length +
          importCandidate.state.appendixReadSectionIds.length,
        notes: Object.keys(importCandidate.state.notesBySection).length,
        bookmarks: importCandidate.state.bookmarks.length,
        attempts: Object.keys(importCandidate.state.quizAttemptsByQuestion)
          .length,
      }
    : undefined;
  const recoveryCopy = recovery ? recoveryDetails(recovery) : undefined;

  return (
    <div className="reading-settings">
      <section aria-labelledby="appearance-heading">
        <h3 id="appearance-heading">Appearance</h3>
        <fieldset>
          <legend>Theme</legend>
          {(['light', 'dark', 'system'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={preferences.theme === value}
                onChange={() => changePreference('theme', value)}
              />
              {value[0]!.toUpperCase() + value.slice(1)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Font size</legend>
          {(['compact', 'default', 'large'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="font-size"
                value={value}
                checked={preferences.fontSize === value}
                onChange={() => changePreference('fontSize', value)}
              />
              {value[0]!.toUpperCase() + value.slice(1)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Line width</legend>
          {(['narrow', 'default', 'wide'] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="line-width"
                value={value}
                checked={preferences.lineWidth === value}
                onChange={() => changePreference('lineWidth', value)}
              />
              {value[0]!.toUpperCase() + value.slice(1)}
            </label>
          ))}
        </fieldset>
        <label className="focus-setting">
          <input
            type="checkbox"
            checked={preferences.focusMode}
            onChange={(event) =>
              changePreference('focusMode', event.target.checked)
            }
          />
          Focus mode
        </label>
      </section>

      <section aria-labelledby="backup-heading" className="backup-settings">
        <h3 id="backup-heading">Local data and backup</h3>
        <p>{PRIVACY_COPY}</p>
        {recovery && recoveryCopy && (
          <div className="recovery-notice" aria-live="polite">
            <p>{recoveryCopy.message}</p>
            <div className="recovery-actions">
              <button
                type="button"
                className="learning-button"
                onClick={() =>
                  downloadPayload(recovery.payload, recoveryCopy.filename)
                }
              >
                <Download aria-hidden="true" /> {recoveryCopy.action}
              </button>
              <button
                type="button"
                className="learning-button"
                onClick={dismissRecovery}
              >
                Dismiss recovery notice
              </button>
            </div>
          </div>
        )}
        <div className="backup-actions">
          <button
            type="button"
            className="learning-button"
            onClick={handleExport}
          >
            <Download aria-hidden="true" /> Export backup
          </button>
          <label className="learning-button file-button">
            <Upload aria-hidden="true" /> Choose backup to import
            <input
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <button
            type="button"
            className="learning-button danger"
            onClick={() => {
              setResetMessage('');
              setResetOpen(true);
            }}
          >
            Reset learning data
          </button>
        </div>
      </section>

      <output className="learning-live" aria-live="polite">
        {message}
      </output>

      <AlertDialog
        open={Boolean(importCandidate)}
        onOpenChange={(open) => !open && setImportCandidate(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import this backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace current learning data only after confirmation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {counts && (
            <ul className="import-counts">
              <li>{counts.completed} completed sections</li>
              <li>{counts.notes} notes</li>
              <li>{counts.bookmarks} bookmarks</li>
              <li>{counts.attempts} knowledge-check attempts</li>
            </ul>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>
              Import backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) {
            setResetText('');
            setResetMessage('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all learning data?</AlertDialogTitle>
            <AlertDialogDescription>
              Type RESET to remove only this course&apos;s progress, notes,
              bookmarks, self-assessments, and preferences.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="reset-confirmation">Type RESET</label>
          <input
            id="reset-confirmation"
            value={resetText}
            onChange={(event) => {
              setResetText(event.target.value);
              setResetMessage('');
            }}
            autoComplete="off"
          />
          <output className="learning-live" aria-live="assertive">
            {resetMessage}
          </output>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetText !== 'RESET'}
              onClick={confirmReset}
            >
              Reset learning data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
