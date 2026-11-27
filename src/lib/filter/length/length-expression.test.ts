import { describe, expect, it } from "vitest";

import { parseLengthExpression } from "./length-expression";

describe("parseLengthExpression", () => {
  it.each([
    [">=69m", { minSeconds: 4140 }],
    ["> 69 min", { minSeconds: 4141 }],
    ["<20m", { maxSeconds: 1199 }],
    ["≤ 1h", { maxSeconds: 3600 }],
    ["under 10 minutes", { maxSeconds: 599 }],
    ["at least 1.5h", { minSeconds: 5400 }],
    ["up to 90s", { maxSeconds: 90 }],
    ["no longer than 1h 30m", { maxSeconds: 5400 }],
    [
      "5-20m",
      {
        minSeconds: 300,
        maxSeconds: 1200
      }
    ],
    [
      "5..20",
      {
        minSeconds: 300,
        maxSeconds: 1200
      }
    ],
    [
      "between 2 and 10 minutes",
      {
        minSeconds: 120,
        maxSeconds: 600
      }
    ],
    [
      "20m to 5m",
      {
        minSeconds: 300,
        maxSeconds: 1200
      }
    ],
    [
      ">=5m and <=20m",
      {
        minSeconds: 300,
        maxSeconds: 1200
      }
    ],
    ["1h30m+", { minSeconds: 5400 }],
    ["<= 1:30", { maxSeconds: 90 }],
    ["15", null],
    ["", null],
    [">= banana", null],
    [">1h and <10m", null],
    ["<=10m @", null]
  ])("reads %j", (text, bounds) => {
    expect(parseLengthExpression(text).bounds).toEqual(bounds);
  });

  it("says what to type when it can't read the expression", () => {
    expect(parseLengthExpression("15").error).toBe("Say how it compares, like <=10m, >10m or 5-20m");
    expect(parseLengthExpression(">=").error).toBe('Add a length after ">=", like 10m');
  });
});
