import { describe, expect, it } from "vitest";

import { pluralize } from "@/lib/utils/pluralize";

describe("pluralize", () => {
  it("picks the singular for one and the plural for any other count", () => {
    const forms = {
      one: "video",
      other: "videos"
    };
    expect(
      pluralize({
        count: 1,
        ...forms
      })
    ).toBe("video");
    expect(
      pluralize({
        count: 0,
        ...forms
      })
    ).toBe("videos");
    expect(
      pluralize({
        count: 2,
        ...forms
      })
    ).toBe("videos");
  });
});
