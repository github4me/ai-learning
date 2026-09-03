const PENDING_SEARCH_FOCUS_KEY = 'ai-first-principles:pending-search-focus';
export const SECTION_FOCUS_EVENT = 'ai-course:search-result-focus';
export const SEARCH_RESULT_FOCUS_EVENT = SECTION_FOCUS_EVENT;
let memoryPendingFocus: string | undefined;
let outerNotificationFrame: number | undefined;
let innerNotificationFrame: number | undefined;

type AnchorActivation = {
  defaultPrevented: boolean;
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

function decodeFragment(hash: string): string {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

export function requestSectionFocus(sectionId: string): void {
  memoryPendingFocus = sectionId;
  try {
    window.sessionStorage.setItem(PENDING_SEARCH_FOCUS_KEY, sectionId);
  } catch {
    // The in-memory handoff still supports focus when storage is blocked.
  }
}

export function consumeSectionFocus(...sectionIds: string[]): boolean {
  let pending = memoryPendingFocus;
  try {
    pending =
      window.sessionStorage.getItem(PENDING_SEARCH_FOCUS_KEY) ?? pending;
  } catch {
    // Read the in-memory handoff when session storage is blocked.
  }
  if (!pending || !sectionIds.includes(pending)) return false;
  memoryPendingFocus = undefined;
  try {
    window.sessionStorage.removeItem(PENDING_SEARCH_FOCUS_KEY);
  } catch {
    // The matching in-memory handoff has already been consumed.
  }
  return true;
}

export function notifySectionNavigation(): void {
  window.dispatchEvent(new Event(SECTION_FOCUS_EVENT));
}

export function requestSectionAnchorFocus(
  sectionId: string,
  activation?: AnchorActivation,
): void {
  if (
    activation?.defaultPrevented ||
    (activation &&
      (activation.button !== 0 ||
        activation.altKey ||
        activation.ctrlKey ||
        activation.metaKey ||
        activation.shiftKey))
  )
    return;
  if (outerNotificationFrame !== undefined)
    window.cancelAnimationFrame(outerNotificationFrame);
  if (innerNotificationFrame !== undefined)
    window.cancelAnimationFrame(innerNotificationFrame);
  requestSectionFocus(sectionId);
  if (decodeFragment(window.location.hash) !== sectionId) return;
  outerNotificationFrame = window.requestAnimationFrame(() => {
    innerNotificationFrame = window.requestAnimationFrame(
      notifySectionNavigation,
    );
  });
}

export function requestSearchResultFocus(sectionId: string): void {
  requestSectionFocus(sectionId);
}

export function consumeSearchResultFocus(sectionId: string): boolean {
  return consumeSectionFocus(sectionId);
}

export function notifySearchResultNavigation(): void {
  notifySectionNavigation();
}
