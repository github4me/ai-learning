export type CuratedBodyBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'formula'; latex: string; accessibleText: string }
  | { type: 'code'; language: string; filename?: string; code: string }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }
  | { type: 'conceptChain'; steps: string[] }
  | {
      type: 'callout';
      tone: 'concept' | 'principle' | 'example';
      title: string;
      blocks: CuratedBodyBlock[];
    };

export type TeachingCheck = {
  prompt: string;
  answer: CuratedBodyBlock[];
};

export type TeachingSectionRevision = {
  sectionId: string;
  title?: string;
  problem: string;
  purpose: string[];
  blocks: [CuratedBodyBlock, ...CuratedBodyBlock[]];
  pitfalls: string[];
  check: TeachingCheck;
  collapseChildren: true;
};

export type CuratedWeekRevision = {
  weekSlug: `week-${string}`;
  title: string;
  keyQuestion: string;
  objectives: string[];
  estimatedReadingMinutes: number;
  sections: TeachingSectionRevision[];
};
