import { findLoadedAvatarUrl, findNativeRenderer, findNativeShort, loadChannelNatives } from "./channel-natives";
import { createVideoJudge, MatchState } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState, onPageState } from "@/lib/page/page-state";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { composeFeedContents, planFeed } from "#feed/compose/feed-compose";
import { channelIdFromGridItem, titleFromGridItem, videoIdFromGridItem } from "#feed/items/feed-items";
import { isShortsInjectionAllowed } from "#feed/live/ytaf";

// Page-session glue between the pure feed composition and the live page: the extension state, the natives cache,
// and the ids this page session inserted (the only feed videos it may later take out - besides what a resumed
// channel left behind)

const PREFETCH_VIDEO_LIMIT = 20;

const insertedVideoIds = new Set<string>();
/** Channels whose semi-subscription resumed - the user unsubscribed - while their unfiltered videos may still show */
const resumedChannelIds = new Set<string>();
let previousState: PageState | null = null;

function desiredFeedVideos(state: PageState) {
  if (!state.isExtensionEnabled) {
    return [];
  }

  return isShortsInjectionAllowed() ? state.feedVideos : state.feedVideos.filter(video => !video.isShort);
}

export function recordFeedChange({ insertedIds, removedIds }: Pick<
  NonNullable<ReturnType<typeof composeFeedContents>>,
  "insertedIds" | "removedIds"
>) {
  for (const videoId of insertedIds) {
    insertedVideoIds.add(videoId);
  }

  for (const videoId of removedIds) {
    insertedVideoIds.delete(videoId);
  }
}

/**
 * Follows every page state for halts and resumes. A halt - the user subscribed - hands the channel's inserted videos
 * over to YouTube: they belong in the feed now, so they are never taken out. A resume - the user unsubscribed - leaves
 * the channel's videos the filter rejects to be taken out, so the feed ends up as a reload would show it
 */
export function trackHaltTransitions(state: PageState) {
  const previous = previousState;
  previousState = state;
  for (const [channelId, { isHalted }] of Object.entries(state.subscriptions)) {
    const wasHalted = previous?.subscriptions[channelId]?.isHalted;
    const isTransition = wasHalted !== undefined && wasHalted !== isHalted;
    if (!isTransition) {
      continue;
    }

    if (!isHalted) {
      resumedChannelIds.add(channelId);
      continue;
    }

    resumedChannelIds.delete(channelId);
    for (const video of previous?.feedVideos ?? []) {
      if (video.channelId === channelId) {
        insertedVideoIds.delete(video.videoId);
      }
    }
  }
}

export function hasResumedChannels() {
  return resumedChannelIds.size > 0;
}

/**
 * A resumed channel's videos in the feed, each judged by the channel's filter - by title, or by verdict for an AI
 * filter (pending without one) - not by the cached uploads, which lag right after a resume. A paused filter lets none
 * through. A video several channels share is never judged
 */
function judgeResumedChannelVideos({ contents, state }: {
  contents: readonly unknown[];
  state: PageState;
}) {
  return contents.flatMap(item => {
    const channelId = channelIdFromGridItem(item);
    const videoId = videoIdFromGridItem(item);
    const subscription = channelId && resumedChannelIds.has(channelId) ? state.subscriptions[channelId] : undefined;
    if (!subscription || !videoId) {
      return [];
    }

    const judge = createVideoJudge({
      filter: subscription.filter,
      aiVerdicts: state.aiVerdicts,
      isAiEnabled: state.isAiEnabled
    });
    const matchState = judge ?
      judge({
        videoId,
        title: titleFromGridItem(item) ?? ""
      }) :
      MatchState.doesNotMatch;
    return [{
      videoId,
      matchState
    }];
  });
}

/**
 * Feed videos to take out: inserted ones that no longer pass (filter edited, channel dropped, extension switched off),
 * and a resumed channel's videos its filter rejects
 */
export function findRemovedVideoIds({ contents, state }: Parameters<typeof judgeResumedChannelVideos>[0]) {
  const desiredIds = new Set(desiredFeedVideos(state).map(video => video.videoId));
  const removedIds = new Set([...insertedVideoIds].filter(videoId => !desiredIds.has(videoId)));
  for (const { videoId, matchState } of judgeResumedChannelVideos({
    contents,
    state
  })) {
    // With the extension off nothing semi-subscribed passes
    const isRejected = matchState === MatchState.doesNotMatch || !state.isExtensionEnabled;
    if (isRejected && !desiredIds.has(videoId)) {
      removedIds.add(videoId);
    }
  }
  return removedIds;
}

/**
 * Once a resumed channel's rejected videos are out, the ones that passed are this session's to manage like the ones
 * it inserted - so a later filter edit takes them out too
 */
export function settleResumedChannels({ contents, state }: Parameters<typeof judgeResumedChannelVideos>[0]) {
  for (const { videoId, matchState } of judgeResumedChannelVideos({
    contents,
    state
  })) {
    if (matchState === MatchState.matches) {
      insertedVideoIds.add(videoId);
    }
  }
  resumedChannelIds.clear();
}

function pageLocale() {
  return document.documentElement.lang || navigator.language;
}

export function planForPageState({ contents, state, removedVideoIds }: {
  contents: readonly unknown[];
  state: PageState;
  removedVideoIds: ReadonlySet<string>;
}) {
  return planFeed({
    contents,
    videos: desiredFeedVideos(state),
    now: Date.now(),
    removedVideoIds
  });
}

export function composeForPageState({ contents, state, removedVideoIds }: Parameters<typeof planForPageState>[0]) {
  return composeFeedContents({
    contents,
    videos: desiredFeedVideos(state),
    subscriptions: state.subscriptions,
    removedVideoIds,
    now: Date.now(),
    locale: pageLocale(),
    findNative: findNativeRenderer,
    findNativeShort,
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
  return settleBefore({
    promise: loadChannelNatives(videos),
    deadline
  });
}

/** Warms the natives cache before YouTube's own feed request needs it */
export function prefetchFeedNatives() {
  const state = getPageState();
  if (!state) {
    return;
  }

  loadChannelNatives(desiredFeedVideos(state).slice(0, PREFETCH_VIDEO_LIMIT)).catch(() => {});
}
