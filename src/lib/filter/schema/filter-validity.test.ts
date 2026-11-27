import { describe, expect, it } from "vitest";

import { type AiFilter, FilterKind, FilterMatch, type VideoFilter } from "@/lib/filter/schema/video-filter-schema";

import { compileTitleFilter, getTitleFilterError, isVideoFilterValid } from "./filter-validity";

const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only reviews"
};

describe("compileTitleFilter", () => {
  it("compiles a valid pattern", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.REGEX,
        pattern: "review",
        flags: "i"
      })?.test("iPhone REVIEW")
    ).toBe(true);
  });

  it("rejects an invalid pattern", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.REGEX,
        pattern: "(",
        flags: ""
      })
    ).toBeNull();
  });

  it("rejects stateful flags", () => {
    expect(
      compileTitleFilter({
        kind: FilterKind.REGEX,
        pattern: "a",
        flags: "g"
      })
    ).toBeNull();
  });
});

describe("getTitleFilterError", () => {
  it("is null for a valid pattern", () => {
    expect(
      getTitleFilterError({
        kind: FilterKind.REGEX,
        pattern: "a|b",
        flags: "i"
      })
    ).toBeNull();
  });

  it("describes an invalid pattern", () => {
    expect(
      getTitleFilterError({
        kind: FilterKind.REGEX,
        pattern: "[",
        flags: ""
      })
    ).toEqual(expect.any(String));
  });

  it("explains a flag that would make the filter stateful, as compileTitleFilter refuses it", () => {
    const filter = {
      kind: FilterKind.REGEX,
      pattern: "review",
      flags: "g"
    } as const;
    expect(compileTitleFilter(filter)).toBeNull();
    expect(getTitleFilterError(filter)).toEqual(expect.stringContaining("flags"));
  });
});

describe("isVideoFilterValid", () => {
  it.each([
    [AI_FILTER, true],
    [
      {
        kind: FilterKind.AI_MATCH,
        description: "   "
      },
      false
    ],
    [
      {
        kind: FilterKind.AI_MATCH,
        description: "x".repeat(301)
      },
      false
    ],
    [
      {
        kind: FilterKind.REGEX,
        pattern: "(",
        flags: ""
      },
      false
    ],
    [
      {
        kind: FilterKind.LENGTH,
        maxSeconds: 600
      },
      true
    ],
    [
      {
        kind: FilterKind.LENGTH
      },
      false
    ],
    [
      {
        kind: FilterKind.LENGTH,
        minSeconds: 600,
        maxSeconds: 60
      },
      false
    ],
    [
      {
        kind: FilterKind.GROUP,
        match: FilterMatch.ANY,
        conditions: []
      },
      false
    ]
  ] satisfies [VideoFilter, boolean][])("judges %j as valid: %s", (filter, isValid) => {
    expect(isVideoFilterValid(filter)).toBe(isValid);
  });
});
