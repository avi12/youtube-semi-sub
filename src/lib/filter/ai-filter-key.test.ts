import { describe, expect, it } from "vitest";

import { AI_PROMPT_VERSION, getAiFilterKey, normalizeAiDescription } from "./ai-filter-key";

describe("normalizeAiDescription", () => {
  it("trims and collapses whitespace, line breaks included", () => {
    expect(normalizeAiDescription("  only phone\n\treviews,   not unboxings ")).toBe(
      "only phone reviews, not unboxings"
    );
  });

  it("unifies Unicode forms", () => {
    expect(normalizeAiDescription("café")).toBe(normalizeAiDescription("café"));
  });
});

describe("getAiFilterKey", () => {
  it("is the same for descriptions that read the same", () => {
    expect(getAiFilterKey({ description: "only reviews " })).toBe(getAiFilterKey({ description: "only  reviews" }));
  });

  it("keeps case, since it can carry meaning", () => {
    expect(getAiFilterKey({ description: "IT news" })).not.toBe(getAiFilterKey({ description: "it news" }));
  });

  it("carries the prompt version, so a prompt change re-judges every video", () => {
    expect(getAiFilterKey({ description: "only reviews" })).toBe(`v${AI_PROMPT_VERSION}:only reviews`);
  });
});
