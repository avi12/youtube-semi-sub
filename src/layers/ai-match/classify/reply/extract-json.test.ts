import { describe, expect, it } from "vitest";

import { extractJsonFromText } from "./extract-json";

describe("extractJsonFromText", () => {
  it("pulls the JSON out of a fenced reply wrapped in prose", () => {
    expect(extractJsonFromText('Sure! ```json\n{"verdicts":[{"id":1,"match":true}]}\n``` Hope that helps')).toEqual({
      verdicts: [
        {
          id: 1,
          match: true
        }
      ]
    });
  });

  it("reads a bare array", () => {
    expect(extractJsonFromText('[{"id":2,"match":false}]')).toEqual([
      {
        id: 2,
        match: false
      }
    ]);
  });

  it("keeps a closing brace that sits inside a string", () => {
    expect(extractJsonFromText('{"title":"C++ {} tricks \\"quoted\\""} trailing } prose')).toEqual({
      title: 'C++ {} tricks "quoted"'
    });
  });

  it("returns null when the reply carries no JSON", () => {
    expect(extractJsonFromText("no json here")).toBeNull();
  });

  it("returns null when the JSON never closes", () => {
    expect(extractJsonFromText('{"verdicts":[{"id":1')).toBeNull();
  });

  it("returns null when the brackets balance but the JSON is malformed", () => {
    expect(extractJsonFromText("{verdicts: [1, 2]}")).toBeNull();
  });
});
