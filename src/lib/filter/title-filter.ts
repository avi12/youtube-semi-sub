import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { type FeedVideo, sortNewestFirst } from "@/lib/schemas/feed-video";
import type { SemiSubscriptions } from "@/lib/schemas/semi-subscription";
import type { StoredState } from "@/lib/schemas/stored-state";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { z } from "@/lib/zod";

export enum FilterKind {
  regex = "regex",
  /** A plain-language description a model judges per video */
  aiMatch = "ai"
}

/** Tri-state so a filter that judges videos asynchronously can show a video before its verdict arrives */
export enum MatchState {
  matches = "matches",
  doesNotMatch = "does-not-match",
  pending = "pending"
}

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

export function compileTitleFilter(filter: RegexFilter) {
  const isFlagSetValid = regexFilterSchema.safeParse(filter).success;
  if (!isFlagSetValid) {
    return null;
  }

  try {
    return new RegExp(filter.pattern, filter.flags);
  } catch {
    return null;
  }
}

export function getTitleFilterError(filter: RegexFilter) {
  try {
    new RegExp(filter.pattern, filter.flags);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Whether a draft can be saved: a pattern that compiles, or a description that isn't blank or too long */
export function isTitleFilterValid(filter: TitleFilter) {
  if (filter.kind === FilterKind.regex) {
    return compileTitleFilter(filter) !== null;
  }

  return aiFilterSchema.safeParse(filter).success;
}

/** What an AI filter's judge reads besides the filter: the opt-in (off means paused) and the verdict cache */
export type AiJudgeContext = Pick<StoredState, "aiVerdicts" | "isAiEnabled">;

/** All a judge reads of a video, so a feed tile can be judged as well as a cached upload */
type JudgedVideo = Pick<FeedVideo, "videoId" | "title">;

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
 * How a filter treats each video. Null when it can't judge at all: a pattern that doesn't compile, or an AI filter
 * while AI match is turned off (paused). An AI filter's video without a verdict yet is pending
 */
export function createVideoJudge({ filter, ...context }: AiJudgeContext & { filter: TitleFilter }) {
  if (filter.kind === FilterKind.regex) {
    return createRegexJudge(filter);
  }

  return createAiJudge({
    filter,
    ...context
  });
}

/** A hide filter left empty hides nothing - where an empty follow filter lets every video through */
export function isHidingNothing({ filter, mode }: {
  filter: TitleFilter;
  mode: SubscriptionMode;
}) {
  return mode === SubscriptionMode.hide && filter.kind === FilterKind.regex && filter.pattern === "";
}

function judgeNoMatch() {
  return MatchState.doesNotMatch;
}

/** `createVideoJudge` for a mode's filter: an empty hide filter matches no video */
export function createModeJudge({ filter, mode, ...context }: Parameters<typeof createVideoJudge>[0] & {
  mode: SubscriptionMode;
}) {
  if (isHidingNothing({
    filter,
    mode
  })) {
    return judgeNoMatch;
  }

  return createVideoJudge({
    filter,
    ...context
  });
}

/**
 * One of the two places the feed is filtered: a video lands only on a definite match of its channel's follow filter,
 * never while pending or paused, nor from a channel the user is subscribed to
 */
export function selectFeedVideos({ subscriptions, videosByChannel, ...context }: AiJudgeContext & {
  subscriptions: SemiSubscriptions;
  videosByChannel: Partial<Record<string, FeedVideo[]>>;
}) {
  const selectedById = new Map<string, FeedVideo>();
  for (const channelId in subscriptions) {
    const subscription = subscriptions[channelId];
    const isFollowed = subscription && !subscription.isSubscribed;
    const judge = isFollowed && createVideoJudge({
      filter: subscription.followFilter,
      ...context
    });
    if (!judge) {
      continue;
    }

    for (const video of videosByChannel[channelId] ?? []) {
      if (judge(video) === MatchState.matches) {
        selectedById.set(video.videoId, video);
      }
    }
  }
  return sortNewestFirst([...selectedById.values()]);
}

/**
 * The other place the feed is filtered: the cached uploads each subscribed channel's hide filter hides. Only a
 * definite match hides a video - one still waiting for its AI verdict stays, and so does everything while the filter
 * is paused
 */
export function selectHiddenVideoIds({ subscriptions, videosByChannel, ...context }: Parameters<
  typeof selectFeedVideos
>[0]) {
  const hiddenIds = new Set<string>();
  for (const channelId in subscriptions) {
    const subscription = subscriptions[channelId];
    const judge = subscription?.isSubscribed && createModeJudge({
      filter: subscription.hideFilter,
      mode: SubscriptionMode.hide,
      ...context
    });
    if (!judge) {
      continue;
    }

    for (const video of videosByChannel[channelId] ?? []) {
      if (judge(video) === MatchState.matches) {
        hiddenIds.add(video.videoId);
      }
    }
  }
  return [...hiddenIds];
}
