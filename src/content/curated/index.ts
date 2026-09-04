import type { CuratedWeekRevision } from './types';

// Authored week modules append their checked-in revisions here.
export const CURATED_WEEK_REVISIONS: readonly CuratedWeekRevision[] = [];

export { applyCuratedContent } from './apply-curated-content';
export { materializeTeachingSection } from './builders';
export type {
  CuratedBodyBlock,
  TeachingCheck,
  TeachingSectionRevision,
} from './types';
export type { CuratedWeekRevision } from './types';
