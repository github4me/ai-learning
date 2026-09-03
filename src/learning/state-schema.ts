import { z } from 'zod';

export const PreferenceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  fontSize: z.enum(['compact', 'default', 'large']),
  lineWidth: z.enum(['narrow', 'default', 'wide']),
  focusMode: z.boolean(),
}).strict();

const IsoTimestampSchema = z.iso.datetime({ offset: true });

const LocationSchema = z.object({ unitId: z.string(), sectionId: z.string() }).strict();
const BookmarkSchema = z.object({ id: z.string(), sectionId: z.string(), excerpt: z.string(), createdAt: IsoTimestampSchema }).strict();
const NoteSchema = z.object({ text: z.string(), updatedAt: IsoTimestampSchema }).strict();
const QuizAttemptSchema = z.object({ status: z.enum(['understood', 'review']), reviewedAt: IsoTimestampSchema }).strict();

export const LearningStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string(),
  lastLocation: LocationSchema.nullable(),
  completedSectionIds: z.array(z.string()),
  appendixReadSectionIds: z.array(z.string()),
  bookmarks: z.array(BookmarkSchema),
  notesBySection: z.record(z.string(), NoteSchema),
  quizAttemptsByQuestion: z.record(z.string(), QuizAttemptSchema),
  preferences: PreferenceSchema,
  updatedAt: IsoTimestampSchema,
}).strict();

export type LearningStateV1 = z.infer<typeof LearningStateV1Schema>;
export const LearningStateV0Schema = LearningStateV1Schema
  .omit({ schemaVersion: true })
  .extend({ schemaVersion: z.literal(0) })
  .strict();
export type SectionAliases = Record<string, string>;

export function createInitialLearningState(contentVersion: string, now = new Date().toISOString()): LearningStateV1 {
  return {
    schemaVersion: 1,
    contentVersion,
    lastLocation: null,
    completedSectionIds: [],
    appendixReadSectionIds: [],
    bookmarks: [],
    notesBySection: {},
    quizAttemptsByQuestion: {},
    preferences: { theme: 'system', fontSize: 'default', lineWidth: 'default', focusMode: false },
    updatedAt: now,
  };
}

function aliasId(id: string, aliases: SectionAliases): string {
  return aliases[id] ?? id;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function applyAliases(state: LearningStateV1, aliases: SectionAliases): LearningStateV1 {
  if (Object.keys(aliases).length === 0) return state;
  const notesBySection: LearningStateV1['notesBySection'] = {};
  for (const [key, note] of Object.entries(state.notesBySection)) {
    const sectionId = aliasId(key, aliases);
    const previous = notesBySection[sectionId];
    if (!previous || previous.updatedAt <= note.updatedAt) notesBySection[sectionId] = note;
  }
  const bookmarkBySection = new Map<string, LearningStateV1['bookmarks'][number]>();
  for (const bookmark of state.bookmarks) {
    const mapped = { ...bookmark, sectionId: aliasId(bookmark.sectionId, aliases) };
    const previous = bookmarkBySection.get(mapped.sectionId);
    if (!previous || previous.createdAt <= mapped.createdAt) bookmarkBySection.set(mapped.sectionId, mapped);
  }
  const quizAttemptsByQuestion: LearningStateV1['quizAttemptsByQuestion'] = {};
  for (const [id, attempt] of Object.entries(state.quizAttemptsByQuestion)) {
    const questionId = aliasId(id, aliases);
    const previous = quizAttemptsByQuestion[questionId];
    if (!previous || previous.reviewedAt <= attempt.reviewedAt) quizAttemptsByQuestion[questionId] = attempt;
  }
  return {
    ...state,
    lastLocation: state.lastLocation && { ...state.lastLocation, sectionId: aliasId(state.lastLocation.sectionId, aliases) },
    completedSectionIds: unique(state.completedSectionIds.map((id) => aliasId(id, aliases))),
    appendixReadSectionIds: unique(state.appendixReadSectionIds.map((id) => aliasId(id, aliases))),
    bookmarks: [...bookmarkBySection.values()],
    notesBySection,
    quizAttemptsByQuestion,
  };
}

/** Parses V1 and the intentionally small V0 compatibility shape before applying aliases. */
export function parseLearningState(value: unknown, contentVersion: string, aliases: SectionAliases = {}): LearningStateV1 {
  const version = z.looseObject({ schemaVersion: z.number() }).parse(value).schemaVersion;
  if (version > 1) throw new Error('Unsupported learning-state schema version');
  if (version === 0) {
    const v0 = LearningStateV0Schema.parse(value);
    return applyAliases(LearningStateV1Schema.parse({ ...v0, schemaVersion: 1 }), aliases);
  }
  return applyAliases(LearningStateV1Schema.parse(value), aliases);
}
