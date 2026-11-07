import { describeFilterRule } from "./filter-literal";
import { DEFAULT_TITLE_FILTER, FilterKind, FilterMatch, VideoType } from "@/lib/filter/title-filter";
import { SubscriptionMode } from "@/lib/schemas/subscription-mode";
import { describe, expect, it } from "vitest";

describe("describeFilterRule", () => {
  it("reads an Allow list as the videos it shows, joined by its match", () => {
    expect(
      describeFilterRule({
        filter: {
          kind: FilterKind.group,
          match: FilterMatch.all,
          conditions: [{
            kind: FilterKind.regex,
            pattern: "review",
            flags: "i"
          }, {
            kind: FilterKind.length,
            minSeconds: 120,
            maxSeconds: 1200
          }]
        },
        mode: SubscriptionMode.follow
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
        kind: FilterKind.group,
        match: FilterMatch.any,
        conditions: [DEFAULT_TITLE_FILTER, {
          kind: FilterKind.length,
          maxSeconds: 60
        }]
      },
      mode: SubscriptionMode.hide
    });
    expect(rule.verb).toBe("Hides");
    expect(rule.clauses).toEqual(["run up to 1 min"]);
    expect(rule.otherwise).toBe("Everything else stays in your feed");
  });

  it("names the upload types a type condition picks", () => {
    expect(
      describeFilterRule({
        filter: {
          kind: FilterKind.type,
          types: [VideoType.liveStream, VideoType.short]
        },
        mode: SubscriptionMode.hide
      }).clauses
    ).toEqual(["are Shorts or live streams"]);
  });

  it("says a filter that judges nothing leaves the channel alone", () => {
    expect(
      describeFilterRule({
        filter: DEFAULT_TITLE_FILTER,
        mode: SubscriptionMode.hide
      })
    ).toMatchObject({
      clauses: [],
      otherwise: "Hides nothing yet - every video stays in your feed"
    });
  });
});
