const ENGLISH_PLURAL_RULES = new Intl.PluralRules("en");

/** Picks the word form that agrees with `count` */
export function pluralize({ count, one, other }: { count: number; one: string; other: string }) {
  const isSingular = ENGLISH_PLURAL_RULES.select(count) === "one";
  return isSingular ? one : other;
}
