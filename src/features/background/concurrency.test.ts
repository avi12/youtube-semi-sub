import { mapWithConcurrency } from "./concurrency";
import { describe, expect, it } from "vitest";

describe("mapWithConcurrency", () => {
  it("keeps the input order and never exceeds the limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const results = await mapWithConcurrency({
      items: [5, 1, 4, 2, 3, 0],
      limit: 2,
      async task(item) {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, item));
        inFlight--;
        return item * 10;
      }
    });
    expect(results).toEqual([50, 10, 40, 20, 30, 0]);
    expect(maxInFlight).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(
      await mapWithConcurrency({
        items: [],
        limit: 4,
        task: async item => item
      })
    ).toEqual([]);
  });
});
