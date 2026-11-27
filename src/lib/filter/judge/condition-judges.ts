import { getAiFilterKey } from "@/lib/filter/ai-filter-key";
import { compileTitleFilter, isLengthFilterSet } from "@/lib/filter/schema/filter-validity";
import {
  type AiFilter,
  aiFilterSchema,
  type FilterCondition,
  FilterKind,
  FilterMatch,
  type LengthFilter,
  listFilterConditions,
  MatchState,
  type RegexFilter,
  type TypeFilter,
  type VideoFilter,
  VideoType
} from "@/lib/filter/schema/video-filter-schema";
import type { FeedVideo } from "@/lib/schemas/feed-video";
import type { StoredState } from "@/lib/schemas/stored-state";

/** YouTube's cap on a Short, so a Short of unknown length is known to run no longer than this */
const SHORT_MAX_DURATION_SECONDS = 180;

/** What an AI filter's judge reads besides the filter: the opt-in (off means paused) and the verdict cache */
export type AiJudgeContext = Pick<StoredState, "aiVerdicts" | "isAiEnabled">;

/** All a judge reads of a video, so a feed tile can be judged as well as a cached upload */
export type JudgedVideo = Pick<FeedVideo, "videoId" | "title"> &
  Partial<Pick<FeedVideo, "durationSeconds" | "isShort" | "isLiveStream">>;

/** A video's upload type, or null while its channel's tabs haven't told whether it is a live stream */
function readVideoType({ isShort, isLiveStream }: Pick<JudgedVideo, "isShort" | "isLiveStream">) {
  if (isShort) {
    return VideoType.SHORT;
  }

  if (isLiveStream === undefined) {
    return null;
  }

  return isLiveStream ? VideoType.LIVE_STREAM : VideoType.VIDEO;
}

function createTypeJudge({ types }: TypeFilter) {
  return function judgeByType(video: JudgedVideo) {
    const type = readVideoType(video);
    if (type === null) {
      return MatchState.PENDING;
    }

    return types.includes(type) ? MatchState.MATCHES : MatchState.DOES_NOT_MATCH;
  };
}

function createRegexJudge(filter: RegexFilter) {
  const regex = compileTitleFilter(filter);
  if (!regex) {
    return null;
  }

  return function judgeByTitle(video: JudgedVideo) {
    return regex.test(video.title) ? MatchState.MATCHES : MatchState.DOES_NOT_MATCH;
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
      return MatchState.PENDING;
    }

    return verdict ? MatchState.MATCHES : MatchState.DOES_NOT_MATCH;
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
    const isWithinBounds = shortest >= minSeconds && longest <= maxSeconds;
    if (isWithinBounds) {
      return MatchState.MATCHES;
    }

    const isOutOfRange = longest < minSeconds || shortest > maxSeconds;
    return isOutOfRange ? MatchState.DOES_NOT_MATCH : MatchState.PENDING;
  };
}

export function createConditionJudge({ condition, ...context }: AiJudgeContext & { condition: FilterCondition }) {
  if (condition.kind === FilterKind.REGEX) {
    return createRegexJudge(condition);
  }

  if (condition.kind === FilterKind.LENGTH) {
    return createLengthJudge(condition);
  }

  if (condition.kind === FilterKind.TYPE) {
    return createTypeJudge(condition);
  }

  return createAiJudge({
    filter: condition,
    ...context
  });
}

/** A condition that lets every video through - an empty pattern, a length range with no bound - so it is left out */
function isConditionUnrestricting(condition: FilterCondition) {
  if (condition.kind === FilterKind.REGEX) {
    return condition.pattern === "";
  }

  if (condition.kind === FilterKind.LENGTH) {
    return !isLengthFilterSet(condition);
  }

  if (condition.kind === FilterKind.TYPE) {
    return Object.values(VideoType).every(type => condition.types.includes(type));
  }

  return false;
}

/** The conditions that judge anything - one that lets every video through is left out */
export function listRestrictingConditions(filter: VideoFilter) {
  return listFilterConditions(filter).filter(condition => !isConditionUnrestricting(condition));
}

/** All: one miss decides, any: one match does; short of that, a pending condition keeps the whole pending */
export function combineMatchStates({ matchStates, match }: { matchStates: MatchState[]; match: FilterMatch }) {
  const decisiveState = match === FilterMatch.ALL ? MatchState.DOES_NOT_MATCH : MatchState.MATCHES;
  if (matchStates.includes(decisiveState)) {
    return decisiveState;
  }

  if (matchStates.includes(MatchState.PENDING)) {
    return MatchState.PENDING;
  }

  return match === FilterMatch.ALL ? MatchState.MATCHES : MatchState.DOES_NOT_MATCH;
}
