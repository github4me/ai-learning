import { z } from 'zod';

export const PreferenceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  fontSize: z.enum(['compact', 'default', 'large']),
  lineWidth: z.enum(['narrow', 'default', 'wide']),
  focusMode: z.boolean(),
});

export const LearningStateV1Schema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string(),
  lastLocation: z.object({ unitId: z.string(), sectionId: z.string() }).nullable(),
  completedSectionIds: z.array(z.string()),
  appendixReadSectionIds: z.array(z.string()),
  bookmarks: z.array(z.object({ id: z.string(), sectionId: z.string(), excerpt: z.string(), createdAt: z.string() })),
  notesBySection: z.record(z.string(), z.object({ text: z.string(), updatedAt: z.string() })),
  quizAttemptsByQuestion: z.record(z.string(), z.object({ status: z.enum(['understood', 'review']), reviewedAt: z.string() })),
  preferences: PreferenceSchema,
  updatedAt: z.string(),
});

export type LearningStateV1 = z.infer<typeof LearningStateV1Schema>;
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
  const source = z.record(z.string(), z.unknown()).parse(value);
  const version = source.schemaVersion;
  if (typeof version === 'number' && version > 1) throw new Error('Unsupported learning-state schema version');
  if (version === 0) {
    const initial = createInitialLearningState(contentVersion);
    const migrated = {
      ...initial,
      contentVersion: typeof source.contentVersion === 'string' ? source.contentVersion : contentVersion,
      lastLocation: z.object({ unitId: z.string(), sectionId: z.string() }).nullable().catch(null).parse(source.lastLocation),
      completedSectionIds: z.array(z.string()).catch([]).parse(source.completedSectionIds),
      appendixReadSectionIds: z.array(z.string()).catch([]).parse(source.appendixReadSectionIds),
      bookmarks: z.array(z.object({ id: z.string(), sectionId: z.string(), excerpt: z.string(), createdAt: z.string() })).catch([]).parse(source.bookmarks),
      notesBySection: z.record(z.string(), z.object({ text: z.string(), updatedAt: z.string() })).catch({}).parse(source.notesBySection),
      quizAttemptsByQuestion: z.record(z.string(), z.object({ status: z.enum(['understood', 'review']), reviewedAt: z.string() })).catch({}).parse(source.quizAttemptsByQuestion),
      preferences: PreferenceSchema.catch(initial.preferences).parse(source.preferences),
      updatedAt: z.string().catch(initial.updatedAt).parse(source.updatedAt),
    };
    return applyAliases(LearningStateV1Schema.parse(migrated), aliases);
  }
  return applyAliases(LearningStateV1Schema.parse(source), aliases);
}
