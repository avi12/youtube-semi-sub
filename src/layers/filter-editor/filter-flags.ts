import { ALLOWED_FILTER_FLAGS } from "@/lib/title-filter";

export type FilterFlag = (typeof ALLOWED_FILTER_FLAGS)[number];

export const IGNORE_CASE_FLAG: FilterFlag = "i";

/** The rarely needed flags, tucked behind the "More flags" disclosure */
export const ADVANCED_FILTER_FLAGS = ALLOWED_FILTER_FLAGS.filter(flag => flag !== IGNORE_CASE_FLAG);

export const FILTER_FLAG_DETAILS = {
  i: {
    label: "Ignore case",
    description: "news matches News and NEWS too"
  },
  m: {
    label: "Line anchors",
    description: "^ and $ also match at line breaks"
  },
  s: {
    label: "Dot matches everything",
    description: ". also matches line breaks"
  },
  u: {
    label: "Unicode",
    description: "Emoji count as one character, unlocks \\p{...}"
  },
  v: {
    label: "Unicode sets",
    description: "Unicode plus set operations like [\\p{L}--[a-z]]"
  }
} satisfies Record<FilterFlag, {
  label: string;
  description: string;
}>;

/** `u` and `v` can't be combined - turning one on turns the other off */
const CONFLICTING_FLAG: Partial<Record<FilterFlag, FilterFlag>> = {
  u: "v",
  v: "u"
};

export function setFilterFlag({ flags, flag, isEnabled }: {
  flags: string;
  flag: FilterFlag;
  isEnabled: boolean;
}) {
  const enabledFlags = new Set(flags);
  const conflictingFlag = CONFLICTING_FLAG[flag];
  if (isEnabled) {
    enabledFlags.add(flag);
  } else {
    enabledFlags.delete(flag);
  }

  if (isEnabled && conflictingFlag) {
    enabledFlags.delete(conflictingFlag);
  }

  return ALLOWED_FILTER_FLAGS.filter(allowedFlag => enabledFlags.has(allowedFlag)).join("");
}
