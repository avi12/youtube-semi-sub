import {
  type FilterCondition,
  FilterKind,
  FilterMatch,
  getFilterMatch,
  isFilterInert,
  type LengthFilter,
  listRestrictingConditions,
  type TypeFilter,
  type VideoFilter,
  VideoType
} from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import {
  ANY_TITLE_LABEL,
  INERT_FILTER_LABEL,
  SUBSCRIPTION_MODE_NAME,
  SubscriptionMode
} from "@/lib/schemas/subscription-mode";
import { SECONDS_PER_MINUTE } from "@/lib/youtube/video/video-duration";
import { z } from "@/lib/zod";

export enum FilterLiteralKind {
  AI_MATCH = "ai",
  /** A filter that leaves the feed alone (`isFilterInert`) */
  INERT = "inert",
  REGEX = "regex",
  LENGTH = "length",
  TYPE = "type",
  /** An empty follow pattern, which lets every video through */
  ANY_TITLE = "any-title"
}

/** One condition as a list sums it up: a regex part's text is its pattern, with its flags beside it */
const filterLiteralPartSchema = z.object({
  kind: z.enum(FilterLiteralKind),
  text: z.string(),
  flags: z.string().optional(),
  isPaused: z.boolean()
});
type FilterLiteralPart = z.infer<typeof filterLiteralPartSchema>;

export const AI_LITERAL_PREFIX = "AI";
export const PAUSED_LABEL = "paused";

/** The word between a filter's conditions, wherever one is summed up */
export const FILTER_MATCH_CONNECTOR = {
  [FilterMatch.ALL]: "and",
  [FilterMatch.ANY]: "or"
} as const satisfies Record<FilterMatch, string>;

const MINUTES_PRECISION = 10;

function formatMinutes(seconds: number) {
  return `${Math.round((seconds / SECONDS_PER_MINUTE) * MINUTES_PRECISION) / MINUTES_PRECISION}`;
}

/** "up to 20 min", "at least 2 min" or "2-20 min" */
/** Each upload type as a sentence names it */
const VIDEO_TYPE_NAME = {
  [VideoType.VIDEO]: "regular videos",
  [VideoType.SHORT]: "Shorts",
  [VideoType.LIVE_STREAM]: "live streams"
} as const satisfies Record<VideoType, string>;

/** "Shorts or live streams" */
function describeVideoTypes({ types }: TypeFilter) {
  return Object.values(VideoType)
    .filter(type => types.includes(type))
    .map(type => VIDEO_TYPE_NAME[type])
    .join(" or ");
}

export function describeLengthRange({ minSeconds, maxSeconds }: LengthFilter) {
  if (minSeconds !== undefined && maxSeconds !== undefined) {
    return `${formatMinutes(minSeconds)}-${formatMinutes(maxSeconds)} min`;
  }

  if (maxSeconds !== undefined) {
    return `up to ${formatMinutes(maxSeconds)} min`;
  }

  return minSeconds === undefined ? "any length" : `at least ${formatMinutes(minSeconds)} min`;
}

function describeEmptyFilter({
  isInert,
  modeName,
  mode
}: {
  isInert: boolean;
  modeName: string;
  mode: SubscriptionMode;
}) {
  const part: FilterLiteralPart = {
    kind: isInert ? FilterLiteralKind.INERT : FilterLiteralKind.ANY_TITLE,
    text: isInert ? INERT_FILTER_LABEL[mode] : ANY_TITLE_LABEL,
    isPaused: false
  };
  return {
    modeName,
    connector: FILTER_MATCH_CONNECTOR[FilterMatch.ALL],
    parts: [part]
  };
}

/** What a list says about a channel's filter: the mode it is in, and each condition of that mode's filter */
export function describeFilterLiteral({
  subscription,
  isAiEnabled
}: Pick<PageState, "isAiEnabled"> & {
  subscription: SemiSubscription;
}) {
  const mode = getSubscriptionMode(subscription);
  const filter = getModeFilter({
    subscription,
    mode
  });
  const modeName = SUBSCRIPTION_MODE_NAME[mode];
  const isInert = isFilterInert({
    filter,
    mode
  });
  const parts = (filter ? listRestrictingConditions(filter) : []).map(condition => {
    if (condition.kind === FilterKind.AI_MATCH) {
      const part: FilterLiteralPart = {
        kind: FilterLiteralKind.AI_MATCH,
        text: condition.description,
        isPaused: !isAiEnabled
      };
      return part;
    }

    if (condition.kind === FilterKind.REGEX) {
      const part: FilterLiteralPart = {
        kind: FilterLiteralKind.REGEX,
        text: condition.pattern,
        flags: condition.flags,
        isPaused: false
      };
      return part;
    }

    const part: FilterLiteralPart = {
      kind: condition.kind === FilterKind.LENGTH ? FilterLiteralKind.LENGTH : FilterLiteralKind.TYPE,
      text: condition.kind === FilterKind.LENGTH ? describeLengthRange(condition) : describeVideoTypes(condition),
      isPaused: false
    };
    return part;
  });
  if (!filter || isInert || parts.length === 0) {
    return describeEmptyFilter({
      isInert,
      modeName,
      mode
    });
  }

  return {
    modeName,
    connector: FILTER_MATCH_CONNECTOR[getFilterMatch(filter)],
    parts
  };
}

type FilterLiteral = ReturnType<typeof describeFilterLiteral>;

function formatLiteralPart({ kind, text, flags, isPaused }: FilterLiteralPart) {
  if (kind === FilterLiteralKind.REGEX) {
    return `/${text}/${flags ?? ""}`;
  }

  if (kind !== FilterLiteralKind.AI_MATCH) {
    return text;
  }

  return isPaused ? `${AI_LITERAL_PREFIX}: ${text} (${PAUSED_LABEL})` : `${AI_LITERAL_PREFIX}: ${text}`;
}

/** The same literal as plain text, for a surface that renders YouTube's own text runs */
export function formatFilterLiteral({ parts, connector }: FilterLiteral) {
  return parts.map(formatLiteralPart).join(` ${connector} `);
}

/** What a mode's filter does to a video it matches, and to every other one */
const RULE_WORDING = {
  [SubscriptionMode.FOLLOW]: {
    verb: "Shows",
    otherwise: "Everything else from this channel stays out of your feed",
    pending: "Videos still being checked show once they pass",
    empty: "Shows every video from this channel"
  },
  [SubscriptionMode.HIDE]: {
    verb: "Hides",
    otherwise: "Everything else stays in your feed",
    pending: "Videos still being checked stay until they're judged",
    empty: "Hides nothing yet - every video stays in your feed"
  }
} as const satisfies Record<SubscriptionMode, Record<string, string>>;

/** How a condition reads after "videos that" */
function describeConditionClause(condition: FilterCondition) {
  if (condition.kind === FilterKind.AI_MATCH) {
    return `fit "${condition.description.trim()}"`;
  }

  if (condition.kind === FilterKind.LENGTH) {
    return `run ${describeLengthRange(condition)}`;
  }

  if (condition.kind === FilterKind.TYPE) {
    return `are ${describeVideoTypes(condition)}`;
  }

  return `have a title matching /${condition.pattern}/${condition.flags}`;
}

/**
 * The filter as one plain sentence - which videos it shows or hides, and what happens to the rest - so a reader never
 * has to combine the list type, the all/any switch and each condition in their head
 */
export function describeFilterRule({ filter, mode }: { filter: VideoFilter; mode: SubscriptionMode }) {
  const wording = RULE_WORDING[mode];
  const conditions = listRestrictingConditions(filter);
  if (conditions.length === 0) {
    return {
      verb: wording.verb,
      clauses: [],
      connector: FILTER_MATCH_CONNECTOR[FilterMatch.ALL],
      otherwise: wording.empty,
      pendingNote: null
    };
  }

  const isJudgedLater = conditions.some(condition => condition.kind !== FilterKind.REGEX);
  return {
    verb: wording.verb,
    clauses: conditions.map(describeConditionClause),
    connector: FILTER_MATCH_CONNECTOR[getFilterMatch(filter)],
    otherwise: wording.otherwise,
    pendingNote: isJudgedLater ? wording.pending : null
  };
}
