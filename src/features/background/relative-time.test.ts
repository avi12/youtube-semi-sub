import { parseRelativeTime } from "./relative-time";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-10-15T12:00:00Z");
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

describe("parseRelativeTime", () => {
  it.each([
    ["10 seconds ago", 10 * SECOND_MS],
    ["1 minute ago", MINUTE_MS],
    ["3 hours ago", 3 * HOUR_MS],
    ["1 day ago", DAY_MS],
    ["Streamed 2 days ago", 2 * DAY_MS],
    ["Premiered 2 weeks ago", 14 * DAY_MS],
    ["1 month ago", 30 * DAY_MS],
    ["5 years ago", 5 * 365 * DAY_MS]
  ])("reads the full form %j", (text, age) => {
    expect(
      parseRelativeTime({
        text,
        now: NOW
      })
    ).toBe(NOW - age);
  });

  it.each([
    ["3h ago", 3 * HOUR_MS],
    ["1d ago", DAY_MS],
    ["2w ago", 14 * DAY_MS],
    ["3mo ago", 90 * DAY_MS],
    ["1y ago", 365 * DAY_MS]
  ])("reads the compact form %j", (text, age) => {
    expect(
      parseRelativeTime({
        text,
        now: NOW
      })
    ).toBe(NOW - age);
  });

  it.each(["Premieres in 2 hours", "Scheduled for 10/20/26, 5:00 PM", "6.8M views", "1,204 watching", "3 fortnights ago", ""])(
    "returns null for %j",
    text => {
      expect(
        parseRelativeTime({
          text,
          now: NOW
        })
      ).toBeNull();
    }
  );
});
