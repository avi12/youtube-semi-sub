import { describe, expect, it } from "vitest";

import { DEFAULT_TITLE_FILTER, FilterKind, FilterMatch, VideoType } from "@/lib/filter/title-filter";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";

import { describeFilterRule } from "./filter-literal";

describe("describeFilterRule", () => {
  it("reads an Allow list as the videos it shows, joined by its match", () => {
    expect(
      describeFilterRule({
        filter: {
          kind: FilterKind.GROUP,
          match: FilterMatch.ALL,
          conditions: [
            {
              kind: FilterKind.REGEX,
              pattern: "review",
              flags: "i"
            },
            {
              kind: FilterKind.LENGTH,
              minSeconds: 120,
              maxSeconds: 1200
            }
          ]
        },
        mode: SubscriptionMode.FOLLOW
      })
    ).toEqual({
      verb: "Shows",
      clauses: ["have a title matching /review/i", "run 2-20 min"],
      connector: "and",
      otherwise: "Everything else from this channel stays out of your feed",
      pendingNote: "Videos still being checked show once they pass"
    });
  });

  it("reads a Block list as the videos it hides, leaving out an empty pattern", () => {
    const rule = describeFilterRule({
      filter: {
        kind: FilterKind.GROUP,
        match: FilterMatch.ANY,
        conditions: [
          DEFAULT_TITLE_FILTER,
          {
            kind: FilterKind.LENGTH,
            maxSeconds: 60
          }
        ]
      },
      mode: SubscriptionMode.HIDE
    });
    expect(rule.verb).toBe("Hides");
    expect(rule.clauses).toEqual(["run up to 1 min"]);
    expect(rule.otherwise).toBe("Everything else stays in your feed");
  });

  it("names the upload types a type condition picks", () => {
    expect(
      describeFilterRule({
        filter: {
          kind: FilterKind.TYPE,
          types: [VideoType.LIVE_STREAM, VideoType.SHORT]
        },
        mode: SubscriptionMode.HIDE
      }).clauses
    ).toEqual(["are Shorts or live streams"]);
  });

  it("says a filter that judges nothing leaves the channel alone", () => {
    expect(
      describeFilterRule({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.HIDE
      })
    ).toMatchObject({
      clauses: [],
      otherwise: "Hides nothing yet - every video stays in your feed"
    });
  });
});
