import type { CuratedWeekRevision } from './types';
import { week06Revision } from './week-06';
import { week07Revision } from './week-07';
import { week08Revision } from './week-08';
import { week09Revision } from './week-09';
import { week10Revision } from './week-10';
import { week11Revision } from './week-11';

// Authored week modules append their checked-in revisions here.
export const CURATED_WEEK_REVISIONS: readonly CuratedWeekRevision[] = [
  week06Revision,
  week07Revision,
  week08Revision,
  week09Revision,
  week10Revision,
  week11Revision,
];

export { applyCuratedContent } from './apply-curated-content';
export { materializeTeachingSection } from './builders';
export type {
  CuratedBodyBlock,
  TeachingCheck,
  TeachingSectionRevision,
} from './types';
export type { CuratedWeekRevision } from './types';
