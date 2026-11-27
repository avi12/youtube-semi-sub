import { describe, expect, it } from "vitest";

import { FilterKind } from "@/lib/filter/schema/video-filter-schema";

import { parseLengthExpression } from "./length-expression";
import { formatLengthExpression } from "./length-format";

describe("formatLengthExpression", () => {
  it("writes stored bounds back as an expression that reads the same", () => {
    for (const bounds of [
      { minSeconds: 4140 },
      { maxSeconds: 90 },
      {
        minSeconds: 300,
        maxSeconds: 1200
      },
      { maxSeconds: 5430 }
    ]) {
      const expression = formatLengthExpression({
        kind: FilterKind.LENGTH,
        ...bounds
      });
      expect(parseLengthExpression(expression).bounds).toEqual(bounds);
    }
  });
});
