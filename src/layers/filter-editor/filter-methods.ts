import {
  DEFAULT_LENGTH_FILTER,
  DEFAULT_TITLE_FILTER,
  FILTER_METHOD_BY_KIND,
  type FilterCondition,
  FilterKind,
  FilterMatch,
  FilterMethod,
  VideoType
} from "@/lib/filter/title-filter";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

// The editor's registry of filter methods: a new method is an entry here, a condition kind in title-filter and a
// fields component in FilterEditor

/** In the order their cards appear */
export const FILTER_METHODS = Object.values(FilterMethod);

export const FILTER_METHOD_LABEL = {
  [FilterMethod.TITLE]: "Title",
  [FilterMethod.LENGTH]: "Length",
  [FilterMethod.TYPE]: "Type"
} as const satisfies Record<FilterMethod, string>;

/** Each upload type as its toggle names it */
export const VIDEO_TYPE_LABEL = {
  [VideoType.VIDEO]: "Videos",
  [VideoType.SHORT]: "Shorts",
  [VideoType.LIVE_STREAM]: "Live streams"
} as const satisfies Record<VideoType, string>;

/**
 * Where a newly picked type condition starts: following keeps regular videos (no Shorts, no streams), hiding hides
 * Shorts - the two asks this method exists for
 */
const DEFAULT_TYPES_BY_MODE = {
  [SubscriptionMode.FOLLOW]: [VideoType.VIDEO],
  [SubscriptionMode.HIDE]: [VideoType.SHORT]
} as const satisfies Record<SubscriptionMode, readonly VideoType[]>;

export const TITLE_KIND_LABEL = {
  [FilterKind.REGEX]: "RegExp",
  [FilterKind.AI_MATCH]: "AI match"
} as const satisfies Record<FilterKind.REGEX | FilterKind.AI_MATCH, string>;

export const FILTER_MATCH_LABEL = {
  [FilterMatch.ALL]: "All of these",
  [FilterMatch.ANY]: "Any of these"
} as const satisfies Record<FilterMatch, string>;

export const FILTER_MATCHES = Object.values(FilterMatch);

export function getConditionMethod(condition: FilterCondition) {
  return FILTER_METHOD_BY_KIND[condition.kind];
}

/** Where a newly picked method starts */
export function createDefaultCondition({ method, mode }: { method: FilterMethod; mode: SubscriptionMode }) {
  const conditionByMethod = {
    [FilterMethod.TITLE]: {
      ...DEFAULT_TITLE_FILTER
    },
    [FilterMethod.LENGTH]: {
      ...DEFAULT_LENGTH_FILTER
    },
    [FilterMethod.TYPE]: {
      kind: FilterKind.TYPE,
      types: [...DEFAULT_TYPES_BY_MODE[mode]]
    }
  } satisfies Record<FilterMethod, FilterCondition>;
  const condition: FilterCondition = conditionByMethod[method];
  return condition;
}

/** The conditions with one method's replaced, added or (null) removed - kept in `FILTER_METHODS` order */
export function withMethodCondition({
  conditions,
  method,
  condition
}: {
  conditions: readonly FilterCondition[];
  method: FilterMethod;
  condition: FilterCondition | null;
}) {
  const others = conditions.filter(other => getConditionMethod(other) !== method);
  const next = condition ? [...others, condition] : others;
  return next.toSorted(
    (left, right) =>
      FILTER_METHODS.indexOf(getConditionMethod(left)) - FILTER_METHODS.indexOf(getConditionMethod(right))
  );
}
