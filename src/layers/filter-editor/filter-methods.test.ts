import { describe, expect, it } from "vitest";

import { DEFAULT_LENGTH_FILTER, DEFAULT_TITLE_FILTER, FilterMethod } from "@/lib/filter/schema/video-filter-schema";

import { withMethodCondition } from "./filter-methods";

describe("withMethodCondition", () => {
  it("adds a method's condition in card order", () => {
    expect(
      withMethodCondition({
        conditions: [DEFAULT_LENGTH_FILTER],
        method: FilterMethod.TITLE,
        condition: DEFAULT_TITLE_FILTER
      })
    ).toEqual([DEFAULT_TITLE_FILTER, DEFAULT_LENGTH_FILTER]);
  });

  it("replaces and removes a method's condition", () => {
    const conditions = [DEFAULT_TITLE_FILTER, DEFAULT_LENGTH_FILTER];
    const longer = {
      ...DEFAULT_LENGTH_FILTER,
      maxSeconds: 3600
    };
    expect(
      withMethodCondition({
        conditions,
        method: FilterMethod.LENGTH,
        condition: longer
      })
    ).toEqual([DEFAULT_TITLE_FILTER, longer]);
    expect(
      withMethodCondition({
        conditions,
        method: FilterMethod.TITLE,
        condition: null
      })
    ).toEqual([DEFAULT_LENGTH_FILTER]);
  });
});
