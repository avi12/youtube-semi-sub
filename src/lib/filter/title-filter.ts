import {
  type AiJudgeContext,
  combineMatchStates,
  createConditionJudge,
  type JudgedVideo,
  listRestrictingConditions
} from "@/lib/filter/judge/condition-judges";
import { FilterKind, getFilterMatch, MatchState, type VideoFilter } from "@/lib/filter/schema/video-filter-schema";
import { type FeedVideo, sortNewestFirst, type VideosByChannel } from "@/lib/schemas/feed-video";
import type { SemiSubscription, SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

function judgeMatch() {
  return MatchState.MATCHES;
}

/**
 * How a filter treats each video: each condition judged, then combined by the filter's match. A filter whose
 * conditions all let everything through matches every video. Null when it can't judge at all: a pattern that doesn't
 * compile, or nothing but AI conditions while AI match is turned off (paused). Beside other conditions a paused one
 * counts as pending, like an AI condition's video without a verdict yet
 */
export function createVideoJudge({ filter, ...context }: AiJudgeContext & { filter: VideoFilter }) {
  const conditions = listRestrictingConditions(filter);
  if (conditions.length === 0) {
    return judgeMatch;
  }

  const judges = conditions.map(condition =>
    createConditionJudge({
      condition,
      ...context
    })
  );
  const isPatternBroken = conditions.some((condition, i) => condition.kind === FilterKind.REGEX && !judges[i]);
  const workingJudges = judges.filter(judge => judge !== null);
  if (isPatternBroken || workingJudges.length === 0) {
    return null;
  }

  const isPausedConditionLeft = workingJudges.length < judges.length;
  const match = getFilterMatch(filter);
  return function judgeVideo(video: JudgedVideo) {
    const matchStates = workingJudges.map(judge => judge(video));
    if (isPausedConditionLeft) {
      matchStates.push(MatchState.PENDING);
    }

    return combineMatchStates({
      matchStates,
      match
    });
  };
}

/**
 * Whether a mode's filter leaves the feed as YouTube has it - the one place both modes' empty cases are decided. A
 * filter never set in its mode (null: the channel was saved in the other one) does nothing in either mode, so a
 * later subscribe or unsubscribe never starts hiding or adding videos nobody picked. A filter whose conditions all let
 * every video through (an empty pattern) hides nothing as a hide filter and lets every video through as a follow
 * filter - either way, the whole channel
 */
export function isFilterInert({ filter, mode }: { filter: VideoFilter | null; mode: SubscriptionMode }) {
  if (!filter) {
    return true;
  }

  return mode === SubscriptionMode.HIDE && listRestrictingConditions(filter).length === 0;
}

/**
 * Whether a follow filter also restricts the channel while the user is subscribed - the Allow list keeps filtering:
 * only what it lets through stays. A filter that lets every video through restricts nothing
 */
export function isAllowListRestricting(filter: VideoFilter | null) {
  if (!filter) {
    return false;
  }

  return listRestrictingConditions(filter).length > 0;
}

/** Whether a filter judges videos by what only a channel's tabs tell: their length, or whether they are live streams */
export function isTabDetailFiltered(filter: VideoFilter | null) {
  const conditions = filter ? listRestrictingConditions(filter) : [];
  return conditions.some(condition => condition.kind === FilterKind.LENGTH || condition.kind === FilterKind.TYPE);
}

function judgeNoMatch() {
  return MatchState.DOES_NOT_MATCH;
}

/** `createVideoJudge` for a mode's filter: an inert one (`isFilterInert`) matches no video */
export function createModeJudge({
  filter,
  mode,
  ...context
}: AiJudgeContext & {
  filter: VideoFilter | null;
  mode: SubscriptionMode;
}) {
  const isInert = isFilterInert({
    filter,
    mode
  });
  if (!filter || isInert) {
    return judgeNoMatch;
  }

  return createVideoJudge({
    filter,
    ...context
  });
}

/**
 * A members-only video only a member can watch, so following adds it only for one. RSS lists these unmarked; the
 * Videos tab marks them (`isMembersOnly`). A subscribed channel needs no such rule: YouTube's own feed leaves them out
 */
export function isMembersOnlyLocked({
  video,
  isMember
}: {
  video: Pick<FeedVideo, "isMembersOnly">;
  isMember: boolean | undefined;
}) {
  return !!video.isMembersOnly && !isMember;
}

/**
 * One of the two places the feed is filtered: a video lands only on a definite match of its channel's follow filter,
 * never while pending or paused, nor from a channel the user is subscribed to, nor members-only for a non-member
 */
export function selectFeedVideos({
  subscriptions,
  videosByChannel,
  ...context
}: AiJudgeContext & {
  subscriptions: SemiSubscriptions;
  videosByChannel: VideosByChannel;
}) {
  const selectedById = new Map<string, FeedVideo>();
  for (const channelId of Object.keys(subscriptions)) {
    const subscription = subscriptions[channelId];
    const isFollowed = subscription && !subscription.isSubscribed;
    const judge =
      isFollowed &&
      createModeJudge({
        filter: subscription.followFilter,
        mode: SubscriptionMode.FOLLOW,
        ...context
      });
    if (!judge) {
      continue;
    }

    for (const video of videosByChannel[channelId] ?? []) {
      const isLocked = isMembersOnlyLocked({
        video,
        isMember: subscription?.isMember
      });
      const isSelectable = !isLocked && judge(video) === MatchState.MATCHES;
      if (isSelectable) {
        selectedById.set(video.videoId, video);
      }
    }
  }
  return sortNewestFirst([...selectedById.values()]);
}

/**
 * What hides a video of a subscribed channel - the one place both lists are applied: the Block list hides a definite
 * match, the Allow list a definite non-match. Null when the channel isn't subscribed or neither list can judge (an
 * AI filter while AI match is off, a pattern that doesn't compile)
 */
export function createSubscribedHideCheck({
  subscription,
  ...context
}: AiJudgeContext & {
  subscription: Pick<SemiSubscription, "followFilter" | "hideFilter" | "isSubscribed">;
}) {
  if (!subscription.isSubscribed) {
    return null;
  }

  const isBlockListInert = isFilterInert({
    filter: subscription.hideFilter,
    mode: SubscriptionMode.HIDE
  });
  const blockJudge = isBlockListInert
    ? null
    : createModeJudge({
        filter: subscription.hideFilter,
        mode: SubscriptionMode.HIDE,
        ...context
      });
  const { followFilter } = subscription;
  const isAllowListActive = followFilter && isAllowListRestricting(followFilter);
  const allowJudge = isAllowListActive
    ? createVideoJudge({
        filter: followFilter,
        ...context
      })
    : null;
  if (!blockJudge && !allowJudge) {
    return null;
  }

  return function isHidden(video: JudgedVideo) {
    return blockJudge?.(video) === MatchState.MATCHES || allowJudge?.(video) === MatchState.DOES_NOT_MATCH;
  };
}

/**
 * The other place the feed is filtered: the cached uploads each subscribed channel's lists hide. Only a definite
 * verdict hides a video - one still waiting for its AI verdict or its length stays, and so does everything while a
 * filter is paused
 */
export function selectHiddenVideoIds({
  subscriptions,
  videosByChannel,
  ...context
}: Parameters<typeof selectFeedVideos>[0]) {
  const hiddenIds = new Set<string>();
  for (const channelId of Object.keys(subscriptions)) {
    const subscription = subscriptions[channelId];
    const isHidden =
      subscription &&
      createSubscribedHideCheck({
        subscription,
        ...context
      });
    if (!isHidden) {
      continue;
    }

    for (const video of videosByChannel[channelId] ?? []) {
      if (isHidden(video)) {
        hiddenIds.add(video.videoId);
      }
    }
  }
  return [...hiddenIds];
}
