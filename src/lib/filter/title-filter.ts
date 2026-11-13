import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type FeedVideo, sortNewestFirst, type VideosByChannel } from "@/lib/schemas/feed-video";
import type { SemiSubscription, SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import type { StoredState } from "@/lib/schemas/stored-state";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { z } from "@/lib/zod";

export enum FilterKind {
  regex = "regex",
  /** A plain-language description a model judges per video */
  aiMatch = "ai",
  /** How long a video runs */
  length = "length",
  /** Whether a video is a regular one, a Short or a live stream */
  type = "type",
  /** Several conditions, all or any of which a video has to meet */
  group = "group"
}

/** What a condition judges a video by - a filter holds at most one condition per method */
export enum FilterMethod {
  title = "title",
  length = "length",
  type = "type"
}

/** What kind of upload a video is - a premiere counts as a regular video, as YouTube lists it on the Videos tab */
export enum VideoType {
  video = "video",
  short = "short",
  liveStream = "live-stream"
}

/** The ways a title condition can be written */
export const TITLE_FILTER_KINDS = [FilterKind.regex, FilterKind.aiMatch] as const;

/** How a group's conditions combine */
export enum FilterMatch {
  all = "all",
  any = "any"
}

/** Tri-state so a filter that judges videos asynchronously can show a video before its verdict arrives */
export enum MatchState {
  matches = "matches",
  doesNotMatch = "does-not-match",
  pending = "pending"
}

/** YouTube's cap on a Short, so a Short of unknown length is known to run no longer than this */
const SHORT_MAX_DURATION_SECONDS = 180;

// `g` and `y` make RegExp.test stateful, `d` only adds indices - none of them mean anything for a title filter
export const ALLOWED_FILTER_FLAGS = ["i", "m", "s", "u", "v"] as const;
const FILTER_FLAGS_PATTERN = new RegExp(`^[${ALLOWED_FILTER_FLAGS.join("")}]*$`);
export const AI_DESCRIPTION_MAX_LENGTH = 300;

const regexFilterSchema = z.object({
  kind: z.literal(FilterKind.regex),
  pattern: z.string(),
  flags: z.string().regex(FILTER_FLAGS_PATTERN)
});
export type RegexFilter = z.infer<typeof regexFilterSchema>;

export const aiFilterSchema = z.object({
  kind: z.literal(FilterKind.aiMatch),
  description: z.string().trim().min(1).max(AI_DESCRIPTION_MAX_LENGTH)
});
export type AiFilter = z.infer<typeof aiFilterSchema>;

export const titleFilterSchema = z.discriminatedUnion("kind", [regexFilterSchema, aiFilterSchema]);
export type TitleFilter = z.infer<typeof titleFilterSchema>;

const durationBoundSchema = z.number().int().nonnegative();

/** A length range: either bound may be left open */
const lengthFilterSchema = z.object({
  kind: z.literal(FilterKind.length),
  minSeconds: durationBoundSchema.optional(),
  maxSeconds: durationBoundSchema.optional()
});
export type LengthFilter = z.infer<typeof lengthFilterSchema>;

/** The upload types a video has to be one of */
const typeFilterSchema = z.object({
  kind: z.literal(FilterKind.type),
  types: z.array(z.enum(VideoType))
});
export type TypeFilter = z.infer<typeof typeFilterSchema>;

const filterConditionSchema = z.discriminatedUnion("kind", [
  regexFilterSchema,
  aiFilterSchema,
  lengthFilterSchema,
  typeFilterSchema
]);
export type FilterCondition = z.infer<typeof filterConditionSchema>;

const filterGroupSchema = z.object({
  kind: z.literal(FilterKind.group),
  match: z.enum(FilterMatch),
  conditions: z.array(filterConditionSchema)
});

/**
 * What a mode's filter is: one condition, or a group of them. A single condition is stored bare (`buildVideoFilter`),
 * so a filter of one condition reads the same as before filters could be combined
 */
export const videoFilterSchema = z.discriminatedUnion("kind", [
  regexFilterSchema,
  aiFilterSchema,
  lengthFilterSchema,
  typeFilterSchema,
  filterGroupSchema
]);
export type VideoFilter = z.infer<typeof videoFilterSchema>;

export const FILTER_METHOD_BY_KIND = {
  [FilterKind.regex]: FilterMethod.title,
  [FilterKind.aiMatch]: FilterMethod.title,
  [FilterKind.length]: FilterMethod.length,
  [FilterKind.type]: FilterMethod.type
} as const satisfies Record<FilterCondition["kind"], FilterMethod>;

/** A filter saved before filters had a `kind`, when every filter was a RegExp, read as today's RegExp filter */
export const legacyRegexFilterSchema = regexFilterSchema.omit({ kind: true }).transform(filter => {
  const upgraded: RegexFilter = {
    kind: FilterKind.regex,
    ...filter
  };
  return upgraded;
});

export const DEFAULT_TITLE_FILTER: RegexFilter = {
  kind: FilterKind.regex,
  pattern: "",
  flags: "i"
};

/** Where the editor starts when switching a filter to AI match */
export const EMPTY_AI_FILTER: AiFilter = {
  kind: FilterKind.aiMatch,
  description: ""
};

const DEFAULT_MAX_LENGTH_SECONDS = 20 * 60;

/** Where the editor starts when a length condition is added */
export const DEFAULT_LENGTH_FILTER: LengthFilter = {
  kind: FilterKind.length,
  maxSeconds: DEFAULT_MAX_LENGTH_SECONDS
};

export function listFilterConditions(filter: VideoFilter) {
  const conditions: FilterCondition[] = filter.kind === FilterKind.group ? filter.conditions : [filter];
  return conditions;
}

export function getFilterMatch(filter: VideoFilter) {
  return filter.kind === FilterKind.group ? filter.match : FilterMatch.all;
}

/** The one way a filter is put together: a single condition stands alone, more are grouped */
export function buildVideoFilter({ conditions, match }: { conditions: FilterCondition[]; match: FilterMatch }) {
  const [onlyCondition] = conditions;
  if (onlyCondition && conditions.length === 1) {
    const filter: VideoFilter = onlyCondition;
    return filter;
  }

  const filter: VideoFilter = {
    kind: FilterKind.group,
    match,
    conditions
  };
  return filter;
}

/** A filter's AI conditions - what the model judges for it */
export function listAiFilters(filter: VideoFilter | null) {
  const conditions = filter ? listFilterConditions(filter) : [];
  return conditions.filter(condition => condition.kind === FilterKind.aiMatch);
}

const UNSUPPORTED_FLAGS_ERROR = `Only the ${ALLOWED_FILTER_FLAGS.join(", ")} flags work in a title filter`;

/** The one place a RegExp filter is compiled: its RegExp, or why it has none */
function compileRegexFilter(filter: RegexFilter) {
  const isFlagSetValid = regexFilterSchema.safeParse(filter).success;
  if (!isFlagSetValid) {
    return {
      regex: null,
      error: UNSUPPORTED_FLAGS_ERROR
    };
  }

  try {
    return {
      regex: new RegExp(filter.pattern, filter.flags),
      error: null
    };
  } catch (e) {
    return {
      regex: null,
      error: e instanceof Error ? e.message : String(e)
    };
  }
}

export function compileTitleFilter(filter: RegexFilter) {
  return compileRegexFilter(filter).regex;
}

export function getTitleFilterError(filter: RegexFilter) {
  return compileRegexFilter(filter).error;
}

function isLengthFilterSet({ minSeconds, maxSeconds }: LengthFilter) {
  return minSeconds !== undefined || maxSeconds !== undefined;
}

function isLengthRangeValid({ minSeconds = 0, maxSeconds = Infinity }: LengthFilter) {
  return minSeconds <= maxSeconds;
}

export function isFilterConditionValid(condition: FilterCondition) {
  if (condition.kind === FilterKind.regex) {
    return compileTitleFilter(condition) !== null;
  }

  if (condition.kind === FilterKind.type) {
    return typeFilterSchema.safeParse(condition).success && condition.types.length > 0;
  }

  if (condition.kind === FilterKind.length) {
    const isSchemaValid = lengthFilterSchema.safeParse(condition).success;
    return isSchemaValid && isLengthFilterSet(condition) && isLengthRangeValid(condition);
  }

  return aiFilterSchema.safeParse(condition).success;
}

/**
 * Whether a draft can be saved: every condition can run - a pattern that compiles, a description that isn't blank or
 * too long, a length range with a bound and its shortest no longer than its longest
 */
export function isVideoFilterValid(filter: VideoFilter) {
  const conditions = listFilterConditions(filter);
  return conditions.length > 0 && conditions.every(isFilterConditionValid);
}

/** What an AI filter's judge reads besides the filter: the opt-in (off means paused) and the verdict cache */
export type AiJudgeContext = Pick<StoredState, "aiVerdicts" | "isAiEnabled">;

/** All a judge reads of a video, so a feed tile can be judged as well as a cached upload */
type JudgedVideo = Pick<FeedVideo, "videoId" | "title"> &
  Partial<Pick<FeedVideo, "durationSeconds" | "isShort" | "isLiveStream">>;

/** A video's upload type, or null while its channel's tabs haven't told whether it is a live stream */
function readVideoType({ isShort, isLiveStream }: Pick<JudgedVideo, "isShort" | "isLiveStream">) {
  if (isShort) {
    return VideoType.short;
  }

  if (isLiveStream === undefined) {
    return null;
  }

  return isLiveStream ? VideoType.liveStream : VideoType.video;
}

function createTypeJudge({ types }: TypeFilter) {
  return function judgeByType(video: JudgedVideo) {
    const type = readVideoType(video);
    if (type === null) {
      return MatchState.pending;
    }

    return types.includes(type) ? MatchState.matches : MatchState.doesNotMatch;
  };
}

function createRegexJudge(filter: RegexFilter) {
  const regex = compileTitleFilter(filter);
  if (!regex) {
    return null;
  }

  return function judgeByTitle(video: JudgedVideo) {
    return regex.test(video.title) ? MatchState.matches : MatchState.doesNotMatch;
  };
}

function createAiJudge({ filter, aiVerdicts, isAiEnabled }: AiJudgeContext & { filter: AiFilter }) {
  const isJudgeable = isAiEnabled && aiFilterSchema.safeParse(filter).success;
  if (!isJudgeable) {
    return null;
  }

  const verdicts = aiVerdicts[getAiFilterKey(filter)] ?? {};
  return function judgeByVerdict(video: JudgedVideo) {
    const verdict = verdicts[video.videoId];
    if (verdict === undefined) {
      return MatchState.pending;
    }

    return verdict ? MatchState.matches : MatchState.doesNotMatch;
  };
}

/**
 * A video of unknown length is judged by the span it may run: a Short anywhere up to YouTube's cap, anything else (not
 * looked up yet, or live) any length - so it matches only when that whole span is in range, and is pending while the
 * range splits it
 */
function createLengthJudge({ minSeconds = 0, maxSeconds = Infinity }: LengthFilter) {
  return function judgeByLength({ durationSeconds, isShort }: JudgedVideo) {
    const shortest = durationSeconds ?? 0;
    const longest = durationSeconds ?? (isShort ? SHORT_MAX_DURATION_SECONDS : Infinity);
    if (shortest >= minSeconds && longest <= maxSeconds) {
      return MatchState.matches;
    }

    const isOutOfRange = longest < minSeconds || shortest > maxSeconds;
    return isOutOfRange ? MatchState.doesNotMatch : MatchState.pending;
  };
}

function createConditionJudge({ condition, ...context }: AiJudgeContext & { condition: FilterCondition }) {
  if (condition.kind === FilterKind.regex) {
    return createRegexJudge(condition);
  }

  if (condition.kind === FilterKind.length) {
    return createLengthJudge(condition);
  }

  if (condition.kind === FilterKind.type) {
    return createTypeJudge(condition);
  }

  return createAiJudge({
    filter: condition,
    ...context
  });
}

/** A condition that lets every video through - an empty pattern, a length range with no bound - so it is left out */
function isConditionUnrestricting(condition: FilterCondition) {
  if (condition.kind === FilterKind.regex) {
    return condition.pattern === "";
  }

  if (condition.kind === FilterKind.length) {
    return !isLengthFilterSet(condition);
  }

  if (condition.kind === FilterKind.type) {
    return Object.values(VideoType).every(type => condition.types.includes(type));
  }

  return false;
}

/** The conditions that judge anything - one that lets every video through is left out */
export function listRestrictingConditions(filter: VideoFilter) {
  return listFilterConditions(filter).filter(condition => !isConditionUnrestricting(condition));
}

/** All: one miss decides, any: one match does; short of that, a pending condition keeps the whole pending */
function combineMatchStates({ matchStates, match }: { matchStates: MatchState[]; match: FilterMatch }) {
  const decisiveState = match === FilterMatch.all ? MatchState.doesNotMatch : MatchState.matches;
  if (matchStates.includes(decisiveState)) {
    return decisiveState;
  }

  if (matchStates.includes(MatchState.pending)) {
    return MatchState.pending;
  }

  return match === FilterMatch.all ? MatchState.matches : MatchState.doesNotMatch;
}

function judgeMatch() {
  return MatchState.matches;
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
  const isPatternBroken = conditions.some((condition, i) => condition.kind === FilterKind.regex && !judges[i]);
  const workingJudges = judges.filter(judge => judge !== null);
  if (isPatternBroken || workingJudges.length === 0) {
    return null;
  }

  const isPausedConditionLeft = workingJudges.length < judges.length;
  const match = getFilterMatch(filter);
  return function judgeVideo(video: JudgedVideo) {
    const matchStates = workingJudges.map(judge => judge(video));
    if (isPausedConditionLeft) {
      matchStates.push(MatchState.pending);
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

  return mode === SubscriptionMode.hide && listRestrictingConditions(filter).length === 0;
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
  return conditions.some(condition => condition.kind === FilterKind.length || condition.kind === FilterKind.type);
}

function judgeNoMatch() {
  return MatchState.doesNotMatch;
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
  for (const channelId in subscriptions) {
    const subscription = subscriptions[channelId];
    const isFollowed = subscription && !subscription.isSubscribed;
    const judge =
      isFollowed &&
      createModeJudge({
        filter: subscription.followFilter,
        mode: SubscriptionMode.follow,
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
      if (!isLocked && judge(video) === MatchState.matches) {
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
    mode: SubscriptionMode.hide
  });
  const blockJudge = isBlockListInert
    ? null
    : createModeJudge({
        filter: subscription.hideFilter,
        mode: SubscriptionMode.hide,
        ...context
      });
  const { followFilter } = subscription;
  const allowJudge =
    followFilter && isAllowListRestricting(followFilter)
      ? createVideoJudge({
          filter: followFilter,
          ...context
        })
      : null;
  if (!blockJudge && !allowJudge) {
    return null;
  }

  return function isHidden(video: JudgedVideo) {
    return blockJudge?.(video) === MatchState.matches || allowJudge?.(video) === MatchState.doesNotMatch;
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
  for (const channelId in subscriptions) {
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
