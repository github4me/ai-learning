import type { CuratedWeekRevision } from './types';
import { week06Revision } from './week-06';
import { week07Revision } from './week-07';
import { week08Revision } from './week-08';

// Authored week modules append their checked-in revisions here.
export const CURATED_WEEK_REVISIONS: readonly CuratedWeekRevision[] = [
  week06Revision,
  week07Revision,
  week08Revision,
];

export { applyCuratedContent } from './apply-curated-content';
export { materializeTeachingSection } from './builders';
export type {
  CuratedBodyBlock,
  TeachingCheck,
  TeachingSectionRevision,
} from './types';
export type { CuratedWeekRevision } from './types';
