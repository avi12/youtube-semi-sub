import {
  aiFilterSchema,
  ALLOWED_FILTER_FLAGS,
  type FilterCondition,
  FilterKind,
  type LengthFilter,
  lengthFilterSchema,
  listFilterConditions,
  type RegexFilter,
  regexFilterSchema,
  typeFilterSchema,
  type VideoFilter
} from "@/lib/filter/schema/video-filter-schema";

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
  } catch (error) {
    return {
      regex: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export function compileTitleFilter(filter: RegexFilter) {
  return compileRegexFilter(filter).regex;
}

export function getTitleFilterError(filter: RegexFilter) {
  return compileRegexFilter(filter).error;
}

export function isLengthFilterSet({ minSeconds, maxSeconds }: LengthFilter) {
  return minSeconds !== undefined || maxSeconds !== undefined;
}

function isLengthRangeValid({ minSeconds = 0, maxSeconds = Infinity }: LengthFilter) {
  return minSeconds <= maxSeconds;
}

export function isFilterConditionValid(condition: FilterCondition) {
  if (condition.kind === FilterKind.REGEX) {
    return compileTitleFilter(condition) !== null;
  }

  if (condition.kind === FilterKind.TYPE) {
    return typeFilterSchema.safeParse(condition).success && condition.types.length > 0;
  }

  if (condition.kind === FilterKind.LENGTH) {
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
