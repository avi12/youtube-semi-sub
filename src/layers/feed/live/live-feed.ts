import { writeGridContents } from "./feed-flip";
import { type FeedGrid, findFeedGrid } from "./feed-grid";
import { isYouTubeAutoFeedActive, nudgeYouTubeAutoFeed, watchYouTubeAutoFeedSwitch } from "./ytaf";
import { getPageState, onPageState } from "@/lib/page/page-state";
import { observeSubtree } from "@/lib/utils/dom";
import { onYouTubeNavigate } from "@/lib/youtube/page/navigation";
import { browseEndpointSchema } from "@/lib/youtube/schemas/browse";
import { FeedPathname } from "@/lib/youtube/site";
import { z } from "@/lib/zod";
import {
  composeForPageState,
  findRemovedVideoIds,
  hasResumedChannels,
  loadNativesFor,
  planForPageState,
  prefetchFeedNatives,
  recordFeedChange,
  settleResumedChannels,
  takeHideSettingsChange,
  trackHideSettings,
  trackSubscriptionTransitions
} from "#feed/feed-session";
import {
  readShelf,
  shelfItemsFromGridItem,
  thumbnailUrlFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { SUBSCRIPTIONS_BROWSE_ID } from "#feed/response/feed-response";

// Keeps an open subscriptions feed in step with the semi-sub videos: on a hard load (rendered from ytInitialData,
// which no response hook saw), after every navigation, and whenever the filtered videos change. Inserted videos
// that stop passing are taken out again. A channel the user subscribes to is left to YouTube, minus what its hide
// filter hides - those leave the band and the Shorts shelf, animated like the rest; a hidden video let back in returns
// on the next feed load. Once the user unsubscribes, the channel's videos the follow filter rejects leave the feed.
// While YouTube Auto Feed runs (installed and switched on) the grid is its to write

const LIVE_NATIVES_BUDGET_MS = 4000;
// www fires yt-navigate-start; m fires state-navigatestart
const NAVIGATION_START_EVENTS = ["yt-navigate-start", "state-navigatestart"] as const;

const navigationDetailSchema = z.looseObject({
  url: z.string().optional(),
  href: z.string().optional(),
  endpoint: z.looseObject({
    browseEndpoint: browseEndpointSchema.optional()
  }).optional()
});

let isReconciling = false;
let isReconcileQueued = false;
let lastYtafNudgeKey = "";

function isOnFeedPage() {
  return location.pathname === FeedPathname.subscriptions;
}

function isSameContents({ left, right }: {
  left: readonly unknown[] | null;
  right: readonly unknown[];
}) {
  return left?.length === right.length && left.every((item, i) => item === right[i]);
}

/** Resolves once the feed grid holds contents, or null when the grid exposes no model or the user navigated away */
function waitForFeedGrid() {
  return new Promise<FeedGrid | null>(resolve => {
    function check() {
      if (!isOnFeedPage()) {
        resolve(null);
        return true;
      }

      const found = findFeedGrid();
      if (found && !found.isSupported) {
        resolve(null);
        return true;
      }

      const isReady = !!found && (found.grid.readContents()?.length ?? 0) > 0;
      if (found && isReady) {
        resolve(found.grid);
      }

      return isReady;
    }

    if (check()) {
      return;
    }

    const observer = observeSubtree({
      elements: [document.documentElement],
      onChange() {
        if (check()) {
          observer.disconnect();
        }
      }
    });
  });
}

/** Polymer re-renders a slot only for a new object, so an item that changed index is handed over as a copy */
function cloneMovedItems({ previous, next }: {
  previous: readonly unknown[];
  next: readonly unknown[];
}) {
  const iPreviousByItem = new Map(previous.map((item, i) => [item, i]));
  return next.map((item, i) => {
    const iPrevious = iPreviousByItem.get(item);
    const isMoved = iPrevious !== undefined && iPrevious !== i;
    return isMoved ? structuredClone(item) : item;
  });
}

/** `cloneMovedItems` for the grid, and for the items inside a shelf the write replaced */
function cloneMovedGridItems({ previous, next }: Parameters<typeof cloneMovedItems>[0]) {
  const previousItems = new Set(previous);
  return cloneMovedItems({
    previous,
    next
  }).map((item, i) => {
    const shelf = previousItems.has(item) ? null : readShelf(item);
    return shelf
      ? shelf.withItems(
        cloneMovedItems({
          previous: shelfItemsFromGridItem(previous[i]),
          next: shelf.items
        })
      )
      : item;
  });
}

/** The thumbnails of the items just inserted, in the grid or its Shorts shelf */
function collectInsertedThumbnailUrls({ contents, insertedIds }: {
  contents: readonly unknown[];
  insertedIds: ReadonlySet<string>;
}) {
  return contents
    .flatMap(item => [item, ...shelfItemsFromGridItem(item)])
    .filter(item => insertedIds.has(videoIdFromShelfItem(item) ?? ""))
    .flatMap(item => thumbnailUrlFromGridItem(item) ?? []);
}

function nudgeYouTubeAutoFeedOnce(key: string) {
  if (key === lastYtafNudgeKey) {
    return;
  }

  lastYtafNudgeKey = key;
  nudgeYouTubeAutoFeed();
}

async function reconcile() {
  const state = getPageState();
  if (!state || !isOnFeedPage()) {
    return;
  }

  const grid = await waitForFeedGrid();
  const contents = grid?.readContents();
  if (!grid || !contents) {
    return;
  }

  const plan = planForPageState({
    contents,
    state,
    removedVideoIds: findRemovedVideoIds({
      contents,
      state
    })
  });
  // ytaf's next poll lacks a resumed channel (the user unsubscribed), so ytaf animates its videos out itself and keeps
  // the ones the response hook adds back - each resume asks it to poll right away. So does a change to what is
  // hidden: the poll's response drops and lists the newly hidden videos, and holds the ones let back in
  if (isYouTubeAutoFeedActive()) {
    const isResumed = hasResumedChannels();
    const isHideSettingsChanged = takeHideSettingsChange();
    settleResumedChannels({
      contents,
      state
    });

    if (isResumed || isHideSettingsChanged) {
      nudgeYouTubeAutoFeed();
      return;
    }

    if (plan.isChanged) {
      const insertedIds = plan.insertedVideos.map(video => video.videoId);
      nudgeYouTubeAutoFeedOnce(JSON.stringify([insertedIds, plan.removedIds]));
    }

    return;
  }

  if (!plan.isChanged) {
    settleResumedChannels({
      contents,
      state
    });
    return;
  }

  await loadNativesFor({
    videos: plan.insertedVideos,
    deadline: Date.now() + LIVE_NATIVES_BUDGET_MS
  });

  const currentState = getPageState() ?? state;
  const currentContents = grid.readContents();
  if (!currentContents || !isOnFeedPage()) {
    return;
  }

  const composed = composeForPageState({
    contents: currentContents,
    state: currentState,
    removedVideoIds: findRemovedVideoIds({
      contents: currentContents,
      state: currentState
    })
  });
  if (!composed) {
    return;
  }

  const insertedIds = new Set(composed.insertedIds);
  const isWritten = await writeGridContents({
    grid,
    contents: cloneMovedGridItems({
      previous: currentContents,
      next: composed.contents
    }),
    insertedIds,
    removedIds: new Set(composed.removedIds),
    thumbnailUrls: collectInsertedThumbnailUrls({
      contents: composed.contents,
      insertedIds
    }),
    isAnimated: currentState.isAnimationsEnabled,
    isCurrent: () => isOnFeedPage() && isSameContents({
      left: grid.readContents(),
      right: currentContents
    })
  });
  if (!isWritten) {
    // YouTube re-rendered the grid meanwhile: start over from what it holds now
    isReconcileQueued = true;
    return;
  }

  recordFeedChange(composed);
  settleResumedChannels({
    contents: composed.contents,
    state: currentState
  });
}

function requestReconcile() {
  if (isReconciling) {
    isReconcileQueued = true;
    return;
  }

  isReconciling = true;
  reconcile()
    .finally(() => {
      isReconciling = false;

      if (isReconcileQueued) {
        isReconcileQueued = false;
        requestReconcile();
      }
    })
    .catch(() => {});
}

function isFeedNavigation(detail: unknown) {
  const parsed = navigationDetailSchema.safeParse(detail);
  if (!parsed.success) {
    return false;
  }

  const { url, href, endpoint } = parsed.data;
  const isFeedUrl = [url, href].some(target => target?.includes(FeedPathname.subscriptions));
  return isFeedUrl || endpoint?.browseEndpoint?.browseId === SUBSCRIPTIONS_BROWSE_ID;
}

function handleNavigationStart(e: Event) {
  const isFeedTarget = e instanceof CustomEvent && isFeedNavigation(e.detail);
  if (isFeedTarget) {
    prefetchFeedNatives();
  }
}

export function startLiveFeed() {
  // Before the reconcile listener, so a subscribe or unsubscribe is known by the time it plans
  onPageState(trackSubscriptionTransitions);
  onPageState(trackHideSettings);
  onPageState(requestReconcile);
  // Switched off, ytaf leaves the grid alone - from then on it is written here, and the other way round
  watchYouTubeAutoFeedSwitch(requestReconcile);
  onYouTubeNavigate(requestReconcile);
  for (const eventName of NAVIGATION_START_EVENTS) {
    document.addEventListener(eventName, handleNavigationStart);
    addEventListener(eventName, handleNavigationStart);
  }
}
