import { formatRelativeTime, parseFirstRelativeTime, parseRelativeTime } from "./relative-time";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 9, 15, 12);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

function parse(text: string) {
  return parseRelativeTime({
    text,
    now: NOW
  });
}

describe("parseRelativeTime", () => {
  it.each([
    ["45 seconds ago", 45 * SECOND],
    ["1 minute ago", MINUTE],
    ["3 hours ago", 3 * HOUR],
    ["1 day ago", DAY],
    ["2 weeks ago", 2 * WEEK],
    ["Streamed 5 hours ago", 5 * HOUR],
    ["Premiered 2 days ago", 2 * DAY]
  ])("reads %s", (text, age) => {
    expect(parse(text)?.approximateTime).toBe(NOW - age);
  });

  it.each([
    ["5d ago", 5 * DAY],
    ["3h ago", 3 * HOUR],
    ["10m ago", 10 * MINUTE],
    ["2w ago", 2 * WEEK],
    ["1 hr ago", HOUR]
  ])("reads the compact %s", (text, age) => {
    expect(parse(text)?.approximateTime).toBe(NOW - age);
  });

  it("tells months (mo) from minutes (m)", () => {
    const months = parse("5mo ago");
    const years = parse("2y ago");
    expect(months && NOW - months.approximateTime).toBeGreaterThan(150 * DAY);
    expect(months && NOW - months.approximateTime).toBeLessThan(155 * DAY);
    expect(years && NOW - years.approximateTime).toBeGreaterThan(730 * DAY);
  });

  it("bounds the oldest moment the text can mean by one more unit", () => {
    expect(parse("3 hours ago")?.earliestTime).toBe(NOW - 4 * HOUR);
    expect(parse("2 weeks ago")?.earliestTime).toBe(NOW - 3 * WEEK);
  });

  it.each([
    "LIVE",
    "Scheduled for 10/20/26, 5:00 PM",
    "Premieres in 3 hours",
    "6.8M views",
    "hace 3 horas",
    "vor 3 Stunden",
    ""
  ])("returns null for %j", text => {
    expect(parse(text)).toBeNull();
  });
});

describe("parseFirstRelativeTime", () => {
  it("skips texts that are not a time", () => {
    const parsed = parseFirstRelativeTime({
      texts: ["Subscribed Channel", "13 million views", "5 days ago"],
      now: NOW
    });
    expect(parsed?.approximateTime).toBe(NOW - 5 * DAY);
  });
});

describe("formatRelativeTime", () => {
  it.each([
    [30 * SECOND, "30 seconds ago"],
    [3 * HOUR + 20 * MINUTE, "3 hours ago"],
    [DAY, "1 day ago"],
    [17 * DAY, "2 weeks ago"]
  ])("formats %i ms as %s", (age, expected) => {
    expect(
      formatRelativeTime({
        time: NOW - age,
        now: NOW,
        locale: "en"
      })
    ).toBe(expected);
  });

  it("falls back to English for an invalid locale", () => {
    expect(
      formatRelativeTime({
        time: NOW - 2 * HOUR,
        now: NOW,
        locale: "not a locale!"
      })
    ).toBe("2 hours ago");
  });
});
