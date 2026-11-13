import { describe, expect, it } from "vitest";

import { readText } from "@/lib/youtube/schemas/text";

describe("readText", () => {
  it("reads simple text, joins runs, and is empty without either", () => {
    expect(readText({ simpleText: "3 hours ago" })).toBe("3 hours ago");
    expect(readText({ runs: [{ text: "Streamed " }, { text: "2 days ago" }] })).toBe("Streamed 2 days ago");
    expect(readText(undefined)).toBe("");
  });
});
