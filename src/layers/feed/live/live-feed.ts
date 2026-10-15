import { writeGridContents } from "./feed-flip";
import { type FeedGrid, findFeedGrid } from "./feed-grid";
import { isYouTubeAutoFeedPresent, nudgeYouTubeAutoFeed } from "./ytaf";
import { getPageState, onPageState } from "@/lib/page/page-state";
import { onYouTubeNavigate } from "@/lib/youtube/navigation";
import { z } from "@/lib/zod";
import {
  composeForPageState,
  findStaleInsertedIds,
  loadNativesFor,
  planForPageState,
  prefetchFeedNatives,
  recordFeedChange
} from "#feed/feed-session";
import { thumbnailUrlFromGridItem, videoIdFromGridItem } from "#feed/items/feed-items";
import { SUBSCRIPTIONS_BROWSE_ID } from "#feed/response/feed-response";

// Keeps an open subscriptions feed in step with the semi-sub videos: on a hard load (rendered from ytInitialData,
// which no response hook saw), after every navigation, and whenever the filtered videos change. Inserted videos
// that stop passing are taken out again. With YouTube Auto Feed present the grid is its to write

const FEED_PATHNAME = "/feed/subscriptions";
const LIVE_NATIVES_BUDGET_MS = 4000;
// www fires yt-navigate-start; m fires state-navigatestart
const NAVIGATION_START_EVENTS = ["yt-navigate-start", "state-navigatestart"] as const;

const navigationDetailSchema = z.looseObject({
  url: z.string().optional(),
  href: z.string().optional(),
  endpoint: z.looseObject({
    browseEndpoint: z.looseObject({ browseId: z.string() }).optional()
  }).optional()
});

let isReconciling = false;
let isReconcileQueued = false;
let lastYtafNudgeKey = "";

function isOnFeedPage() {
  return location.pathname === FEED_PATHNAME;
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

    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
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
    removedVideoIds: findStaleInsertedIds(state)
  });
  if (!plan.isChanged) {
    return;
  }

  if (isYouTubeAutoFeedPresent()) {
    const insertedIds = plan.insertedVideos.map(video => video.videoId);
    nudgeYouTubeAutoFeedOnce(JSON.stringify([insertedIds, plan.removedIds]));
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
    removedVideoIds: findStaleInsertedIds(currentState)
  });
  if (!composed) {
    return;
  }

  const insertedIds = new Set(composed.insertedIds);
  const thumbnailUrls = composed.contents
    .filter(item => insertedIds.has(videoIdFromGridItem(item) ?? ""))
    .flatMap(item => thumbnailUrlFromGridItem(item) ?? []);
  const isWritten = await writeGridContents({
    grid,
    contents: cloneMovedItems({
      previous: currentContents,
      next: composed.contents
    }),
    insertedIds,
    removedIds: new Set(composed.removedIds),
    thumbnailUrls,
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
  const isFeedUrl = [url, href].some(target => target?.includes(FEED_PATHNAME));
  return isFeedUrl || endpoint?.browseEndpoint?.browseId === SUBSCRIPTIONS_BROWSE_ID;
}

function handleNavigationStart(e: Event) {
  const isFeedTarget = e instanceof CustomEvent && isFeedNavigation(e.detail);
  if (isFeedTarget) {
    prefetchFeedNatives();
  }
}

export function startLiveFeed() {
  onPageState(requestReconcile);
  onYouTubeNavigate(requestReconcile);
  for (const eventName of NAVIGATION_START_EVENTS) {
    document.addEventListener(eventName, handleNavigationStart);
    addEventListener(eventName, handleNavigationStart);
  }
}
