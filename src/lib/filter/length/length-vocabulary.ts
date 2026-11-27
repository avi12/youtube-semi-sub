import { SECONDS_PER_MINUTE } from "@/lib/youtube/video/video-duration";

export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const DEFAULT_UNIT_SECONDS = SECONDS_PER_MINUTE;

export const UNIT_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  m: SECONDS_PER_MINUTE,
  min: SECONDS_PER_MINUTE,
  mins: SECONDS_PER_MINUTE,
  minute: SECONDS_PER_MINUTE,
  minutes: SECONDS_PER_MINUTE,
  h: SECONDS_PER_HOUR,
  hr: SECONDS_PER_HOUR,
  hrs: SECONDS_PER_HOUR,
  hour: SECONDS_PER_HOUR,
  hours: SECONDS_PER_HOUR
};

export enum Comparison {
  LESS_THAN = "<",
  AT_MOST = "<=",
  MORE_THAN = ">",
  AT_LEAST = ">=",
  EXACTLY = "="
}

/** Every way to write a comparison, symbols and words, longest first so "<=" wins over "<" */
export const COMPARISON_PHRASES: readonly (readonly [string, Comparison])[] = [
  ["no more than", Comparison.AT_MOST],
  ["no longer than", Comparison.AT_MOST],
  ["no less than", Comparison.AT_LEAST],
  ["no shorter than", Comparison.AT_LEAST],
  ["shorter than", Comparison.LESS_THAN],
  ["longer than", Comparison.MORE_THAN],
  ["less than", Comparison.LESS_THAN],
  ["fewer than", Comparison.LESS_THAN],
  ["more than", Comparison.MORE_THAN],
  ["at most", Comparison.AT_MOST],
  ["at least", Comparison.AT_LEAST],
  ["up to", Comparison.AT_MOST],
  ["maximum", Comparison.AT_MOST],
  ["minimum", Comparison.AT_LEAST],
  ["within", Comparison.AT_MOST],
  ["exactly", Comparison.EXACTLY],
  ["under", Comparison.LESS_THAN],
  ["below", Comparison.LESS_THAN],
  ["over", Comparison.MORE_THAN],
  ["above", Comparison.MORE_THAN],
  ["max", Comparison.AT_MOST],
  ["<=", Comparison.AT_MOST],
  [">=", Comparison.AT_LEAST],
  ["=<", Comparison.AT_MOST],
  ["=>", Comparison.AT_LEAST],
  ["==", Comparison.EXACTLY],
  ["≤", Comparison.AT_MOST],
  ["≥", Comparison.AT_LEAST],
  ["<", Comparison.LESS_THAN],
  [">", Comparison.MORE_THAN],
  ["=", Comparison.EXACTLY]
];

export const RANGE_SEPARATORS: ReadonlySet<string> = new Set(["-", "\u2013", "\u2014", "..", "to", "and", "~"]);
export const CLAUSE_JOINERS: ReadonlySet<string> = new Set([",", ";", "and", "&", "&&"]);
export const BETWEEN_WORD = "between";
export const OPEN_ENDED_MARK = "+";
