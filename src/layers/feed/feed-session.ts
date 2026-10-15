import { findLoadedAvatarUrl, findNativeRenderer, loadChannelNatives } from "./channel-natives";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState, onPageState } from "@/lib/page/page-state";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { planFeedBand } from "#feed/compose/feed-band";
import { composeFeedContents } from "#feed/compose/feed-compose";

// Page-session glue between the pure feed composition and the live page: the extension state, the natives cache,
// and the ids this page session inserted (the only feed videos it may later take out)

const PREFETCH_VIDEO_LIMIT = 20;

const insertedVideoIds = new Set<string>();

function desiredFeedVideos(state: PageState) {
  return state.isExtensionEnabled ? state.feedVideos : [];
}

export function recordFeedChange({ insertedIds, removedIds }: {
  insertedIds: readonly string[];
  removedIds: readonly string[];
}) {
  for (const videoId of insertedIds) {
    insertedVideoIds.add(videoId);
  }

  for (const videoId of removedIds) {
    insertedVideoIds.delete(videoId);
  }
}

/** Inserted videos that no longer pass (filter edited, channel dropped, extension switched off) */
export function findStaleInsertedIds(state: PageState) {
  const desiredIds = new Set(desiredFeedVideos(state).map(video => video.videoId));
  return new Set([...insertedVideoIds].filter(videoId => !desiredIds.has(videoId)));
}

function pageLocale() {
  return document.documentElement.lang || navigator.language;
}

export function planForPageState({ contents, state, removedVideoIds }: {
  contents: readonly unknown[];
  state: PageState;
  removedVideoIds: ReadonlySet<string>;
}) {
  return planFeedBand({
    contents,
    videos: desiredFeedVideos(state),
    now: Date.now(),
    removedVideoIds
  });
}

export function composeForPageState({ contents, state, removedVideoIds }: {
  contents: readonly unknown[];
  state: PageState;
  removedVideoIds: ReadonlySet<string>;
}) {
  return composeFeedContents({
    contents,
    videos: desiredFeedVideos(state),
    subscriptions: state.subscriptions,
    removedVideoIds,
    now: Date.now(),
    locale: pageLocale(),
    findNative: video => findNativeRenderer({
      channelId: video.channelId,
      videoId: video.videoId
    }),
    findAvatarUrl: findLoadedAvatarUrl
  });
}

/** Resolves with the promise's value, or null once the deadline passes (or the promise rejects) */
export function settleBefore<T>({ promise, deadline }: {
  promise: Promise<T>;
  deadline: number;
}) {
  return new Promise<T | null>(resolve => {
    const timer = setTimeout(() => resolve(null), Math.max(0, deadline - Date.now()));
    function settle(value: T | null) {
      clearTimeout(timer);
      resolve(value);
    }

    promise.then(settle, () => settle(null));
  });
}

export function waitForPageState(deadline: number) {
  const state = getPageState();
  if (state) {
    return Promise.resolve(state);
  }

  return settleBefore({
    promise: new Promise<PageState>(resolve => {
      const stopListening = onPageState(nextState => {
        stopListening();
        resolve(nextState);
      });
    }),
    deadline
  });
}

export function loadNativesFor({ videos, deadline }: {
  videos: readonly FeedVideo[];
  deadline: number;
}) {
  const channelIds = new Set(videos.map(video => video.channelId));
  return settleBefore({
    promise: Promise.all([...channelIds].map(loadChannelNatives)),
    deadline
  });
}

/** Warms the natives cache before YouTube's own feed request needs it */
export function prefetchFeedNatives() {
  const state = getPageState();
  if (!state) {
    return;
  }

  const channelIds = new Set(desiredFeedVideos(state).slice(0, PREFETCH_VIDEO_LIMIT).map(video => video.channelId));
  for (const channelId of channelIds) {
    loadChannelNatives(channelId).catch(() => {});
  }
}
