import { parseJson } from "@/lib/utils/json";
import { describe, expect, it } from "vitest";

describe("parseJson", () => {
  it("parses JSON and is null for anything else", () => {
    expect(parseJson("{\"a\":[1]}")).toEqual({ a: [1] });
    expect(parseJson("not json")).toBeNull();
  });
});
