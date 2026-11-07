import {
  type FilterCondition,
  FilterKind,
  FilterMatch,
  getFilterMatch,
  isFilterInert,
  isLengthFilterSet,
  type LengthFilter,
  listFilterConditions,
  listRestrictingConditions,
  type VideoFilter
} from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import {
  ANY_TITLE_LABEL,
  INERT_FILTER_LABEL,
  SUBSCRIPTION_MODE_NAME,
  SubscriptionMode
} from "@/lib/schemas/subscription-mode";
import { SECONDS_PER_MINUTE } from "@/lib/youtube/video-duration";
import { z } from "@/lib/zod";

export enum FilterLiteralKind {
  aiMatch = "ai",
  /** A filter that leaves the feed alone (`isFilterInert`) */
  inert = "inert",
  regex = "regex",
  length = "length",
  /** An empty follow pattern, which lets every video through */
  anyTitle = "any-title"
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
  [FilterMatch.all]: "and",
  [FilterMatch.any]: "or"
} as const satisfies Record<FilterMatch, string>;

const MINUTES_PRECISION = 10;

function formatMinutes(seconds: number) {
  return `${Math.round(seconds / SECONDS_PER_MINUTE * MINUTES_PRECISION) / MINUTES_PRECISION}`;
}

/** "up to 20 min", "at least 2 min" or "2-20 min" */
export function describeLengthRange({ minSeconds, maxSeconds }: LengthFilter) {
  if (minSeconds !== undefined && maxSeconds !== undefined) {
    return `${formatMinutes(minSeconds)}-${formatMinutes(maxSeconds)} min`;
  }

  if (maxSeconds !== undefined) {
    return `up to ${formatMinutes(maxSeconds)} min`;
  }

  return minSeconds === undefined ? "any length" : `at least ${formatMinutes(minSeconds)} min`;
}

function describeEmptyFilter({ isInert, modeName, mode }: {
  isInert: boolean;
  modeName: string;
  mode: SubscriptionMode;
}) {
  const part: FilterLiteralPart = {
    kind: isInert ? FilterLiteralKind.inert : FilterLiteralKind.anyTitle,
    text: isInert ? INERT_FILTER_LABEL[mode] : ANY_TITLE_LABEL,
    isPaused: false
  };
  return {
    modeName,
    connector: FILTER_MATCH_CONNECTOR[FilterMatch.all],
    parts: [part]
  };
}

/** What a list says about a channel's filter: the mode it is in, and each condition of that mode's filter */
export function describeFilterLiteral({ subscription, isAiEnabled }: Pick<PageState, "isAiEnabled"> & {
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
  const parts = (filter ? listFilterConditions(filter) : []).flatMap(condition => {
    if (condition.kind === FilterKind.aiMatch) {
      const part: FilterLiteralPart = {
        kind: FilterLiteralKind.aiMatch,
        text: condition.description,
        isPaused: !isAiEnabled
      };
      return [part];
    }

    if (condition.kind === FilterKind.length) {
      const part: FilterLiteralPart = {
        kind: FilterLiteralKind.length,
        text: describeLengthRange(condition),
        isPaused: false
      };
      return isLengthFilterSet(condition) ? [part] : [];
    }

    const part: FilterLiteralPart = {
      kind: FilterLiteralKind.regex,
      text: condition.pattern,
      flags: condition.flags,
      isPaused: false
    };
    return condition.pattern ? [part] : [];
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
  if (kind === FilterLiteralKind.regex) {
    return `/${text}/${flags ?? ""}`;
  }

  if (kind !== FilterLiteralKind.aiMatch) {
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
  [SubscriptionMode.follow]: {
    verb: "Shows",
    otherwise: "Everything else from this channel stays out of your feed",
    pending: "Videos still being checked show once they pass",
    empty: "Shows every video from this channel"
  },
  [SubscriptionMode.hide]: {
    verb: "Hides",
    otherwise: "Everything else stays in your feed",
    pending: "Videos still being checked stay until they're judged",
    empty: "Hides nothing yet - every video stays in your feed"
  }
} as const satisfies Record<SubscriptionMode, Record<string, string>>;

/** How a condition reads after "videos that" */
function describeConditionClause(condition: FilterCondition) {
  if (condition.kind === FilterKind.aiMatch) {
    return `fit "${condition.description.trim()}"`;
  }

  if (condition.kind === FilterKind.length) {
    return `run ${describeLengthRange(condition)}`;
  }

  return `have a title matching /${condition.pattern}/${condition.flags}`;
}

/**
 * The filter as one plain sentence - which videos it shows or hides, and what happens to the rest - so a reader never
 * has to combine the list type, the all/any switch and each condition in their head
 */
export function describeFilterRule({ filter, mode }: {
  filter: VideoFilter;
  mode: SubscriptionMode;
}) {
  const wording = RULE_WORDING[mode];
  const conditions = listRestrictingConditions(filter);
  if (conditions.length === 0) {
    return {
      verb: wording.verb,
      clauses: [],
      connector: FILTER_MATCH_CONNECTOR[FilterMatch.all],
      otherwise: wording.empty,
      pendingNote: null
    };
  }

  const isJudgedLater = conditions.some(condition => condition.kind !== FilterKind.regex);
  return {
    verb: wording.verb,
    clauses: conditions.map(describeConditionClause),
    connector: FILTER_MATCH_CONNECTOR[getFilterMatch(filter)],
    otherwise: wording.otherwise,
    pendingNote: isJudgedLater ? wording.pending : null
  };
}
