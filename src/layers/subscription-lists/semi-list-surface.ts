import { type Component, mount, unmount } from "svelte";

import { onPageState } from "@/lib/page/page-state";
import { elementSchema } from "@/lib/schemas/dom";
import type { SemiSubscription } from "@/lib/schemas/semi-subscription";
import { createFrameScheduler, observeSubtree } from "@/lib/utils/dom";
import { onYouTubeNavigate } from "@/lib/youtube/page/navigation";
import { z } from "@/lib/zod";

import { listsView } from "./lists-view.svelte";

export enum SemiListSurface {
  MOBILE_CHANNELS = "mobile-channels",
  MOBILE_STRIP = "mobile-strip"
}

const SURFACE_ATTRIBUTE = "data-yss-surface";
/** Stops a tug of war with a page that keeps dropping foreign nodes */
const MAX_MOUNTS_PER_PAGE = 20;

/** Where a surface mounts: into `target`, before `anchor` (or at its end) */
const placementSchema = z.object({
  target: elementSchema,
  anchor: elementSchema.nullable()
});
type Placement = z.infer<typeof placementSchema>;

/** Attachment for a surface's root element(s), so the surface can tell whether YouTube re-rendered it away */
export function markSurface(surface: SemiListSurface) {
  return function mark(element: Element) {
    element.setAttribute(SURFACE_ATTRIBUTE, surface);
  };
}

/**
 * Observes one page's DOM only while that page is open: `watch()` (re)attaches the observer for the current page
 * and says whether it is open; `onChange` runs on every mutation under `observedSelector`
 */
export function createPageWatcher({
  pathname,
  observedSelector,
  onChange
}: {
  pathname: string;
  observedSelector: string;
  onChange: () => void;
}) {
  let observer: MutationObserver | null = null;
  let elObserved: Element | null = null;

  return function watch() {
    const isOnPage = location.pathname === pathname;
    if (!isOnPage) {
      observer?.disconnect();
      observer = null;
      elObserved = null;
      return false;
    }

    const elRoot = document.querySelector(observedSelector) ?? document.documentElement;
    if (elRoot !== elObserved) {
      observer?.disconnect();
      elObserved = elRoot;
      observer = observeSubtree({
        elements: [elRoot],
        onChange
      });
    }

    return true;
  };
}

function listEverySubscription(subscriptions: readonly SemiSubscription[]) {
  return subscriptions;
}

/**
 * Keeps one Svelte list mounted on one page: mounted while `pathname` is open and there is something to list,
 * re-mounted when YouTube re-renders it away, unmounted on leaving the page, when the list empties or the
 * extension is turned off. The page's DOM is only observed while that page is open. `listShown` picks the channels
 * the component renders (every one by default), so a list with nothing to render is never mounted - it would never
 * read as in place, and every page change would mount it again
 */
export function startSemiListSurface({
  surface,
  pathname,
  observedSelector,
  findPlacement,
  component,
  listShown = listEverySubscription
}: {
  surface: SemiListSurface;
  pathname: string;
  observedSelector: string;
  findPlacement: () => Placement | null;
  component: Component;
  listShown?: (subscriptions: readonly SemiSubscription[]) => readonly SemiSubscription[];
}) {
  let mounted: ReturnType<typeof mount> | null = null;
  let mountCount = 0;
  const scheduleSync = createFrameScheduler(sync);
  const watchPage = createPageWatcher({
    pathname,
    observedSelector,
    onChange: scheduleSync
  });

  function detach() {
    if (!mounted) {
      return;
    }

    unmount(mounted).catch(() => {});
    mounted = null;
  }

  function sync() {
    const isOnPage = watchPage();
    const isWanted = isOnPage && listShown(listsView.subscriptions).length > 0;
    const placement = isWanted ? findPlacement() : null;
    if (!placement) {
      detach();
      return;
    }

    const elMounted = document.querySelector(`[${SURFACE_ATTRIBUTE}="${surface}"]`);
    const isInPlace = mounted !== null && elMounted?.parentElement === placement.target;
    if (isInPlace) {
      return;
    }

    detach();
    const isOverBudget = mountCount >= MAX_MOUNTS_PER_PAGE;
    if (isOverBudget) {
      return;
    }

    mountCount++;
    mounted = mount(component, {
      target: placement.target,
      anchor: placement.anchor ?? undefined
    });
  }

  onYouTubeNavigate(() => {
    mountCount = 0;
    scheduleSync();
  });
  onPageState(scheduleSync);
  scheduleSync();
}
