import { FilterKind, isFilterInert } from "@/lib/filter/title-filter";
import type { PageState } from "@/lib/messaging/page-messaging";
import { getModeFilter, getSubscriptionMode, type SemiSubscription } from "@/lib/schemas/semi-subscription";
import { ANY_TITLE_LABEL, INERT_FILTER_LABEL, SUBSCRIPTION_MODE_NAME } from "@/lib/schemas/subscription-mode";

export enum FilterLiteralKind {
  aiMatch = "ai",
  /** A filter that leaves the feed alone (`isFilterInert`) */
  inert = "inert",
  regex = "regex",
  /** An empty follow pattern, which lets every video through */
  anyTitle = "any-title"
}

export const AI_LITERAL_PREFIX = "AI";
export const PAUSED_LABEL = "paused";

/** What a list says about a channel's filter: the mode it is in, and that mode's filter */
export function describeFilterLiteral({ subscription, isAiEnabled }: Pick<PageState, "isAiEnabled"> & {
  subscription: SemiSubscription;
}) {
  const mode = getSubscriptionMode(subscription);
  const filter = getModeFilter({
    subscription,
    mode
  });
  const modeName = SUBSCRIPTION_MODE_NAME[mode];
  if (filter?.kind === FilterKind.aiMatch) {
    return {
      modeName,
      kind: FilterLiteralKind.aiMatch,
      text: filter.description,
      isPaused: !isAiEnabled
    };
  }

  const isInert = isFilterInert({
    filter,
    mode
  });
  if (isInert) {
    return {
      modeName,
      kind: FilterLiteralKind.inert,
      text: INERT_FILTER_LABEL[mode],
      isPaused: false
    };
  }

  const pattern = filter?.pattern;
  if (pattern) {
    return {
      modeName,
      kind: FilterLiteralKind.regex,
      text: `/${pattern}/${filter.flags}`,
      isPaused: false
    };
  }

  return {
    modeName,
    kind: FilterLiteralKind.anyTitle,
    text: ANY_TITLE_LABEL,
    isPaused: false
  };
}

export type FilterLiteral = ReturnType<typeof describeFilterLiteral>;

/** The same literal as plain text, for a surface that renders YouTube's own text runs */
export function formatFilterLiteral({ kind, text, isPaused }: FilterLiteral) {
  if (kind !== FilterLiteralKind.aiMatch) {
    return text;
  }

  return isPaused ? `${AI_LITERAL_PREFIX}: ${text} (${PAUSED_LABEL})` : `${AI_LITERAL_PREFIX}: ${text}`;
}
