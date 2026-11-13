import { describe, expect, it } from "vitest";

import { findInitialDataJson } from "@/lib/youtube/initial-data";

describe("findInitialDataJson", () => {
  it("finds the embedded JSON and where it starts", () => {
    const json = '{"contents":{"a":1}}';
    const html = `<html><script>var ytInitialData = ${json};</script></html>`;
    const found = findInitialDataJson(html);

    expect(found?.json).toBe(json);
    expect(found && html.slice(found.iJsonStart, found.iJsonStart + json.length)).toBe(json);
  });

  it("is null for a page that embeds none", () => {
    expect(findInitialDataJson("<html><script>var other = {};</script></html>")).toBeNull();
  });
});
