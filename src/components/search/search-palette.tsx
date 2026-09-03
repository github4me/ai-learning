'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useFlushPendingNotes } from '@/src/components/providers';
import {
  courseUnitPath,
  getCourse,
  getUnit,
} from '@/src/content/course-runtime';
import { GLOSSARY_ENTRIES } from '@/src/content/glossary';
import {
  createCourseSearch,
  searchCourse,
  suggestCourse,
  type CourseSearchIndex,
  type SearchResult,
} from '@/src/search/course-search';
import {
  notifySearchResultNavigation,
  requestSearchResultFocus,
} from '@/src/search/search-focus';

let cachedSearchIndex: CourseSearchIndex | undefined;

function getSearchIndex(): CourseSearchIndex {
  cachedSearchIndex ??= createCourseSearch(getCourse(), {
    glossary: GLOSSARY_ENTRIES,
  });
  return cachedSearchIndex;
}

function destinationFor(result: SearchResult): string {
  const unit = getUnit(result.unitId);
  if (!unit)
    throw new Error(`Search result has no routable unit: ${result.unitId}`);
  return `${courseUnitPath(unit)}#${result.sectionId}`;
}

export type SearchPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export default function SearchPalette({
  open,
  onOpenChange,
  returnFocusRef,
}: SearchPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [activeValue, setActiveValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigating = React.useRef(false);
  const flushPendingNotes = useFlushPendingNotes();
  const index = React.useMemo(() => getSearchIndex(), []);
  const results = React.useMemo(
    () => searchCourse(index, query),
    [index, query],
  );
  const suggestions = React.useMemo(
    () =>
      query.trim() && results.length === 0 ? suggestCourse(index, query) : [],
    [index, query, results.length],
  );
  const groups = React.useMemo(() => {
    const grouped = new Map<string, SearchResult[]>();
    for (const result of results) {
      const current = grouped.get(result.group.title) ?? [];
      current.push(result);
      grouped.set(result.group.title, current);
    }
    return grouped;
  }, [results]);

  const resolvedActiveValue = results.some(
    (result) => result.sectionId === activeValue,
  )
    ? activeValue
    : (results[0]?.sectionId ?? '');

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function changeOpen(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen || navigating.current) return;
    window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
  }

  function selectResult(result: SearchResult) {
    const destination = destinationFor(result);
    flushPendingNotes();
    requestSearchResultFocus(result.sectionId);
    navigating.current = true;
    onOpenChange(false);
    window.requestAnimationFrame(() => {
      router.push(destination);
      window.requestAnimationFrame(notifySearchResultNavigation);
    });
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Search course / 搜索课程"
      description="Search headings, explanations, formulas, glossary terms, and code labels."
      className="search-palette"
    >
      <Command
        value={resolvedActiveValue}
        onValueChange={setActiveValue}
        shouldFilter={false}
        loop
      >
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={setQuery}
          placeholder="Search concepts or code / 搜索概念或代码"
          aria-label="Search course"
        />
        <CommandList>
          {query.trim() && results.length === 0 && (
            <CommandEmpty className="search-empty">
              <p>No matching lesson / 没有匹配的课程内容</p>
              {suggestions.length > 0 && (
                <div
                  className="search-suggestions"
                  aria-label="Search suggestions"
                >
                  <span>Try:</span>
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {suggestions.length === 0 && (
                <p>No deterministic spelling suggestion is available.</p>
              )}
            </CommandEmpty>
          )}
          {!query.trim() && (
            <div className="search-prompt">
              Search by 中文概念, English technical term, formula, or code
              label.
            </div>
          )}
          {[...groups.entries()].map(([groupTitle, groupResults]) => (
            <CommandGroup key={groupTitle} heading={groupTitle}>
              {groupResults.map((result) => (
                <CommandItem
                  key={result.sectionId}
                  value={result.sectionId}
                  onSelect={() => selectResult(result)}
                >
                  <span className="search-result-copy">
                    <strong>{result.title}</strong>
                    <span>{result.excerpt}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
