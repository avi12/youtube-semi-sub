import {
  findLoadedAvatarUrl,
  findLoadedIsVerified,
  findNativeRenderer,
  findNativeShort,
  loadChannelNatives
} from "./channel-natives";
import { createModeJudge, createSubscribedHideCheck, MatchState, selectFeedVideos } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState, onPageState } from "@/lib/page/page-state";
import type { FeedVideo, VideosByChannel } from "@/lib/schemas/feed-video";
import { isUploadsTabDetailFiltered } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { settleBefore } from "@/lib/utils/promise";
import { readOfficialSubscription } from "#channel-button";
import { composeFeedContents, planFeed } from "#feed/compose/feed-compose";
import type { PlacementAnchor } from "#feed/compose/feed-slot";
import {
  channelIdsFromGridItem,
  durationFromGridItem,
  durationFromRenderer,
  isMembersOnlyRenderer,
  shelfItemsFromGridItem,
  titleFromGridItem,
  titleFromRenderer,
  videoIdFromGridItem,
  videoIdFromShelfItem
} from "#feed/items/feed-items";
import { isShortsInjectionAllowed } from "#feed/live/ytaf";

// Page-session glue between the pure feed composition and the live page: the extension state, the natives cache,
// and the ids this page session inserted. Those are the only semi-sub videos it may later take out; besides them it
// takes out what a channel left behind when the user unsubscribed, and what a subscribed channel's hide filter hides

const PREFETCH_VIDEO_LIMIT = 20;

const insertedVideoIds = new Set<string>();
/** The feed item each inserted video was first placed beside, so a refetched feed never moves it */
const placementAnchors = new Map<string, PlacementAnchor>();
/** Channels the user unsubscribed from - back to following - while their unfiltered videos may still show */
const resumedChannelIds = new Set<string>();
/** Per subscribed channel, the Shorts this session had inserted when subscribing handed them over to YouTube */
const handedOverShortIdsByChannel = new Map<string, Set<string>>();
let previousState: PageState | null = null;
let previousHideSettingsKey: string | null = null;
/** What hides videos changed since the feed last caught up with it */
let isHideSettingsChanged = false;

/**
 * A followed upload with the title its tile will show: the native renderer's, once loaded, else the cached one - and
 * the native's length and members-only badge when the cache lacks them
 */
function withShownTitle(video: FeedVideo) {
  const native = video.isShort ? null : findNativeRenderer(video);
  const nativeShort = video.isShort ? findNativeShort(video) : null;
  const shownTitle = native ? titleFromRenderer(native) : nativeShort?.overlayMetadata?.primaryText?.content;
  const durationSeconds = video.durationSeconds ?? (native ? durationFromRenderer(native) : undefined);
  const isMembersOnly = video.isMembersOnly ?? (native ? isMembersOnlyRenderer(native) : undefined);
  return {
    ...video,
    title: shownTitle ?? video.title,
    ...durationSeconds !== undefined && {
      durationSeconds
    },
    ...isMembersOnly !== undefined && {
      isMembersOnly
    }
  };
}

/** The followed channels' videos their follow filter passes, newest first, each judged by the title it will show */
function selectPageFeedVideos({ followedUploads, ...state }: PageState) {
  const videosByChannel: VideosByChannel = {};
  for (const video of followedUploads.map(withShownTitle)) {
    videosByChannel[video.channelId] = [...videosByChannel[video.channelId] ?? [], video];
  }
  return selectFeedVideos({
    subscriptions: state.subscriptions,
    videosByChannel,
    aiVerdicts: state.aiVerdicts,
    isAiEnabled: state.isAiEnabled
  });
}

function desiredFeedVideos(state: PageState) {
  if (!state.isExtensionEnabled) {
    return [];
  }

  const feedVideos = selectPageFeedVideos(state);
  return isShortsInjectionAllowed() ? feedVideos : feedVideos.filter(video => !video.isShort);
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
    const isPreviouslySubscribed = previous?.subscriptions[channelId]?.isSubscribed;
    const isTransition = isPreviouslySubscribed !== undefined && isPreviouslySubscribed !== isSubscribed;
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
    for (const video of previous?.followedUploads ?? []) {
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
    .map(([channelId, { isSubscribed, hideFilter, followFilter }]) => [
      channelId,
      isSubscribed,
      hideFilter,
      followFilter
    ]);
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
 * Whether the user is subscribed to a channel on YouTube: a semi-subscription's mode, else what this tab's data tells
 * (undefined when it tells nothing)
 */
function readIsChannelSubscribed({ channelId, state }: {
  channelId: string;
  state: PageState;
}) {
  return state.subscriptions[channelId]?.isSubscribed ?? readOfficialSubscription(channelId);
}

/**
 * A resumed channel's videos in the feed, each judged by the channel's follow filter - by title, or by verdict for an
 * AI filter (pending without one) - not by the cached uploads, which lag right after a resume. A paused or unset
 * filter lets none through. A collaboration is judged only when the user is known not to be subscribed to any other
 * channel on it - one they are, or may be, subscribed to keeps it in the feed
 */
function judgeResumedChannelVideos({ contents, state }: {
  contents: readonly unknown[];
  state: PageState;
}) {
  return contents.flatMap(item => {
    const channelIds = [...channelIdsFromGridItem(item)];
    const channelId = channelIds.find(id => resumedChannelIds.has(id));
    const videoId = videoIdFromGridItem(item);
    const subscription = channelId ? state.subscriptions[channelId] : undefined;
    const isKeptByOtherChannel = channelIds.some(id => id !== channelId && readIsChannelSubscribed({
      channelId: id,
      state
    }) !== false);
    if (!subscription || !videoId || isKeptByOtherChannel) {
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
        title: titleFromGridItem(item) ?? "",
        durationSeconds: durationFromGridItem(item)
      }) :
      MatchState.doesNotMatch;
    return [{
      videoId,
      matchState
    }];
  });
}

/**
 * Whether the subscribed channels' filters hide a feed item, judged by the title and length the item shows - a YouTube
 * title test can make the title differ from the cached one. A collaboration is hidden only when every channel on it
 * the user is subscribed to would hide it: one that keeps it - a subscribed channel whose filters let it through, or a
 * plain YouTube subscription - is reason enough to show it. Null for an item that names no channel, such as a Short:
 * only the cached uploads know whose it is - and for one a length or type filter judges, which the cached uploads
 * know from the channel's tabs
 */
function createShownTitleHideCheck(state: PageState) {
  return function isHiddenByShownTitle({ item, videoId }: {
    item: unknown;
    videoId: string;
  }) {
    const channelIds = [...channelIdsFromGridItem(item)];
    if (channelIds.length === 0) {
      return null;
    }

    const isKeptByPlainSubscription = channelIds.some(channelId => !state.subscriptions[channelId] &&
      readOfficialSubscription(channelId) === true);
    const filteredSubscriptions = channelIds.flatMap(channelId => {
      const subscription = state.subscriptions[channelId];
      return subscription?.isSubscribed ? [subscription] : [];
    });
    if (isKeptByPlainSubscription || filteredSubscriptions.length === 0) {
      return false;
    }

    const video = {
      videoId,
      title: titleFromGridItem(item) ?? "",
      durationSeconds: durationFromGridItem(item)
    };
    // A tile shows no upload type, and a live one no length - the cached uploads, filled from the channel's tabs, know
    const isTabDetailRead = filteredSubscriptions.some(isUploadsTabDetailFiltered);
    if (isTabDetailRead) {
      return null;
    }

    return filteredSubscriptions.every(subscription => {
      const isHidden = createSubscribedHideCheck({
        subscription,
        aiVerdicts: state.aiVerdicts,
        isAiEnabled: state.isAiEnabled
      });
      return !!isHidden && isHidden(video);
    });
  };
}

/**
 * What this session last judged each feed item that names its channels - the cached uploads can't tell a
 * collaboration from a solo upload, so a page that lacks an item keeps the item's own verdict. Dropped whenever what
 * hides videos changes
 */
let shownVerdicts = {
  settingsKey: "",
  isHiddenById: new Map<string, boolean>()
};

function readShownVerdicts(state: PageState) {
  const settingsKey = readHideSettingsKey(state);
  if (shownVerdicts.settingsKey !== settingsKey) {
    shownVerdicts = {
      settingsKey,
      isHiddenById: new Map()
    };
  }

  return shownVerdicts.isHiddenById;
}

/**
 * The videos subscribed channels' hide filters hide - none while switched off: every cached upload they hide, since a
 * page may lack one an earlier page put in the grid, then each feed item that names its channels, in the band or a
 * shelf, judged again by the title it shows - a verdict remembered for the pages that lack the item
 */
export function findHiddenVideoIds({ contents, state }: {
  contents: readonly unknown[];
  state: PageState;
}) {
  if (!state.isExtensionEnabled) {
    return new Set<string>();
  }

  const isHiddenById = readShownVerdicts(state);
  const hiddenIds = new Set(state.hiddenVideoIds.filter(videoId => isHiddenById.get(videoId) !== false));
  const isHiddenByShownTitle = createShownTitleHideCheck(state);
  for (const item of contents.flatMap(gridItem => [gridItem, ...shelfItemsFromGridItem(gridItem)])) {
    const videoId = videoIdFromShelfItem(item);
    if (!videoId) {
      continue;
    }

    const isHidden = isHiddenByShownTitle({
      item,
      videoId
    });
    if (isHidden === null) {
      continue;
    }

    isHiddenById.set(videoId, isHidden);

    if (isHidden) {
      hiddenIds.add(videoId);
    } else {
      hiddenIds.delete(videoId);
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
  const plan = planFeed({
    contents,
    videos: desiredFeedVideos(state),
    now: Date.now(),
    removedVideoIds,
    anchors: placementAnchors
  });
  for (const [videoId, anchor] of plan.band.placements) {
    if (!placementAnchors.has(videoId)) {
      placementAnchors.set(videoId, anchor);
    }
  }
  return plan;
}

export function composeForPageState({ contents, state, removedVideoIds }: Parameters<typeof planForPageState>[0]) {
  planForPageState({
    contents,
    state,
    removedVideoIds
  });
  return composeFeedContents({
    anchors: placementAnchors,
    contents,
    videos: desiredFeedVideos(state),
    subscriptions: state.subscriptions,
    removedVideoIds,
    now: Date.now(),
    locale: pageLocale(),
    findNative: findNativeRenderer,
    findNativeShort,
    findAvatarUrl: findLoadedAvatarUrl,
    findIsVerified: findLoadedIsVerified
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
