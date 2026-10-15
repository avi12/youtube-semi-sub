enum TimeUnit {
  second = "second",
  minute = "minute",
  hour = "hour",
  day = "day",
  week = "week",
  month = "month",
  year = "year"
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const MILLISECONDS_PER_UNIT: Record<TimeUnit, number> = {
  [TimeUnit.second]: SECOND_MS,
  [TimeUnit.minute]: MINUTE_MS,
  [TimeUnit.hour]: HOUR_MS,
  [TimeUnit.day]: DAY_MS,
  [TimeUnit.week]: 7 * DAY_MS,
  [TimeUnit.month]: 30 * DAY_MS,
  [TimeUnit.year]: 365 * DAY_MS
};

// Full words come from accessibility labels ("3 hours ago"), the short forms from the compact visible text ("3h ago")
const WORDS_BY_UNIT: Record<TimeUnit, string[]> = {
  [TimeUnit.second]: ["second", "seconds", "sec", "s"],
  [TimeUnit.minute]: ["minute", "minutes", "min"],
  [TimeUnit.hour]: ["hour", "hours", "hr", "h"],
  [TimeUnit.day]: ["day", "days", "d"],
  [TimeUnit.week]: ["week", "weeks", "wk", "w"],
  [TimeUnit.month]: ["month", "months", "mo"],
  [TimeUnit.year]: ["year", "years", "yr", "y"]
};

const UNIT_BY_WORD = new Map<string, TimeUnit>();
for (const unit of Object.values(TimeUnit)) {
  for (const word of WORDS_BY_UNIT[unit]) {
    UNIT_BY_WORD.set(word, unit);
  }
}

const RELATIVE_TIME_PATTERN = /(?<amount>\d+)\s*(?<unit>[a-z]+)\s+ago\b/i;

/** Turns English relative text ("3 hours ago", "Streamed 2 days ago", "1mo ago") into an approximate epoch ms */
export function parseRelativeTime({ text, now }: {
  text: string;
  now: number;
}) {
  const groups = RELATIVE_TIME_PATTERN.exec(text)?.groups;
  const unit = UNIT_BY_WORD.get(groups?.unit?.toLowerCase() ?? "");
  if (!unit) {
    return null;
  }

  return now - Number(groups?.amount) * MILLISECONDS_PER_UNIT[unit];
}
