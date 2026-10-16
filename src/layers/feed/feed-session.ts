import { findLoadedAvatarUrl, findNativeRenderer, findNativeShort, loadChannelNatives } from "./channel-natives";
import { createModeJudge, MatchState } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState, onPageState } from "@/lib/page/page-state";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { composeFeedContents, planFeed } from "#feed/compose/feed-compose";
import {
  channelIdFromGridItem,
  shelfItemsFromGridItem,
  titleFromGridItem,
  videoIdFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { isShortsInjectionAllowed } from "#feed/live/ytaf";

// Page-session glue between the pure feed composition and the live page: the extension state, the natives cache,
// and the ids this page session inserted (the only feed videos it may later take out - besides what a channel left
// behind when the user unsubscribed)

const PREFETCH_VIDEO_LIMIT = 20;

const insertedVideoIds = new Set<string>();
/** Channels the user unsubscribed from - back to following - while their unfiltered videos may still show */
const resumedChannelIds = new Set<string>();
/** Per subscribed channel, the Shorts this session had inserted when subscribing handed them over to YouTube */
const handedOverShortIdsByChannel = new Map<string, Set<string>>();
let previousState: PageState | null = null;
let previousHideSettingsKey: string | null = null;
/** What hides videos changed since the feed last caught up with it */
let isHideSettingsChanged = false;

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
 * Follows every page state for subscribes and unsubscribes. Subscribing hands the channel's inserted videos over to
 * YouTube: they belong in the feed now, so they are never taken out as follow videos. Unsubscribing - a resume of
 * following - leaves the channel's videos the follow filter rejects to be taken out, so the feed ends up as a reload
 * would show it. A Short in the Shorts shelf names no channel to judge it by, so a resume takes back the Shorts the
 * subscribe handed over instead: managed again, they leave once the filter rejects them
 */
export function trackSubscriptionTransitions(state: PageState) {
  const previous = previousState;
  previousState = state;
  for (const [channelId, { isSubscribed }] of Object.entries(state.subscriptions)) {
    const wasSubscribed = previous?.subscriptions[channelId]?.isSubscribed;
    const isTransition = wasSubscribed !== undefined && wasSubscribed !== isSubscribed;
    if (!isTransition) {
      continue;
    }

    if (!isSubscribed) {
      resumedChannelIds.add(channelId);
      for (const videoId of handedOverShortIdsByChannel.get(channelId) ?? []) {
        insertedVideoIds.add(videoId);
      }
      handedOverShortIdsByChannel.delete(channelId);
      continue;
    }

    resumedChannelIds.delete(channelId);
    const handedOverShortIds = new Set<string>();
    for (const video of previous?.feedVideos ?? []) {
      const isHandedOver = video.channelId === channelId && insertedVideoIds.delete(video.videoId);
      if (isHandedOver && video.isShort) {
        handedOverShortIds.add(video.videoId);
      }
    }
    handedOverShortIdsByChannel.set(channelId, handedOverShortIds);
  }
}

/** Everything that decides what is hidden, besides the uploads and verdicts: the switch, each mode, each hide filter */
function readHideSettingsKey({ isExtensionEnabled, subscriptions }: PageState) {
  const channelSettings = Object.entries(subscriptions)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([channelId, { isSubscribed, hideFilter }]) => [channelId, isSubscribed, hideFilter]);
  return JSON.stringify([isExtensionEnabled, channelSettings]);
}

/** Follows every page state for a hide filter edited, a mode switched or the extension switched */
export function trackHideSettings(state: PageState) {
  const key = readHideSettingsKey(state);
  const isChanged = previousHideSettingsKey !== null && key !== previousHideSettingsKey;
  previousHideSettingsKey = key;
  isHideSettingsChanged ||= isChanged;
}

/** Whether what hides videos changed since the last call - a YouTube Auto Feed has to refetch to show it */
export function takeHideSettingsChange() {
  const isChanged = isHideSettingsChanged;
  isHideSettingsChanged = false;
  return isChanged;
}

export function hasResumedChannels() {
  return resumedChannelIds.size > 0;
}

/**
 * A resumed channel's videos in the feed, each judged by the channel's follow filter - by title, or by verdict for an
 * AI filter (pending without one) - not by the cached uploads, which lag right after a resume. A paused or unset
 * filter lets none through. A video several channels share is never judged
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

    const judge = createModeJudge({
      filter: subscription.followFilter,
      mode: SubscriptionMode.follow,
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
 * Whether a subscribed channel's hide filter hides this feed item: an upload the cache knows as the channel's own and
 * hidden, or a tile linking to that one channel alone whose title or verdict the filter matches. A Short names no
 * channel, so only the cache knows it; a video several channels share is hidden only when it is the channel's own
 */
function createHiddenItemCheck(state: PageState) {
  const cachedHiddenIds = new Set(state.hiddenVideoIds);
  return function isHiddenItem({ item, videoId }: {
    item: unknown;
    videoId: string;
  }) {
    if (cachedHiddenIds.has(videoId)) {
      return true;
    }

    const channelId = channelIdFromGridItem(item);
    const subscription = channelId ? state.subscriptions[channelId] : undefined;
    const judge = subscription?.isSubscribed && createModeJudge({
      filter: subscription.hideFilter,
      mode: SubscriptionMode.hide,
      aiVerdicts: state.aiVerdicts,
      isAiEnabled: state.isAiEnabled
    });
    if (!judge) {
      return false;
    }

    return judge({
      videoId,
      title: titleFromGridItem(item) ?? ""
    }) === MatchState.matches;
  };
}

/** The feed items, in the band or a shelf, that a subscribed channel's hide filter hides - none while switched off */
export function findHiddenVideoIds({ contents, state }: {
  contents: readonly unknown[];
  state: PageState;
}) {
  const hiddenIds = new Set<string>();
  if (!state.isExtensionEnabled) {
    return hiddenIds;
  }

  const isHiddenItem = createHiddenItemCheck(state);
  for (const item of contents.flatMap(gridItem => [gridItem, ...shelfItemsFromGridItem(gridItem)])) {
    const videoId = videoIdFromShelfItem(item);
    const isHidden = !!videoId && isHiddenItem({
      item,
      videoId
    });
    if (isHidden) {
      hiddenIds.add(videoId);
    }
  }
  return hiddenIds;
}

/**
 * Feed videos to take out: inserted ones that no longer pass (filter edited, channel dropped, extension switched off),
 * a resumed channel's videos its filter rejects, and the videos a subscribed channel's hide filter hides
 */
export function findRemovedVideoIds({ contents, state }: Parameters<typeof judgeResumedChannelVideos>[0]) {
  const desiredIds = new Set(desiredFeedVideos(state).map(video => video.videoId));
  const removedIds = new Set([...insertedVideoIds].filter(videoId => !desiredIds.has(videoId)));
  for (const videoId of findHiddenVideoIds({
    contents,
    state
  })) {
    removedIds.add(videoId);
  }
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
