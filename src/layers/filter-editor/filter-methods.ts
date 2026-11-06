import {
  DEFAULT_LENGTH_FILTER,
  DEFAULT_TITLE_FILTER,
  FILTER_METHOD_BY_KIND,
  type FilterCondition,
  FilterKind,
  FilterMatch,
  FilterMethod
} from "@/lib/filter/title-filter";

// The editor's registry of filter methods: a new method is an entry here, a condition kind in title-filter and a
// fields component in FilterEditor

/** In the order their cards appear */
export const FILTER_METHODS = Object.values(FilterMethod);

export const FILTER_METHOD_LABEL = {
  [FilterMethod.title]: "Title",
  [FilterMethod.length]: "Length"
} as const satisfies Record<FilterMethod, string>;

export const TITLE_KIND_LABEL = {
  [FilterKind.regex]: "RegExp",
  [FilterKind.aiMatch]: "AI match"
} as const satisfies Record<FilterKind.regex | FilterKind.aiMatch, string>;

export const FILTER_MATCH_LABEL = {
  [FilterMatch.all]: "All of these",
  [FilterMatch.any]: "Any of these"
} as const satisfies Record<FilterMatch, string>;

export const FILTER_MATCHES = Object.values(FilterMatch);

export function getConditionMethod(condition: FilterCondition) {
  return FILTER_METHOD_BY_KIND[condition.kind];
}

/** Where a newly picked method starts */
export function createDefaultCondition(method: FilterMethod) {
  const condition: FilterCondition = method === FilterMethod.length ? { ...DEFAULT_LENGTH_FILTER } : {
    ...DEFAULT_TITLE_FILTER
  };
  return condition;
}

/** The conditions with one method's replaced, added or (null) removed - kept in `FILTER_METHODS` order */
export function withMethodCondition({ conditions, method, condition }: {
  conditions: readonly FilterCondition[];
  method: FilterMethod;
  condition: FilterCondition | null;
}) {
  const others = conditions.filter(other => getConditionMethod(other) !== method);
  const next = condition ? [...others, condition] : others;
  return next.toSorted((left, right) =>
    FILTER_METHODS.indexOf(getConditionMethod(left)) - FILTER_METHODS.indexOf(getConditionMethod(right)));
}
