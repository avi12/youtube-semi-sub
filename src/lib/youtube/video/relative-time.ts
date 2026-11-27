// YouTube only exposes a feed item's age as localized relative text ("3 hours ago", "Streamed 2 days ago",
// "5d ago"). English is parsed into an approximate timestamp; other languages yield null

import {
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND
} from "@/lib/utils/time";

enum TimeUnit {
  SECOND = "second",
  MINUTE = "minute",
  HOUR = "hour",
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year"
}

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.436875;
const DAYS_PER_YEAR = 365.2425;

const MILLISECONDS_BY_UNIT: Record<TimeUnit, number> = {
  [TimeUnit.SECOND]: MILLISECONDS_PER_SECOND,
  [TimeUnit.MINUTE]: MILLISECONDS_PER_MINUTE,
  [TimeUnit.HOUR]: MILLISECONDS_PER_HOUR,
  [TimeUnit.DAY]: MILLISECONDS_PER_DAY,
  [TimeUnit.WEEK]: MILLISECONDS_PER_DAY * DAYS_PER_WEEK,
  [TimeUnit.MONTH]: MILLISECONDS_PER_DAY * DAYS_PER_MONTH,
  [TimeUnit.YEAR]: MILLISECONDS_PER_DAY * DAYS_PER_YEAR
};

// Long ("hours"), short ("hrs") and compact ("h", "mo") spellings; a lone "m" is minutes, months are "mo"
const UNIT_BY_SPELLING = new Map<string, TimeUnit>([
  ["s", TimeUnit.SECOND],
  ["sec", TimeUnit.SECOND],
  ["secs", TimeUnit.SECOND],
  ["second", TimeUnit.SECOND],
  ["seconds", TimeUnit.SECOND],
  ["m", TimeUnit.MINUTE],
  ["min", TimeUnit.MINUTE],
  ["mins", TimeUnit.MINUTE],
  ["minute", TimeUnit.MINUTE],
  ["minutes", TimeUnit.MINUTE],
  ["h", TimeUnit.HOUR],
  ["hr", TimeUnit.HOUR],
  ["hrs", TimeUnit.HOUR],
  ["hour", TimeUnit.HOUR],
  ["hours", TimeUnit.HOUR],
  ["d", TimeUnit.DAY],
  ["day", TimeUnit.DAY],
  ["days", TimeUnit.DAY],
  ["w", TimeUnit.WEEK],
  ["wk", TimeUnit.WEEK],
  ["wks", TimeUnit.WEEK],
  ["week", TimeUnit.WEEK],
  ["weeks", TimeUnit.WEEK],
  ["mo", TimeUnit.MONTH],
  ["mos", TimeUnit.MONTH],
  ["month", TimeUnit.MONTH],
  ["months", TimeUnit.MONTH],
  ["y", TimeUnit.YEAR],
  ["yr", TimeUnit.YEAR],
  ["yrs", TimeUnit.YEAR],
  ["year", TimeUnit.YEAR],
  ["years", TimeUnit.YEAR]
]);

const RELATIVE_TIME_PATTERN = /(\d+)\s*([a-z]+)\s+ago\b/i;

/** `approximateTime` is the newest moment the text can mean ("3 hours ago" = 3 hours), `earliestTime` the oldest (4) */
export function parseRelativeTime({ text, now }: { text: string; now: number }) {
  const [, countText = "", spelling = ""] = RELATIVE_TIME_PATTERN.exec(text) ?? [];
  const unit = UNIT_BY_SPELLING.get(spelling.toLowerCase());
  if (!unit) {
    return null;
  }

  const unitMilliseconds = MILLISECONDS_BY_UNIT[unit];
  const count = Number(countText);
  return {
    approximateTime: now - count * unitMilliseconds,
    earliestTime: now - (count + 1) * unitMilliseconds
  };
}

export function parseFirstRelativeTime({ texts, now }: { texts: readonly string[]; now: number }) {
  for (const text of texts) {
    const publishedTime = parseRelativeTime({
      text,
      now
    });
    if (publishedTime) {
      return publishedTime;
    }
  }
  return null;
}

const UNITS_LARGEST_FIRST = [
  TimeUnit.YEAR,
  TimeUnit.MONTH,
  TimeUnit.WEEK,
  TimeUnit.DAY,
  TimeUnit.HOUR,
  TimeUnit.MINUTE,
  TimeUnit.SECOND
] as const;

const DEFAULT_LOCALE = "en";

function createRelativeTimeFormat(locale: string) {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  } catch {
    return new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "always" });
  }
}

/** "3 hours ago" like YouTube's own upload dates, in the page's language when given */
export function formatRelativeTime({
  time,
  now,
  locale = DEFAULT_LOCALE
}: {
  time: number;
  now: number;
  locale?: string;
}) {
  const elapsed = Math.max(0, now - time);
  const unit = UNITS_LARGEST_FIRST.find(candidate => elapsed >= MILLISECONDS_BY_UNIT[candidate]) ?? TimeUnit.SECOND;
  const count = Math.floor(elapsed / MILLISECONDS_BY_UNIT[unit]);
  return createRelativeTimeFormat(locale).format(-count, unit);
}
