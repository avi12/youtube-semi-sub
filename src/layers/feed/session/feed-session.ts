import {
  findLoadedAvatarUrl,
  findLoadedIsVerified,
  findNativeRenderer,
  findNativeShort,
  loadChannelNatives
} from "#feed/channel-natives";
import { composeFeedContents, planFeed } from "#feed/compose/feed-compose";
import type { PlacementAnchor } from "#feed/compose/feed-slot";
import { durationFromRenderer, isMembersOnlyRenderer, titleFromRenderer } from "#feed/items/feed-items";
import { isShortsInjectionAllowed } from "#feed/live/ytaf";
import { findHiddenVideoIds } from "#feed/session/hidden-videos";
import { insertedVideoIds } from "#feed/session/inserted-videos";
import { judgeResumedChannelVideos } from "#feed/session/resumed-channels";
import { MatchState } from "@/lib/filter/schema/video-filter-schema";
import { selectFeedVideos } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getPageState, onPageState } from "@/lib/page/page-state";
import type { FeedVideo, VideosByChannel } from "@/lib/schemas/feed-video";
import { settleBefore } from "@/lib/utils/promise";

// Page-session glue between the pure feed composition and the live page: the extension state, the natives cache,
// and the ids this page session inserted. Those are the only semi-sub videos it may later take out; besides them it
// takes out what a channel left behind when the user unsubscribed, and what a subscribed channel's hide filter hides

const PREFETCH_VIDEO_LIMIT = 20;

/** The feed item each inserted video was first placed beside, so a refetched feed never moves it */
const placementAnchors = new Map<string, PlacementAnchor>();

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
    ...(durationSeconds !== undefined && {
      durationSeconds
    }),
    ...(isMembersOnly !== undefined && {
      isMembersOnly
    })
  };
}

/** The followed channels' videos their follow filter passes, newest first, each judged by the title it will show */
function selectPageFeedVideos({ followedUploads, ...state }: PageState) {
  const videosByChannel: VideosByChannel = {};
  for (const video of followedUploads.map(withShownTitle)) {
    videosByChannel[video.channelId] = [...(videosByChannel[video.channelId] ?? []), video];
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
    const isRejected = matchState === MatchState.DOES_NOT_MATCH || !state.isExtensionEnabled;
    const isRemovable = isRejected && !desiredIds.has(videoId);
    if (isRemovable) {
      removedIds.add(videoId);
    }
  }
  return removedIds;
}

function pageLocale() {
  return document.documentElement.lang || navigator.language;
}

export function planForPageState({
  contents,
  state,
  removedVideoIds
}: {
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

export function loadNativesFor({ videos, deadline }: { videos: readonly FeedVideo[]; deadline: number }) {
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
