// YouTube only exposes a feed item's age as localized relative text ("3 hours ago", "Streamed 2 days ago",
// "5d ago"). English is parsed into an approximate timestamp; other languages yield null

import {
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND
} from "@/lib/utils/time";

enum TimeUnit {
  second = "second",
  minute = "minute",
  hour = "hour",
  day = "day",
  week = "week",
  month = "month",
  year = "year"
}

const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30.436875;
const DAYS_PER_YEAR = 365.2425;

const MILLISECONDS_BY_UNIT: Record<TimeUnit, number> = {
  [TimeUnit.second]: MILLISECONDS_PER_SECOND,
  [TimeUnit.minute]: MILLISECONDS_PER_MINUTE,
  [TimeUnit.hour]: MILLISECONDS_PER_HOUR,
  [TimeUnit.day]: MILLISECONDS_PER_DAY,
  [TimeUnit.week]: MILLISECONDS_PER_DAY * DAYS_PER_WEEK,
  [TimeUnit.month]: MILLISECONDS_PER_DAY * DAYS_PER_MONTH,
  [TimeUnit.year]: MILLISECONDS_PER_DAY * DAYS_PER_YEAR
};

// Long ("hours"), short ("hrs") and compact ("h", "mo") spellings; a lone "m" is minutes, months are "mo"
const UNIT_BY_SPELLING = new Map<string, TimeUnit>([
  ["s", TimeUnit.second],
  ["sec", TimeUnit.second],
  ["secs", TimeUnit.second],
  ["second", TimeUnit.second],
  ["seconds", TimeUnit.second],
  ["m", TimeUnit.minute],
  ["min", TimeUnit.minute],
  ["mins", TimeUnit.minute],
  ["minute", TimeUnit.minute],
  ["minutes", TimeUnit.minute],
  ["h", TimeUnit.hour],
  ["hr", TimeUnit.hour],
  ["hrs", TimeUnit.hour],
  ["hour", TimeUnit.hour],
  ["hours", TimeUnit.hour],
  ["d", TimeUnit.day],
  ["day", TimeUnit.day],
  ["days", TimeUnit.day],
  ["w", TimeUnit.week],
  ["wk", TimeUnit.week],
  ["wks", TimeUnit.week],
  ["week", TimeUnit.week],
  ["weeks", TimeUnit.week],
  ["mo", TimeUnit.month],
  ["mos", TimeUnit.month],
  ["month", TimeUnit.month],
  ["months", TimeUnit.month],
  ["y", TimeUnit.year],
  ["yr", TimeUnit.year],
  ["yrs", TimeUnit.year],
  ["year", TimeUnit.year],
  ["years", TimeUnit.year]
]);

const RELATIVE_TIME_PATTERN = /(\d+)\s*([a-z]+)\s+ago\b/i;

/** `approxTime` is the newest moment the text can mean ("3 hours ago" = 3 hours), `earliestTime` the oldest (4) */
export function parseRelativeTime({ text, now }: {
  text: string;
  now: number;
}) {
  const [, countText = "", spelling = ""] = RELATIVE_TIME_PATTERN.exec(text) ?? [];
  const unit = UNIT_BY_SPELLING.get(spelling.toLowerCase());
  if (!unit) {
    return null;
  }

  const unitMilliseconds = MILLISECONDS_BY_UNIT[unit];
  const count = Number(countText);
  return {
    approxTime: now - count * unitMilliseconds,
    earliestTime: now - (count + 1) * unitMilliseconds
  };
}

export function parseFirstRelativeTime({ texts, now }: {
  texts: readonly string[];
  now: number;
}) {
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
  TimeUnit.year,
  TimeUnit.month,
  TimeUnit.week,
  TimeUnit.day,
  TimeUnit.hour,
  TimeUnit.minute,
  TimeUnit.second
] as const;

function createRelativeTimeFormat(locale: string) {
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "always" });
  }
}

const DEFAULT_LOCALE = "en";

/** "3 hours ago" like YouTube's own upload dates, in the page's language when given */
export function formatRelativeTime({ time, now, locale = DEFAULT_LOCALE }: {
  time: number;
  now: number;
  locale?: string;
}) {
  const elapsed = Math.max(0, now - time);
  const unit = UNITS_LARGEST_FIRST.find(candidate => elapsed >= MILLISECONDS_BY_UNIT[candidate]) ?? TimeUnit.second;
  const count = Math.floor(elapsed / MILLISECONDS_BY_UNIT[unit]);
  return createRelativeTimeFormat(locale).format(-count, unit);
}
