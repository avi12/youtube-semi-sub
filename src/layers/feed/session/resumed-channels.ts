import { readOfficialSubscription } from "#channel-button";
import {
  channelIdsFromGridItem,
  durationFromGridItem,
  titleFromGridItem,
  videoIdFromGridItem
} from "#feed/items/feed-items";
import { insertedVideoIds } from "#feed/session/inserted-videos";
import { MatchState } from "@/lib/filter/schema/video-filter-schema";
import { createModeJudge } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

/** Channels the user unsubscribed from - back to following - while their unfiltered videos may still show */
const resumedChannelIds = new Set<string>();
/** Per subscribed channel, the Shorts this session had inserted when subscribing handed them over to YouTube */
const handedOverShortIdsByChannel = new Map<string, Set<string>>();
let previousState: PageState | null = null;

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

export function hasResumedChannels() {
  return resumedChannelIds.size > 0;
}

/**
 * Whether the user is subscribed to a channel on YouTube: a semi-subscription's mode, else what this tab's data tells
 * (undefined when it tells nothing)
 */
function readIsChannelSubscribed({ channelId, state }: { channelId: string; state: PageState }) {
  return state.subscriptions[channelId]?.isSubscribed ?? readOfficialSubscription(channelId);
}

/**
 * A resumed channel's videos in the feed, each judged by the channel's follow filter - by title, or by verdict for an
 * AI filter (pending without one) - not by the cached uploads, which lag right after a resume. A paused or unset
 * filter lets none through. A collaboration is judged only when the user is known not to be subscribed to any other
 * channel on it - one they are, or may be, subscribed to keeps it in the feed
 */
export function judgeResumedChannelVideos({ contents, state }: { contents: readonly unknown[]; state: PageState }) {
  return contents.flatMap(item => {
    const channelIds = [...channelIdsFromGridItem(item)];
    const channelId = channelIds.find(id => resumedChannelIds.has(id));
    const videoId = videoIdFromGridItem(item);
    const subscription = channelId ? state.subscriptions[channelId] : undefined;
    const isKeptByOtherChannel = channelIds.some(
      id =>
        id !== channelId &&
        readIsChannelSubscribed({
          channelId: id,
          state
        }) !== false
    );
    if (!subscription || !videoId || isKeptByOtherChannel) {
      return [];
    }

    const judge = createModeJudge({
      filter: subscription.followFilter,
      mode: SubscriptionMode.FOLLOW,
      aiVerdicts: state.aiVerdicts,
      isAiEnabled: state.isAiEnabled
    });
    const matchState = judge
      ? judge({
          videoId,
          title: titleFromGridItem(item) ?? "",
          durationSeconds: durationFromGridItem(item)
        })
      : MatchState.DOES_NOT_MATCH;
    return [
      {
        videoId,
        matchState
      }
    ];
  });
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
    if (matchState === MatchState.MATCHES) {
      insertedVideoIds.add(videoId);
    }
  }
  resumedChannelIds.clear();
}
