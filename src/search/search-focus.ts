const PENDING_SEARCH_FOCUS_KEY = 'ai-first-principles:pending-search-focus';
export const SEARCH_RESULT_FOCUS_EVENT = 'ai-course:search-result-focus';
let memoryPendingFocus: string | undefined;

export function requestSearchResultFocus(sectionId: string): void {
  memoryPendingFocus = sectionId;
  try {
    window.sessionStorage.setItem(PENDING_SEARCH_FOCUS_KEY, sectionId);
  } catch {
    // The in-memory handoff still supports focus when session storage is blocked.
  }
}

export function consumeSearchResultFocus(sectionId: string): boolean {
  let pending = memoryPendingFocus;
  try {
    pending =
      window.sessionStorage.getItem(PENDING_SEARCH_FOCUS_KEY) ?? pending;
  } catch {
    // Read the in-memory handoff when session storage is blocked.
  }
  if (pending !== sectionId) return false;
  memoryPendingFocus = undefined;
  try {
    window.sessionStorage.removeItem(PENDING_SEARCH_FOCUS_KEY);
  } catch {
    // The matching in-memory handoff has already been consumed.
  }
  return true;
}

export function notifySearchResultNavigation(): void {
  window.dispatchEvent(new Event(SEARCH_RESULT_FOCUS_EVENT));
}
