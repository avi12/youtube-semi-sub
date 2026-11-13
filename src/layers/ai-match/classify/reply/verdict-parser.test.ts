import { describe, expect, it } from "vitest";

import { parseVerdictReply } from "./verdict-parser";

describe("parseVerdictReply", () => {
  it("reads one verdict per id", () => {
    expect(
      parseVerdictReply({
        reply: {
          verdicts: [
            {
              id: 1,
              match: true
            },
            {
              id: 2,
              match: false
            }
          ]
        },
        count: 2
      })
    ).toEqual(
      new Map([
        [1, true],
        [2, false]
      ])
    );
  });

  it("leaves a skipped id out, so its video stays pending", () => {
    expect(
      parseVerdictReply({
        reply: {
          verdicts: [
            {
              id: 2,
              match: true
            }
          ]
        },
        count: 3
      })
    ).toEqual(new Map([[2, true]]));
  });

  it("keeps the first verdict for a repeated id and ignores ids outside the batch", () => {
    expect(
      parseVerdictReply({
        reply: {
          verdicts: [
            {
              id: 1,
              match: false
            },
            {
              id: 1,
              match: true
            },
            {
              id: 0,
              match: true
            },
            {
              id: 3,
              match: true
            },
            {
              id: 1.5,
              match: true
            }
          ]
        },
        count: 2
      })
    ).toEqual(new Map([[1, false]]));
  });

  it("accepts quoted numbers and booleans, and a bare array", () => {
    expect(
      parseVerdictReply({
        reply: [
          {
            id: "1",
            match: "true"
          },
          {
            id: 2,
            match: "false"
          }
        ],
        count: 2
      })
    ).toEqual(
      new Map([
        [1, true],
        [2, false]
      ])
    );
  });

  it("skips malformed entries but keeps the rest", () => {
    expect(
      parseVerdictReply({
        reply: {
          verdicts: [
            null,
            "1: yes",
            {
              id: 1
            },
            {
              id: 2,
              match: "maybe"
            },
            {
              id: 3,
              match: true
            }
          ]
        },
        count: 3
      })
    ).toEqual(new Map([[3, true]]));
  });

  it.each([null, "not json", 42, { matches: [1, 2] }, { verdicts: "all" }])("reads nothing from %j", reply => {
    expect(
      parseVerdictReply({
        reply,
        count: 2
      }).size
    ).toBe(0);
  });
});
