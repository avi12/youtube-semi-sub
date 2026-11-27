import { describe, expect, it } from "vitest";

import { type AiFilter, buildVideoFilter, DEFAULT_TITLE_FILTER, FilterKind, FilterMatch } from "./video-filter-schema";

const AI_FILTER: AiFilter = {
  kind: FilterKind.AI_MATCH,
  description: "only reviews"
};

describe("buildVideoFilter", () => {
  it("stores a single condition bare and groups several", () => {
    expect(
      buildVideoFilter({
        conditions: [AI_FILTER],
        match: FilterMatch.ANY
      })
    ).toEqual(AI_FILTER);
    expect(
      buildVideoFilter({
        conditions: [AI_FILTER, DEFAULT_TITLE_FILTER],
        match: FilterMatch.ANY
      })
    ).toEqual({
      kind: FilterKind.GROUP,
      match: FilterMatch.ANY,
      conditions: [AI_FILTER, DEFAULT_TITLE_FILTER]
    });
  });
});
